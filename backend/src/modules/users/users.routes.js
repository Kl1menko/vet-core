import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { hashPassword } from '../../config/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const usersRouter = Router();
usersRouter.use(authMiddleware);

const SELECT = `
  SELECT u.id, u.first_name, u.last_name, u.middle_name, u.phone, u.email,
         u.role_id, r.name AS role_name, r.code AS role_code,
         u.branch_id, u.is_active, u.last_login_at, u.created_at
    FROM users u LEFT JOIN roles r ON r.id = u.role_id`;

usersRouter.get(
  '/',
  requirePermission('staff.view'),
  asyncHandler(async (req, res) => {
    const { role } = req.query;
    const params = [req.user.clinicId];
    let where = `WHERE u.clinic_id = $1 AND u.deleted_at IS NULL`;
    if (role) { params.push(role); where += ` AND r.code = $${params.length}`; }
    const { rows } = await query(`${SELECT} ${where} ORDER BY u.last_name, u.first_name`, params);
    ok(res, rows);
  }),
);

// Доктори — потрібні календарю, дозволено всім авторизованим
usersRouter.get(
  '/doctors',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `${SELECT} WHERE u.clinic_id = $1 AND u.deleted_at IS NULL AND u.is_active = true
         AND r.code = 'doctor' ORDER BY u.last_name`,
      [req.user.clinicId],
    );
    ok(res, rows);
  }),
);

usersRouter.post(
  '/',
  requirePermission('staff.manage'),
  asyncHandler(async (req, res) => {
    const data = validate(req.body, {
      firstName: { required: true, max: 100 },
      lastName: { required: true, max: 100 },
      middleName: { max: 100 },
      phone: { max: 50 },
      email: { required: true, email: true },
      password: { required: true, min: 6 },
      roleId: { required: true },
    });
    const hash = await hashPassword(data.password);
    const { rows } = await query(
      `INSERT INTO users (clinic_id, branch_id, first_name, last_name, middle_name, phone, email, password_hash, role_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.user.clinicId, req.user.branchId, data.firstName, data.lastName, data.middleName || null,
        data.phone || null, data.email, hash, data.roleId],
    );
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'user', entityId: rows[0].id });
    const { rows: full } = await query(`${SELECT} WHERE u.id = $1`, [rows[0].id]);
    created(res, full[0]);
  }),
);

usersRouter.put(
  '/:id',
  requirePermission('staff.manage'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT id FROM users WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Користувача не знайдено');

    const data = validate(req.body, {
      firstName: { max: 100 }, lastName: { max: 100 }, middleName: { max: 100 },
      phone: { max: 50 }, roleId: {}, isActive: { type: 'boolean' },
    });
    await query(
      `UPDATE users SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name),
              middle_name=COALESCE($3,middle_name), phone=COALESCE($4,phone),
              role_id=COALESCE($5,role_id), is_active=COALESCE($6,is_active), updated_at=now()
        WHERE id=$7`,
      [data.firstName ?? null, data.lastName ?? null, data.middleName ?? null, data.phone ?? null,
        data.roleId ?? null, req.body.isActive ?? null, req.params.id],
    );
    await writeAudit({ ...auditCtx(req), action: 'update', entityType: 'user', entityId: req.params.id });
    const { rows: full } = await query(`${SELECT} WHERE u.id = $1`, [req.params.id]);
    ok(res, full[0]);
  }),
);

usersRouter.delete(
  '/:id',
  requirePermission('staff.manage'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) throw ApiError.badRequest('Не можна видалити себе');
    await query(`UPDATE users SET deleted_at = now(), is_active = false WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinicId]);
    await writeAudit({ ...auditCtx(req), action: 'delete', entityType: 'user', entityId: req.params.id });
    ok(res, {}, 'Користувача деактивовано');
  }),
);
