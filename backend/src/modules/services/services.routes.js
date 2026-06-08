import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const servicesRouter = Router();
servicesRouter.use(authMiddleware);

// Категорії прайсу
servicesRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM service_categories WHERE clinic_id=$1 AND is_active=true ORDER BY sort_order, name`,
      [req.user.clinicId]);
    ok(res, rows);
  }),
);

servicesRouter.post(
  '/categories',
  requirePermission('settings.manage', 'finance.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, { name: { required: true, max: 255 }, sortOrder: { type: 'number', default: 0 } });
    const { rows } = await query(
      `INSERT INTO service_categories (clinic_id, name, sort_order) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.clinicId, d.name, d.sortOrder || 0]);
    created(res, rows[0]);
  }),
);

// Послуги (прайс-лист)
servicesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE s.clinic_id=$1 AND s.deleted_at IS NULL`;
    if (req.query.categoryId) { params.push(req.query.categoryId); where += ` AND s.category_id=$${params.length}`; }
    if (req.query.search && req.query.search.trim().length >= 2) {
      params.push(`%${req.query.search.trim()}%`);
      where += ` AND (s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`;
    }
    const { rows } = await query(
      `SELECT s.*, c.name AS category_name FROM services s
         LEFT JOIN service_categories c ON c.id=s.category_id
         ${where} ORDER BY s.name`, params);
    ok(res, rows);
  }),
);

const svcSchema = {
  name: { required: true, max: 255 },
  categoryId: {},
  code: { max: 100 },
  description: { max: 1000 },
  price: { type: 'number', min: 0, required: true },
  costPrice: { type: 'number', min: 0, default: 0 },
  durationMinutes: { type: 'number', min: 0, default: 0 },
};

servicesRouter.post(
  '/',
  requirePermission('finance.manage', 'settings.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, svcSchema);
    const { rows } = await query(
      `INSERT INTO services (clinic_id, category_id, name, code, description, price, cost_price, duration_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.clinicId, d.categoryId || null, d.name, d.code || null, d.description || null,
        d.price, d.costPrice || 0, d.durationMinutes || 0]);
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'service', entityId: rows[0].id });
    created(res, rows[0]);
  }),
);

servicesRouter.put(
  '/:id',
  requirePermission('finance.manage', 'settings.manage'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM services WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Послугу не знайдено');
    const c = ex[0];
    const d = validate({
      name: c.name, categoryId: c.category_id, code: c.code, description: c.description,
      price: Number(c.price), costPrice: Number(c.cost_price), durationMinutes: c.duration_minutes, ...req.body,
    }, svcSchema);
    const { rows } = await query(
      `UPDATE services SET category_id=$1, name=$2, code=$3, description=$4, price=$5, cost_price=$6,
              duration_minutes=$7, updated_at=now() WHERE id=$8 RETURNING *`,
      [d.categoryId || null, d.name, d.code || null, d.description || null, d.price,
        d.costPrice || 0, d.durationMinutes || 0, req.params.id]);
    await writeAudit({ ...auditCtx(req), action: 'update', entityType: 'service', entityId: req.params.id });
    ok(res, rows[0]);
  }),
);

servicesRouter.delete(
  '/:id',
  requirePermission('finance.manage', 'settings.manage'),
  asyncHandler(async (req, res) => {
    await query(`UPDATE services SET deleted_at=now(), is_active=false WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinicId]);
    await writeAudit({ ...auditCtx(req), action: 'delete', entityType: 'service', entityId: req.params.id });
    ok(res, {}, 'Послугу видалено');
  }),
);
