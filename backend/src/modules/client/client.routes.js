import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok } from '../../utils/response.js';
import { signAccessToken, verifyToken } from '../../config/auth.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';

export const clientRouter = Router();

/**
 * Клієнтський кабінет (ТЗ §4.7). Спрощена автентифікація для MVP:
 * login за телефоном -> verify кодом (демо-код 0000) -> client-токен.
 * Реальний SMS-код — друга черга.
 */
clientRouter.post('/login', asyncHandler(async (req, res) => {
  const d = validate(req.body, { phone: { required: true, max: 50 } });
  const { rows } = await query(
    `SELECT id FROM owners WHERE phone=$1 AND deleted_at IS NULL AND is_active=true LIMIT 1`, [d.phone]);
  // не розкриваємо існування акаунта
  ok(res, { sent: true, demoCode: '0000' }, 'Код підтвердження надіслано (демо: 0000)');
}));

clientRouter.post('/verify', asyncHandler(async (req, res) => {
  const d = validate(req.body, { phone: { required: true }, code: { required: true } });
  if (d.code !== '0000') throw ApiError.unauthorized('Невірний код');
  const { rows } = await query(`SELECT id, clinic_id FROM owners WHERE phone=$1 AND deleted_at IS NULL LIMIT 1`, [d.phone]);
  if (!rows[0]) throw ApiError.unauthorized('Власника не знайдено');
  const token = signAccessToken({ sub: rows[0].id, clinicId: rows[0].clinic_id, scope: 'client' });
  ok(res, { accessToken: token, ownerId: rows[0].id }, 'Вхід виконано');
}));

// middleware для клієнтських ендпоінтів
function clientAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return next(ApiError.unauthorized());
  try {
    const p = verifyToken(t);
    if (p.scope !== 'client') return next(ApiError.forbidden('Потрібен клієнтський токен'));
    req.client = { ownerId: p.sub, clinicId: p.clinicId };
    next();
  } catch { next(ApiError.unauthorized('Недійсний токен')); }
}

clientRouter.use(clientAuth);

clientRouter.get('/pets', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM patients WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY name`, [req.client.ownerId]);
  ok(res, rows);
}));

clientRouter.get('/pets/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM patients WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL`, [req.params.id, req.client.ownerId]);
  if (!rows[0]) throw ApiError.notFound('Тварину не знайдено');
  const vaccinations = (await query(
    `SELECT * FROM vaccinations WHERE patient_id=$1 AND deleted_at IS NULL ORDER BY vaccination_date DESC`, [req.params.id])).rows;
  // лише завершені прийоми з рекомендаціями (ТЗ §4.7)
  const appointments = (await query(
    `SELECT id, diagnosis, recommendations, completed_at FROM appointments
      WHERE patient_id=$1 AND status='completed' AND deleted_at IS NULL ORDER BY completed_at DESC`, [req.params.id])).rows;
  ok(res, { ...rows[0], vaccinations, appointments });
}));

clientRouter.get('/appointments', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT e.id, e.title, e.start_at, e.status, p.name AS patient_name
       FROM calendar_events e LEFT JOIN patients p ON p.id=e.patient_id
      WHERE e.owner_id=$1 AND e.deleted_at IS NULL AND e.start_at >= now() - interval '1 day'
      ORDER BY e.start_at`, [req.client.ownerId]);
  ok(res, rows);
}));

clientRouter.get('/invoices', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, total, paid_amount, debt_amount, status, created_at FROM invoices
      WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, [req.client.ownerId]);
  ok(res, rows);
}));

clientRouter.get('/discount-card', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT card_number, discount_percent, bonus_balance FROM discount_cards
      WHERE owner_id=$1 AND is_active=true LIMIT 1`, [req.client.ownerId]);
  ok(res, rows[0] || null);
}));
