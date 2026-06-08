import { Store } from './store.js';

const FULL_ACCESS_ROLES = ['superadmin', 'owner'];

// Перевірка прав на frontend (ховаємо кнопки/сторінки — ТЗ §7).
// Backend усе одно перевіряє повторно (ТЗ §23.12).
export function can(...codes) {
  const user = Store.get('user');
  if (!user) return false;
  if (FULL_ACCESS_ROLES.includes(user.role)) return true;
  return codes.some((c) => (user.permissions || []).includes(c));
}

export function hasRole(...roles) {
  const user = Store.get('user');
  return user ? roles.includes(user.role) : false;
}
