import jwt from 'jsonwebtoken';
import { query } from '../../config/database.js';
import {
  hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyToken,
} from '../../config/auth.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

function publicUser(u) {
  return {
    id: u.id,
    clinicId: u.clinic_id,
    branchId: u.branch_id,
    firstName: u.first_name,
    lastName: u.last_name,
    middleName: u.middle_name,
    phone: u.phone,
    email: u.email,
    role: u.role_code,
    permissions: u.permissions || [],
    isActive: u.is_active,
  };
}

async function loadUserById(id) {
  const { rows } = await query(
    `SELECT u.*, r.code AS role_code,
            COALESCE((SELECT array_agg(p.code) FROM role_permissions rp
                        JOIN permissions p ON p.id = rp.permission_id
                       WHERE rp.role_id = u.role_id), '{}') AS permissions
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id],
  );
  return rows[0];
}

export async function login(identifier, password) {
  // вхід за email або телефоном (ТЗ §6.1)
  const { rows } = await query(
    `SELECT u.*, r.code AS role_code,
            COALESCE((SELECT array_agg(p.code) FROM role_permissions rp
                        JOIN permissions p ON p.id = rp.permission_id
                       WHERE rp.role_id = u.role_id), '{}') AS permissions
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
      WHERE (lower(u.email) = lower($1) OR u.phone = $1) AND u.deleted_at IS NULL
      LIMIT 1`,
    [identifier],
  );
  const user = rows[0];
  if (!user) throw ApiError.unauthorized('Невірний логін або пароль');
  if (!user.is_active) throw ApiError.forbidden('Користувача деактивовано');

  const okPass = await verifyPassword(password, user.password_hash);
  if (!okPass) throw ApiError.unauthorized('Невірний логін або пароль');

  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  return issueTokens(user);
}

export function issueTokens(user) {
  const payload = { sub: user.id, clinicId: user.clinic_id, role: user.role_code };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: publicUser(user),
  };
}

export async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Недійсний refresh-токен');
  }
  if (payload.type !== 'refresh') throw ApiError.unauthorized('Очікувався refresh-токен');

  const user = await loadUserById(payload.sub);
  if (!user || !user.is_active) throw ApiError.unauthorized('Користувача деактивовано');
  return issueTokens(user);
}

export async function me(userId) {
  const user = await loadUserById(userId);
  if (!user) throw ApiError.notFound('Користувача не знайдено');
  return publicUser(user);
}

export async function changePassword(userId, oldPassword, newPassword) {
  const user = await loadUserById(userId);
  if (!user) throw ApiError.notFound();
  const okPass = await verifyPassword(oldPassword, user.password_hash);
  if (!okPass) throw ApiError.badRequest('Старий пароль невірний');
  const hash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [hash, userId]);
}

// Відновлення пароля (ТЗ §6.1, §10.1). Токен — JWT scope=reset, TTL 30 хв.
// Реальний email-канал — друга черга; у dev повертаємо токен у відповіді.
export async function requestPasswordReset(email) {
  const { rows } = await query(
    `SELECT id FROM users WHERE lower(email)=lower($1) AND deleted_at IS NULL AND is_active=true LIMIT 1`, [email]);
  if (!rows[0]) return null; // не розкриваємо існування акаунта
  return jwt.sign({ sub: rows[0].id, scope: 'reset' }, env.jwt.secret, { expiresIn: '30m' });
}

export async function resetPassword(token, newPassword) {
  let payload;
  try { payload = verifyToken(token); } catch { throw ApiError.badRequest('Недійсний або прострочений токен'); }
  if (payload.scope !== 'reset') throw ApiError.badRequest('Невірний токен скидання');
  const hash = await hashPassword(newPassword);
  const { rowCount } = await query(
    `UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2 AND deleted_at IS NULL`, [hash, payload.sub]);
  if (!rowCount) throw ApiError.notFound('Користувача не знайдено');
}
