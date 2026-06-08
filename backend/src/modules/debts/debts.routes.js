import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';

export const debtsRouter = Router();
debtsRouter.use(authMiddleware);

debtsRouter.get(
  '/',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE d.clinic_id=$1`;
    if (req.query.status) { params.push(req.query.status); where += ` AND d.status=$${params.length}`; }
    else where += ` AND d.status='active'`;
    if (req.query.ownerId) { params.push(req.query.ownerId); where += ` AND d.owner_id=$${params.length}`; }
    const { rows } = await query(
      `SELECT d.*, o.first_name, o.last_name, o.phone FROM debts d
         JOIN owners o ON o.id=d.owner_id ${where} ORDER BY d.created_at DESC`, params);
    ok(res, rows);
  }),
);
