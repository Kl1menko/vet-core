import { Router } from 'express';
import { query, withTransaction } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';
import { writeOffFEFO } from './stock.service.js';
import { broadcast } from '../../realtime/ws.js';

export const warehouseRouter = Router();
warehouseRouter.use(authMiddleware);

// Залишки по партіях
warehouseRouter.get(
  '/stock',
  requirePermission('warehouse.view'),
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE b.clinic_id=$1 AND b.quantity > 0`;
    if (req.query.drugId) { params.push(req.query.drugId); where += ` AND b.drug_id=$${params.length}`; }
    if (req.query.expiringSoon === 'true') where += ` AND b.expiration_date IS NOT NULL AND b.expiration_date <= current_date + interval '30 days'`;
    const { rows } = await query(
      `SELECT b.*, d.name AS drug_name, d.unit AS drug_unit, s.name AS supplier_name
         FROM stock_batches b
         JOIN drugs d ON d.id=b.drug_id
         LEFT JOIN suppliers s ON s.id=b.supplier_id
         ${where} ORDER BY d.name, b.expiration_date NULLS LAST`, params);
    ok(res, rows);
  }),
);

// Прихід товару (ТЗ §12.4)
warehouseRouter.post(
  '/income',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, {
      drugId: { required: true },
      supplierId: {},
      batchNumber: { max: 100 },
      quantity: { type: 'number', min: 0, required: true },
      purchasePrice: { type: 'number', min: 0, default: 0 },
      sellingPrice: { type: 'number', min: 0, default: 0 },
      expirationDate: {},
    });
    if (!(d.quantity > 0)) throw ApiError.badRequest('Кількість має бути більшою за 0');

    const result = await withTransaction(async (c) => {
      const { rows: drug } = await c.query(`SELECT id, unit FROM drugs WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
        [d.drugId, req.user.clinicId]);
      if (!drug[0]) throw ApiError.badRequest('Препарат не знайдено');

      const { rows } = await c.query(
        `INSERT INTO stock_batches (clinic_id, branch_id, drug_id, supplier_id, batch_number, quantity, initial_quantity,
                                    unit, purchase_price, selling_price, expiration_date)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10) RETURNING *`,
        [req.user.clinicId, req.user.branchId, d.drugId, d.supplierId || null, d.batchNumber || null,
          d.quantity, drug[0].unit, d.purchasePrice || 0, d.sellingPrice || 0, d.expirationDate || null]);

      await c.query(
        `INSERT INTO stock_movements (clinic_id, branch_id, drug_id, batch_id, type, quantity, reason, created_by)
         VALUES ($1,$2,$3,$4,'income',$5,'Прихід товару',$6)`,
        [req.user.clinicId, req.user.branchId, d.drugId, rows[0].id, d.quantity, req.user.id]);
      return rows[0];
    });
    await writeAudit({ ...auditCtx(req), action: 'income', entityType: 'stock_batch', entityId: result.id, newValue: { quantity: d.quantity } });
    created(res, result, 'Прихід оформлено');
  }),
);

// Списання (FEFO або з конкретної партії)
warehouseRouter.post(
  '/write-off',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, {
      drugId: { required: true },
      quantity: { type: 'number', min: 0, required: true },
      reason: { max: 500, default: 'Ручне списання' },
      allowExpired: { type: 'boolean', default: false },
    });
    const applied = await withTransaction((c) => writeOffFEFO(c, {
      clinicId: req.user.clinicId, branchId: req.user.branchId, drugId: d.drugId, quantity: d.quantity,
      reason: d.reason, createdBy: req.user.id, allowExpired: d.allowExpired,
    }));
    await writeAudit({ ...auditCtx(req), action: 'write_off', entityType: 'drug', entityId: d.drugId, newValue: { quantity: d.quantity } });
    // сповіщення про малий залишок (ТЗ §13.4 крок 5)
    const { rows: st } = await query(
      `SELECT d.name, d.min_stock, COALESCE(SUM(b.quantity),0) AS qty
         FROM drugs d LEFT JOIN stock_batches b ON b.drug_id=d.id AND b.clinic_id=d.clinic_id
        WHERE d.id=$1 GROUP BY d.id`, [d.drugId]);
    if (st[0] && Number(st[0].qty) <= Number(st[0].min_stock)) {
      broadcast(req.user.clinicId, 'stock.low', { drugId: d.drugId, name: st[0].name, qty: Number(st[0].qty) });
    }
    ok(res, { applied }, 'Списано');
  }),
);

// Корекція залишку конкретної партії (інвентаризація)
warehouseRouter.post(
  '/correction',
  requirePermission('warehouse.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, {
      batchId: { required: true },
      newQuantity: { type: 'number', min: 0, required: true },
      reason: { max: 500, default: 'Корекція' },
    });
    const result = await withTransaction(async (c) => {
      const { rows: b } = await c.query(`SELECT * FROM stock_batches WHERE id=$1 AND clinic_id=$2`,
        [d.batchId, req.user.clinicId]);
      if (!b[0]) throw ApiError.notFound('Партію не знайдено');
      const diff = d.newQuantity - Number(b[0].quantity);
      await c.query(`UPDATE stock_batches SET quantity=$1, updated_at=now() WHERE id=$2`, [d.newQuantity, d.batchId]);
      await c.query(
        `INSERT INTO stock_movements (clinic_id, branch_id, drug_id, batch_id, type, quantity, reason, created_by)
         VALUES ($1,$2,$3,$4,'correction',$5,$6,$7)`,
        [req.user.clinicId, b[0].branch_id, b[0].drug_id, d.batchId, diff, d.reason, req.user.id]);
      return { batchId: d.batchId, diff };
    });
    await writeAudit({ ...auditCtx(req), action: 'correction', entityType: 'stock_batch', entityId: d.batchId });
    ok(res, result, 'Залишок скориговано');
  }),
);

// Журнал рухів
warehouseRouter.get(
  '/movements',
  requirePermission('warehouse.view'),
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE m.clinic_id=$1`;
    if (req.query.drugId) { params.push(req.query.drugId); where += ` AND m.drug_id=$${params.length}`; }
    if (req.query.type) { params.push(req.query.type); where += ` AND m.type=$${params.length}`; }
    const { rows } = await query(
      `SELECT m.*, d.name AS drug_name, u.first_name AS user_first_name, u.last_name AS user_last_name
         FROM stock_movements m
         JOIN drugs d ON d.id=m.drug_id
         LEFT JOIN users u ON u.id=m.created_by
         ${where} ORDER BY m.created_at DESC LIMIT 200`, params);
    ok(res, rows);
  }),
);
