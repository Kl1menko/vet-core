import { Router } from 'express';
import { query, withTransaction } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';
import { broadcast } from '../../realtime/ws.js';

export const calendarRouter = Router();
calendarRouter.use(authMiddleware);

const EVENT_TYPES = ['appointment', 'note', 'vaccination', 'procedure', 'reminder'];
const EVENT_STATUSES = ['planned', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'];

const eventSchema = {
  title: { required: true, max: 255 },
  type: { required: true, enum: EVENT_TYPES },
  status: { enum: EVENT_STATUSES, default: 'planned' },
  startAt: { required: true },
  endAt: { required: true },
  ownerId: {},
  patientId: {},
  doctorId: {},
  comment: { max: 2000 },
  color: { max: 20 },
};

const SELECT = `
  SELECT e.*,
         o.first_name AS owner_first_name, o.last_name AS owner_last_name, o.phone AS owner_phone,
         p.name AS patient_name, p.species AS patient_species,
         d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
    FROM calendar_events e
    LEFT JOIN owners o ON o.id = e.owner_id
    LEFT JOIN patients p ON p.id = e.patient_id
    LEFT JOIN users d ON d.id = e.doctor_id`;

// Перевірка перетину слотів лікаря (ТЗ §6.5)
async function hasDoctorConflict(client, { clinicId, doctorId, startAt, endAt, excludeId = null }) {
  if (!doctorId) return false;
  const params = [clinicId, doctorId, startAt, endAt];
  let sql = `SELECT 1 FROM calendar_events
              WHERE clinic_id=$1 AND doctor_id=$2 AND deleted_at IS NULL
                AND status NOT IN ('cancelled','no_show')
                AND tstzrange(start_at, end_at) && tstzrange($3,$4)`;
  if (excludeId) { params.push(excludeId); sql += ` AND id <> $${params.length}`; }
  const { rows } = await client.query(sql, params);
  return rows.length > 0;
}

// GET /calendar/events?from=&to=&doctorId=&type=&status=
calendarRouter.get(
  '/events',
  requirePermission('calendar.view'),
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE e.clinic_id = $1 AND e.deleted_at IS NULL`;
    if (req.query.from) { params.push(req.query.from); where += ` AND e.end_at >= $${params.length}`; }
    if (req.query.to) { params.push(req.query.to); where += ` AND e.start_at <= $${params.length}`; }
    if (req.query.doctorId) { params.push(req.query.doctorId); where += ` AND e.doctor_id = $${params.length}`; }
    if (req.query.type) { params.push(req.query.type); where += ` AND e.type = $${params.length}`; }
    if (req.query.status) { params.push(req.query.status); where += ` AND e.status = $${params.length}`; }
    const { rows } = await query(`${SELECT} ${where} ORDER BY e.start_at`, params);
    ok(res, rows);
  }),
);

calendarRouter.get(
  '/events/:id',
  requirePermission('calendar.view'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT} WHERE e.id=$1 AND e.clinic_id=$2 AND e.deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!rows[0]) throw ApiError.notFound('Подію не знайдено');
    ok(res, rows[0]);
  }),
);

calendarRouter.post(
  '/events',
  requirePermission('calendar.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, eventSchema);
    if (new Date(d.endAt) <= new Date(d.startAt)) {
      throw ApiError.validation('Помилка валідації', { endAt: 'Кінець має бути пізніше за початок' });
    }
    // Бізнес-правило: прийом без власника заборонений (note — можна)
    if (d.type === 'appointment' && !d.ownerId) {
      throw ApiError.validation('Помилка валідації', { ownerId: 'Для прийому потрібен власник' });
    }

    const event = await withTransaction(async (c) => {
      const conflict = await hasDoctorConflict(c, {
        clinicId: req.user.clinicId, doctorId: d.doctorId, startAt: d.startAt, endAt: d.endAt,
      });
      if (conflict) throw ApiError.conflict('У лікаря вже є запис на цей час');

      const { rows } = await c.query(
        `INSERT INTO calendar_events
           (clinic_id, branch_id, owner_id, patient_id, doctor_id, title, type, status, start_at, end_at, comment, color, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [req.user.clinicId, req.user.branchId, d.ownerId || null, d.patientId || null,
          d.doctorId || null, d.title, d.type, d.status || 'planned', d.startAt, d.endAt,
          d.comment || null, d.color || null, req.user.id],
      );
      return rows[0];
    });

    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'calendar_event', entityId: event.id });
    const { rows: full } = await query(`${SELECT} WHERE e.id=$1`, [event.id]);
    broadcast(req.user.clinicId, 'appointment.created', {
      id: full[0].id, title: full[0].title, startAt: full[0].start_at,
      patientName: full[0].patient_name,
    });
    created(res, full[0]);
  }),
);

calendarRouter.put(
  '/events/:id',
  requirePermission('calendar.manage'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM calendar_events WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Подію не знайдено');

    const cur = ex[0];
    const d = validate({
      title: cur.title, type: cur.type, status: cur.status,
      startAt: cur.start_at.toISOString(), endAt: cur.end_at.toISOString(),
      ownerId: cur.owner_id, patientId: cur.patient_id, doctorId: cur.doctor_id,
      comment: cur.comment, color: cur.color, ...req.body,
    }, eventSchema);

    const updated = await withTransaction(async (c) => {
      const conflict = await hasDoctorConflict(c, {
        clinicId: req.user.clinicId, doctorId: d.doctorId, startAt: d.startAt, endAt: d.endAt,
        excludeId: req.params.id,
      });
      if (conflict) throw ApiError.conflict('У лікаря вже є запис на цей час');
      const { rows } = await c.query(
        `UPDATE calendar_events SET title=$1, type=$2, status=$3, start_at=$4, end_at=$5,
                owner_id=$6, patient_id=$7, doctor_id=$8, comment=$9, color=$10, updated_at=now()
          WHERE id=$11 RETURNING *`,
        [d.title, d.type, d.status, d.startAt, d.endAt, d.ownerId || null, d.patientId || null,
          d.doctorId || null, d.comment || null, d.color || null, req.params.id],
      );
      return rows[0];
    });
    await writeAudit({ ...auditCtx(req), action: 'update', entityType: 'calendar_event', entityId: req.params.id });
    const { rows: full } = await query(`${SELECT} WHERE e.id=$1`, [updated.id]);
    ok(res, full[0]);
  }),
);

calendarRouter.delete(
  '/events/:id',
  requirePermission('calendar.manage'),
  asyncHandler(async (req, res) => {
    await query(`UPDATE calendar_events SET deleted_at=now() WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinicId]);
    await writeAudit({ ...auditCtx(req), action: 'delete', entityType: 'calendar_event', entityId: req.params.id });
    ok(res, {}, 'Подію видалено');
  }),
);

calendarRouter.post(
  '/events/:id/clone',
  requirePermission('calendar.manage'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM calendar_events WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Подію не знайдено');
    const s = ex[0];
    const { rows } = await query(
      `INSERT INTO calendar_events
         (clinic_id, branch_id, owner_id, patient_id, doctor_id, title, type, status, start_at, end_at, comment, color, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'planned',$8,$9,$10,$11,$12) RETURNING *`,
      [s.clinic_id, s.branch_id, s.owner_id, s.patient_id, s.doctor_id, s.title + ' (копія)',
        s.type, s.start_at, s.end_at, s.comment, s.color, req.user.id],
    );
    const { rows: full } = await query(`${SELECT} WHERE e.id=$1`, [rows[0].id]);
    created(res, full[0]);
  }),
);
