import { Router } from 'express';
import { query, withTransaction } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const rolesRouter = Router();
rolesRouter.use(authMiddleware);

async function roleWithPerms(id, clinicId) {
  const { rows } = await query(
    `SELECT r.*,
            COALESCE((SELECT array_agg(p.code) FROM role_permissions rp
                        JOIN permissions p ON p.id = rp.permission_id
                       WHERE rp.role_id = r.id), '{}') AS permissions
       FROM roles r WHERE r.id = $1 AND (r.clinic_id = $2 OR r.clinic_id IS NULL)`,
    [id, clinicId],
  );
  return rows[0];
}

rolesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT r.id, r.name, r.code, r.description, r.is_system,
              COALESCE((SELECT array_agg(p.code) FROM role_permissions rp
                          JOIN permissions p ON p.id = rp.permission_id
                         WHERE rp.role_id = r.id), '{}') AS permissions
         FROM roles r
        WHERE r.clinic_id = $1 OR r.clinic_id IS NULL
        ORDER BY r.is_system DESC, r.name`,
      [req.user.clinicId],
    );
    ok(res, rows);
  }),
);

rolesRouter.post(
  '/',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const data = validate(req.body, {
      name: { required: true, max: 100 },
      code: { required: true, max: 100 },
      description: { max: 500 },
      permissions: {},
    });
    const role = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO roles (clinic_id, name, code, description) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.user.clinicId, data.name, data.code, data.description || null],
      );
      const r = rows[0];
      const perms = Array.isArray(req.body.permissions) ? req.body.permissions : [];
      for (const code of perms) {
        await c.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE code = $2 ON CONFLICT DO NOTHING`,
          [r.id, code],
        );
      }
      return r;
    });
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'role', entityId: role.id });
    created(res, await roleWithPerms(role.id, req.user.clinicId));
  }),
);

rolesRouter.put(
  '/:id',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const existing = await roleWithPerms(req.params.id, req.user.clinicId);
    if (!existing) throw ApiError.notFound('Роль не знайдено');
    if (existing.is_system) throw ApiError.forbidden('Системну роль не можна змінювати');

    const data = validate(req.body, {
      name: { max: 100 },
      description: { max: 500 },
    });
    await withTransaction(async (c) => {
      await c.query(`UPDATE roles SET name = COALESCE($1,name), description = COALESCE($2,description), updated_at = now() WHERE id = $3`,
        [data.name ?? null, data.description ?? null, req.params.id]);
      if (Array.isArray(req.body.permissions)) {
        await c.query(`DELETE FROM role_permissions WHERE role_id = $1`, [req.params.id]);
        for (const code of req.body.permissions) {
          await c.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             SELECT $1, id FROM permissions WHERE code = $2 ON CONFLICT DO NOTHING`,
            [req.params.id, code],
          );
        }
      }
    });
    await writeAudit({ ...auditCtx(req), action: 'update', entityType: 'role', entityId: req.params.id });
    ok(res, await roleWithPerms(req.params.id, req.user.clinicId));
  }),
);
