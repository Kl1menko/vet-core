import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const drugsRouter = Router();
drugsRouter.use(authMiddleware);

// Перелік препаратів із сумарним залишком (для аптеки)
drugsRouter.get(
  '/',
  requirePermission('warehouse.view'),
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE d.clinic_id=$1 AND d.deleted_at IS NULL`;
    if (req.query.search && req.query.search.trim().length >= 2) {
      params.push(`%${req.query.search.trim()}%`);
      where += ` AND (d.name ILIKE $${params.length} OR d.barcode ILIKE $${params.length} OR d.active_substance ILIKE $${params.length})`;
    }
    if (req.query.lowStock === 'true') where += ` AND COALESCE(st.qty,0) <= d.min_stock`;
    const { rows } = await query(
      `SELECT d.*, c.name AS category_name, COALESCE(st.qty,0) AS stock_qty,
              st.nearest_expiration
         FROM drugs d
         LEFT JOIN drug_categories c ON c.id=d.category_id
         LEFT JOIN (
            SELECT drug_id, SUM(quantity) AS qty, MIN(expiration_date) FILTER (WHERE quantity>0) AS nearest_expiration
              FROM stock_batches WHERE clinic_id=$1 GROUP BY drug_id
         ) st ON st.drug_id=d.id
         ${where} ORDER BY d.name`, params);
    ok(res, rows);
  }),
);

drugsRouter.get(
  '/categories',
  requirePermission('warehouse.view'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT * FROM drug_categories WHERE clinic_id=$1 ORDER BY name`, [req.user.clinicId]);
    ok(res, rows);
  }),
);

drugsRouter.post(
  '/categories',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, { name: { required: true, max: 255 } });
    const { rows } = await query(`INSERT INTO drug_categories (clinic_id, name) VALUES ($1,$2) RETURNING *`,
      [req.user.clinicId, d.name]);
    created(res, rows[0]);
  }),
);

const schema = {
  name: { required: true, max: 255 },
  categoryId: {}, activeSubstance: { max: 255 }, manufacturer: { max: 255 }, barcode: { max: 100 },
  unit: { required: true, max: 50 },
  sellingPrice: { type: 'number', min: 0, default: 0 },
  purchasePrice: { type: 'number', min: 0, default: 0 },
  minStock: { type: 'number', min: 0, default: 0 },
  isPrescriptionRequired: { type: 'boolean', default: false },
};

drugsRouter.post(
  '/',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, schema);
    const { rows } = await query(
      `INSERT INTO drugs (clinic_id, category_id, name, active_substance, manufacturer, barcode, unit,
                          selling_price, purchase_price, min_stock, is_prescription_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.clinicId, d.categoryId || null, d.name, d.activeSubstance || null, d.manufacturer || null,
        d.barcode || null, d.unit, d.sellingPrice || 0, d.purchasePrice || 0, d.minStock || 0, d.isPrescriptionRequired || false]);
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'drug', entityId: rows[0].id });
    created(res, rows[0]);
  }),
);

drugsRouter.put(
  '/:id',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM drugs WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Препарат не знайдено');
    const c = ex[0];
    const d = validate({
      name: c.name, categoryId: c.category_id, activeSubstance: c.active_substance, manufacturer: c.manufacturer,
      barcode: c.barcode, unit: c.unit, sellingPrice: Number(c.selling_price), purchasePrice: Number(c.purchase_price),
      minStock: Number(c.min_stock), isPrescriptionRequired: c.is_prescription_required, ...req.body,
    }, schema);
    const { rows } = await query(
      `UPDATE drugs SET category_id=$1, name=$2, active_substance=$3, manufacturer=$4, barcode=$5, unit=$6,
              selling_price=$7, purchase_price=$8, min_stock=$9, is_prescription_required=$10, updated_at=now()
        WHERE id=$11 RETURNING *`,
      [d.categoryId || null, d.name, d.activeSubstance || null, d.manufacturer || null, d.barcode || null,
        d.unit, d.sellingPrice || 0, d.purchasePrice || 0, d.minStock || 0, d.isPrescriptionRequired || false, req.params.id]);
    ok(res, rows[0]);
  }),
);

drugsRouter.delete(
  '/:id',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    await query(`UPDATE drugs SET deleted_at=now(), is_active=false WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinicId]);
    ok(res, {}, 'Препарат видалено');
  }),
);
