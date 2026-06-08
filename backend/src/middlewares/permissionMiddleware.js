import { ApiError } from '../utils/ApiError.js';

/**
 * Перевірка наявності хоча б одного з потрібних permissions.
 * Роль 'superadmin' і 'owner' (власник клініки) мають повний доступ.
 */
export function requirePermission(...required) {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) return next(ApiError.unauthorized());

    if (user.role === 'superadmin' || user.role === 'owner') return next();

    const has = required.some((code) => user.permissions.includes(code));
    if (!has) return next(ApiError.forbidden(`Потрібен дозвіл: ${required.join(' або ')}`));
    next();
  };
}

/** Тільки суперадмін. */
export function requireSuperadmin(req, _res, next) {
  if (req.user?.role !== 'superadmin') return next(ApiError.forbidden());
  next();
}
