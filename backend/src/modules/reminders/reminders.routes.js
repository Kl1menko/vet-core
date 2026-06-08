import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';

export const remindersRouter = Router();
remindersRouter.use(authMiddleware);

const SELECT = `
  SELECT r.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name, o.phone AS owner_phone,
         p.name AS patient_name
    FROM reminders r
    LEFT JOIN owners o ON o.id=r.owner_id
    LEFT JOIN patients p ON p.id=r.patient_id`;

reminders_get();
function reminders_get() {
  remindersRouter.get('/', asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE r.clinic_id=$1`;
    if (req.query.status) { params.push(req.query.status); where += ` AND r.status=$${params.length}`; }
    if (req.query.due === 'true') where += ` AND r.status='planned' AND r.scheduled_at <= now() + interval '1 day'`;
    const { rows } = await query(`${SELECT} ${where} ORDER BY r.scheduled_at LIMIT 200`, params);
    ok(res, rows);
  }));
}

remindersRouter.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE r.id=$1 AND r.clinic_id=$2`, [req.params.id, req.user.clinicId]);
  if (!rows[0]) throw ApiError.notFound('Нагадування не знайдено');
  ok(res, rows[0]);
}));

const schema = {
  type: { required: true, max: 50 },
  channel: { required: true, enum: ['internal', 'sms', 'email', 'push'], default: 'internal' },
  title: { max: 255 },
  message: { max: 2000 },
  scheduledAt: { required: true },
  ownerId: {}, patientId: {}, appointmentId: {},
};

remindersRouter.post('/', asyncHandler(async (req, res) => {
  const d = validate(req.body, schema);
  const { rows } = await query(
    `INSERT INTO reminders (clinic_id, owner_id, patient_id, appointment_id, type, channel, title, message, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.clinicId, d.ownerId || null, d.patientId || null, d.appointmentId || null,
      d.type, d.channel || 'internal', d.title || null, d.message || null, d.scheduledAt]);
  created(res, rows[0]);
}));

remindersRouter.put('/:id', asyncHandler(async (req, res) => {
  const { rows: ex } = await query(`SELECT * FROM reminders WHERE id=$1 AND clinic_id=$2`, [req.params.id, req.user.clinicId]);
  if (!ex[0]) throw ApiError.notFound('Нагадування не знайдено');
  const c = ex[0];
  const d = validate({ type: c.type, channel: c.channel, title: c.title, message: c.message,
    scheduledAt: c.scheduled_at, ...req.body }, schema);
  const { rows } = await query(
    `UPDATE reminders SET type=$1, channel=$2, title=$3, message=$4, scheduled_at=$5, updated_at=now()
      WHERE id=$6 RETURNING *`,
    [d.type, d.channel, d.title || null, d.message || null, d.scheduledAt, req.params.id]);
  ok(res, rows[0]);
}));

// Позначити надісланим (у MVP — без реального каналу)
remindersRouter.post('/:id/send', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE reminders SET status='sent', sent_at=now(), updated_at=now()
      WHERE id=$1 AND clinic_id=$2 RETURNING *`, [req.params.id, req.user.clinicId]);
  if (!rows[0]) throw ApiError.notFound('Нагадування не знайдено');
  ok(res, rows[0], 'Позначено надісланим');
}));

remindersRouter.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE reminders SET status='cancelled', updated_at=now() WHERE id=$1 AND clinic_id=$2 RETURNING *`,
    [req.params.id, req.user.clinicId]);
  if (!rows[0]) throw ApiError.notFound('Нагадування не знайдено');
  ok(res, rows[0], 'Скасовано');
}));
