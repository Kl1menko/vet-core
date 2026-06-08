import { Router } from 'express';
import { query, withTransaction } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const vaccinationsRouter = Router();
vaccinationsRouter.use(authMiddleware);

vaccinationsRouter.get(
  '/',
  requirePermission('patients.view', 'appointments.view'),
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE v.clinic_id=$1 AND v.deleted_at IS NULL`;
    if (req.query.patientId) { params.push(req.query.patientId); where += ` AND v.patient_id=$${params.length}`; }
    if (req.query.dueSoon === 'true') where += ` AND v.next_vaccination_date IS NOT NULL AND v.next_vaccination_date <= current_date + interval '14 days'`;
    const { rows } = await query(
      `SELECT v.*, p.name AS patient_name FROM vaccinations v
         JOIN patients p ON p.id=v.patient_id
         ${where} ORDER BY v.vaccination_date DESC`, params);
    ok(res, rows);
  }),
);

const schema = {
  patientId: { required: true },
  appointmentId: {},
  doctorId: {},
  vaccineName: { required: true, max: 255 },
  batchNumber: { max: 100 },
  manufacturer: { max: 255 },
  vaccinationDate: { required: true },
  nextVaccinationDate: {},
  comment: { max: 1000 },
};

// Створення вакцинації + авто-нагадування (ТЗ §12.5)
vaccinationsRouter.post(
  '/',
  requirePermission('appointments.edit', 'patients.edit'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, schema);
    const vacc = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO vaccinations (clinic_id, patient_id, appointment_id, doctor_id, vaccine_name,
                                   batch_number, manufacturer, vaccination_date, next_vaccination_date, comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.user.clinicId, d.patientId, d.appointmentId || null, d.doctorId || req.user.id, d.vaccineName,
          d.batchNumber || null, d.manufacturer || null, d.vaccinationDate, d.nextVaccinationDate || null, d.comment || null]);

      // нагадування за 7 днів до наступної дати
      if (d.nextVaccinationDate) {
        const { rows: pat } = await c.query(`SELECT owner_id FROM patients WHERE id=$1`, [d.patientId]);
        const scheduled = new Date(d.nextVaccinationDate);
        scheduled.setDate(scheduled.getDate() - 7);
        await c.query(
          `INSERT INTO reminders (clinic_id, owner_id, patient_id, type, channel, title, message, scheduled_at)
           VALUES ($1,$2,$3,'vaccination','internal',$4,$5,$6)`,
          [req.user.clinicId, pat[0]?.owner_id || null, d.patientId,
            'Нагадування про вакцинацію', `Наближається вакцинація: ${d.vaccineName}`, scheduled.toISOString()]);
      }
      return rows[0];
    });
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'vaccination', entityId: vacc.id });
    created(res, vacc);
  }),
);

vaccinationsRouter.put(
  '/:id',
  requirePermission('appointments.edit', 'patients.edit'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM vaccinations WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Запис не знайдено');
    const c = ex[0];
    const d = validate({
      patientId: c.patient_id, vaccineName: c.vaccine_name, batchNumber: c.batch_number,
      manufacturer: c.manufacturer, vaccinationDate: c.vaccination_date, nextVaccinationDate: c.next_vaccination_date,
      comment: c.comment, ...req.body,
    }, schema);
    const { rows } = await query(
      `UPDATE vaccinations SET vaccine_name=$1, batch_number=$2, manufacturer=$3, vaccination_date=$4,
              next_vaccination_date=$5, comment=$6, updated_at=now() WHERE id=$7 RETURNING *`,
      [d.vaccineName, d.batchNumber || null, d.manufacturer || null, d.vaccinationDate,
        d.nextVaccinationDate || null, d.comment || null, req.params.id]);
    ok(res, rows[0]);
  }),
);

vaccinationsRouter.delete(
  '/:id',
  requirePermission('appointments.edit', 'patients.edit'),
  asyncHandler(async (req, res) => {
    await query(`UPDATE vaccinations SET deleted_at=now() WHERE id=$1 AND clinic_id=$2`, [req.params.id, req.user.clinicId]);
    ok(res, {}, 'Запис видалено');
  }),
);
