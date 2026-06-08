import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

export const permissionsRouter = Router();
permissionsRouter.use(authMiddleware);

permissionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`SELECT id, code, name, description FROM permissions ORDER BY code`);
    ok(res, rows);
  }),
);
