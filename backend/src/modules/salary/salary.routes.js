import { Router } from 'express';
import { query, withTransaction } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const salaryRouter = Router();
salaryRouter.use(authMiddleware);

salaryRouter.get(
  '/rules',
  requirePermission('salary.view'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT sr.*, u.first_name, u.last_name FROM salary_rules sr
         JOIN users u ON u.id=sr.user_id
        WHERE sr.clinic_id=$1 AND sr.is_active=true ORDER BY u.last_name`, [req.user.clinicId]);
    ok(res, rows);
  }),
);

const ruleSchema = {
  userId: { required: true },
  type: { required: true, enum: ['fixed', 'percent', 'mixed'] },
  fixedAmount: { type: 'number', min: 0, default: 0 },
  servicePercent: { type: 'number', min: 0, max: 100, default: 0 },
  drugPercent: { type: 'number', min: 0, max: 100, default: 0 },
  profitPercent: { type: 'number', min: 0, max: 100, default: 0 },
};

salaryRouter.post(
  '/rules',
  requirePermission('salary.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, ruleSchema);
    // одне активне правило на користувача
    await query(`UPDATE salary_rules SET is_active=false WHERE user_id=$1 AND clinic_id=$2`, [d.userId, req.user.clinicId]);
    const { rows } = await query(
      `INSERT INTO salary_rules (clinic_id, user_id, type, fixed_amount, service_percent, drug_percent, profit_percent)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.clinicId, d.userId, d.type, d.fixedAmount || 0, d.servicePercent || 0, d.drugPercent || 0, d.profitPercent || 0]);
    created(res, rows[0]);
  }),
);

salaryRouter.put(
  '/rules/:id',
  requirePermission('salary.manage'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM salary_rules WHERE id=$1 AND clinic_id=$2`, [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Правило не знайдено');
    const c = ex[0];
    const d = validate({ userId: c.user_id, type: c.type, fixedAmount: Number(c.fixed_amount),
      servicePercent: Number(c.service_percent), drugPercent: Number(c.drug_percent), profitPercent: Number(c.profit_percent), ...req.body }, ruleSchema);
    const { rows } = await query(
      `UPDATE salary_rules SET type=$1, fixed_amount=$2, service_percent=$3, drug_percent=$4, profit_percent=$5, updated_at=now()
        WHERE id=$6 RETURNING *`,
      [d.type, d.fixedAmount || 0, d.servicePercent || 0, d.drugPercent || 0, d.profitPercent || 0, req.params.id]);
    ok(res, rows[0]);
  }),
);

// Розрахунок зарплати за період (без збереження)
salaryRouter.post(
  '/calculate',
  requirePermission('salary.manage', 'salary.view'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, { userId: { required: true }, from: { required: true }, to: { required: true } });
    const { rows: rule } = await query(`SELECT * FROM salary_rules WHERE user_id=$1 AND clinic_id=$2 AND is_active=true`,
      [d.userId, req.user.clinicId]);
    if (!rule[0]) throw ApiError.badRequest('Для співробітника не налаштовано правило зарплати');
    const r = rule[0];

    const svc = (await query(
      `SELECT COALESCE(SUM(asv.total),0) AS sum FROM appointment_services asv
         JOIN appointments a ON a.id=asv.appointment_id
        WHERE a.doctor_id=$1 AND a.clinic_id=$2 AND a.status='completed'
          AND date(a.completed_at) BETWEEN $3 AND $4`,
      [d.userId, req.user.clinicId, d.from, d.to])).rows[0].sum;
    const drg = (await query(
      `SELECT COALESCE(SUM(ad.total),0) AS sum FROM appointment_drugs ad
         JOIN appointments a ON a.id=ad.appointment_id
        WHERE a.doctor_id=$1 AND a.clinic_id=$2 AND a.status='completed'
          AND date(a.completed_at) BETWEEN $3 AND $4`,
      [d.userId, req.user.clinicId, d.from, d.to])).rows[0].sum;

    const servicesSum = Number(svc), drugsSum = Number(drg);
    const fromServices = servicesSum * Number(r.service_percent) / 100;
    const fromDrugs = drugsSum * Number(r.drug_percent) / 100;
    const total = Number(r.fixed_amount) + fromServices + fromDrugs;

    ok(res, {
      userId: d.userId, from: d.from, to: d.to,
      servicesSum: servicesSum.toFixed(2), drugsSum: drugsSum.toFixed(2),
      fixed: Number(r.fixed_amount).toFixed(2),
      fromServices: fromServices.toFixed(2), fromDrugs: fromDrugs.toFixed(2),
      total: total.toFixed(2),
    });
  }),
);

// Зафіксувати виплату
salaryRouter.post(
  '/payments',
  requirePermission('salary.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, {
      userId: { required: true }, from: { required: true }, to: { required: true },
      amount: { type: 'number', min: 0, required: true },
    });
    const { rows } = await query(
      `INSERT INTO salary_payments (clinic_id, user_id, period_from, period_to, amount, details, status, paid_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'paid',now(),$7) RETURNING *`,
      [req.user.clinicId, d.userId, d.from, d.to, d.amount.toFixed(2),
        req.body.details ? JSON.stringify(req.body.details) : null, req.user.id]);
    await writeAudit({ ...auditCtx(req), action: 'salary_payment', entityType: 'salary_payment', entityId: rows[0].id });
    created(res, rows[0], 'Виплату зафіксовано');
  }),
);

salaryRouter.get(
  '/payments',
  requirePermission('salary.view'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT sp.*, u.first_name, u.last_name FROM salary_payments sp
         JOIN users u ON u.id=sp.user_id WHERE sp.clinic_id=$1 ORDER BY sp.created_at DESC LIMIT 100`,
      [req.user.clinicId]);
    ok(res, rows);
  }),
);
