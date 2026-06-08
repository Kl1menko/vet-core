import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';

export const suppliersRouter = Router();
suppliersRouter.use(authMiddleware);

suppliersRouter.get(
  '/',
  requirePermission('warehouse.view'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM suppliers WHERE clinic_id=$1 AND deleted_at IS NULL ORDER BY name`,
      [req.user.clinicId]);
    ok(res, rows);
  }),
);

const schema = {
  name: { required: true, max: 255 },
  contactPerson: { max: 255 }, phone: { max: 50 }, email: { max: 255 },
  address: { max: 1000 }, comment: { max: 1000 },
};

suppliersRouter.post(
  '/',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, schema);
    const { rows } = await query(
      `INSERT INTO suppliers (clinic_id, name, contact_person, phone, email, address, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.clinicId, d.name, d.contactPerson || null, d.phone || null, d.email || null, d.address || null, d.comment || null]);
    created(res, rows[0]);
  }),
);

suppliersRouter.put(
  '/:id',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM suppliers WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Постачальника не знайдено');
    const c = ex[0];
    const d = validate({ name: c.name, contactPerson: c.contact_person, phone: c.phone, email: c.email,
      address: c.address, comment: c.comment, ...req.body }, schema);
    const { rows } = await query(
      `UPDATE suppliers SET name=$1, contact_person=$2, phone=$3, email=$4, address=$5, comment=$6, updated_at=now()
        WHERE id=$7 RETURNING *`,
      [d.name, d.contactPerson || null, d.phone || null, d.email || null, d.address || null, d.comment || null, req.params.id]);
    ok(res, rows[0]);
  }),
);

suppliersRouter.delete(
  '/:id',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    await query(`UPDATE suppliers SET deleted_at=now(), is_active=false WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinicId]);
    ok(res, {}, 'Постачальника видалено');
  }),
);
