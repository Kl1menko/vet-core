// Окремий API/стан для клієнтського кабінету (ТЗ §5). Свій токен, щоб не плутати зі staff.
const API_BASE = '/api/client';
const KEY = 'clientToken';

export function getClientToken() { return localStorage.getItem(KEY); }
export function setClientToken(t) { localStorage.setItem(KEY, t); }
export function clearClientToken() { localStorage.removeItem(KEY); }
export function isClientAuthed() { return !!getClientToken(); }

async function req(endpoint, options = {}) {
  const token = getClientToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  let resp;
  try { resp = await fetch(`${API_BASE}${endpoint}`, { ...options, headers }); }
  catch { throw { code: 'NETWORK', message: "Немає з'єднання" }; }
  let result = {};
  try { result = await resp.json(); } catch { /* empty */ }
  if (resp.status === 401) { clearClientToken(); throw result.error || { code: 'UNAUTHORIZED', message: 'Сесію завершено' }; }
  if (!resp.ok || result.success === false) throw result.error || { code: 'ERROR', message: 'Помилка' };
  return result.data;
}

export const ClientApi = {
  login: (phone) => req('/login', { method: 'POST', body: JSON.stringify({ phone }) }),
  verify: (phone, code) => req('/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  pets: () => req('/pets'),
  pet: (id) => req(`/pets/${id}`),
  appointments: () => req('/appointments'),
  invoices: () => req('/invoices'),
  discountCard: () => req('/discount-card'),
};
