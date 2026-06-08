import { verifyToken } from '../config/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { query } from '../config/database.js';

/**
 * Перевіряє Bearer-токен, підвантажує актуального користувача + його permissions
 * (ТЗ §23.12 — не довіряти лише payload, перевіряти на backend).
 */
export async function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Відсутній токен');

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized('Недійсний або прострочений токен');
    }
    if (payload.type === 'refresh') throw ApiError.unauthorized('Очікувався access-токен');

    const { rows } = await query(
      `SELECT u.id, u.clinic_id, u.branch_id, u.first_name, u.last_name,
              u.middle_name, u.phone, u.email, u.role_id, u.is_active,
              r.code AS role_code,
              COALESCE(
                (SELECT array_agg(p.code)
                   FROM role_permissions rp
                   JOIN permissions p ON p.id = rp.permission_id
                  WHERE rp.role_id = u.role_id),
                '{}'
              ) AS permissions
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [payload.sub],
    );

    const user = rows[0];
    if (!user || !user.is_active) throw ApiError.unauthorized('Користувача деактивовано');

    req.user = {
      id: user.id,
      clinicId: user.clinic_id,
      branchId: user.branch_id,
      firstName: user.first_name,
      lastName: user.last_name,
      middleName: user.middle_name,
      phone: user.phone,
      email: user.email,
      roleId: user.role_id,
      role: user.role_code,
      permissions: user.permissions || [],
    };
    next();
  } catch (err) {
    next(err);
  }
}
