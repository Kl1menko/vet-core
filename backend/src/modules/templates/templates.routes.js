import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';

export const templatesRouter = Router();
templatesRouter.use(authMiddleware);

// type: appointment|diagnosis|procedure|vaccination|recommendation|analysis|message|invoice|document
templatesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE clinic_id=$1 AND deleted_at IS NULL AND is_active=true`;
    if (req.query.type) { params.push(req.query.type); where += ` AND type=$${params.length}`; }
    const { rows } = await query(`SELECT * FROM templates ${where} ORDER BY type, name`, params);
    ok(res, rows);
  }),
);

const schema = { type: { required: true, max: 50 }, name: { required: true, max: 255 }, content: { required: true } };

templatesRouter.post(
  '/',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, schema);
    const { rows } = await query(
      `INSERT INTO templates (clinic_id, type, name, content, variables) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.clinicId, d.type, d.name, d.content, req.body.variables ? JSON.stringify(req.body.variables) : null]);
    created(res, rows[0]);
  }),
);

templatesRouter.put(
  '/:id',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM templates WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Шаблон не знайдено');
    const c = ex[0];
    const d = validate({ type: c.type, name: c.name, content: c.content, ...req.body }, schema);
    const { rows } = await query(
      `UPDATE templates SET type=$1, name=$2, content=$3, updated_at=now() WHERE id=$4 RETURNING *`,
      [d.type, d.name, d.content, req.params.id]);
    ok(res, rows[0]);
  }),
);

templatesRouter.delete(
  '/:id',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    await query(`UPDATE templates SET deleted_at=now(), is_active=false WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinicId]);
    ok(res, {}, 'Шаблон видалено');
  }),
);
