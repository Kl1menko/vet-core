import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';

export const discountRouter = Router();
discountRouter.use(authMiddleware);

discountRouter.get(
  '/',
  requirePermission('finance.view', 'owners.view'),
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE dc.clinic_id=$1 AND dc.is_active=true`;
    if (req.query.ownerId) { params.push(req.query.ownerId); where += ` AND dc.owner_id=$${params.length}`; }
    const { rows } = await query(
      `SELECT dc.*, o.first_name, o.last_name, o.phone FROM discount_cards dc
         JOIN owners o ON o.id=dc.owner_id ${where} ORDER BY dc.created_at DESC`, params);
    ok(res, rows);
  }),
);

discountRouter.post(
  '/',
  requirePermission('finance.manage', 'owners.edit'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, {
      ownerId: { required: true },
      cardNumber: { required: true, max: 100 },
      discountPercent: { type: 'number', min: 0, max: 100, default: 0 },
    });
    const { rows } = await query(
      `INSERT INTO discount_cards (clinic_id, owner_id, card_number, discount_percent)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.clinicId, d.ownerId, d.cardNumber, d.discountPercent || 0]);
    ok(res, rows[0], 'Картку створено', 201);
  }),
);

discountRouter.put(
  '/:id',
  requirePermission('finance.manage', 'owners.edit'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, { discountPercent: { type: 'number', min: 0, max: 100 } });
    const { rows } = await query(
      `UPDATE discount_cards SET discount_percent=COALESCE($1,discount_percent) WHERE id=$2 AND clinic_id=$3 RETURNING *`,
      [d.discountPercent ?? null, req.params.id, req.user.clinicId]);
    if (!rows[0]) throw ApiError.notFound('Картку не знайдено');
    ok(res, rows[0]);
  }),
);
