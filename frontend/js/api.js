// Єдиний API-wrapper (ТЗ §11.3, §23.7).
const API_BASE_URL = '/api';

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export function getToken() { return localStorage.getItem('accessToken'); }
export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}
export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

let refreshing = null;

async function tryRefresh() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setTokens(res.data); return true; }
        return false;
      })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function apiRequest(endpoint, options = {}, isRetry = false) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  // дозволяємо явно прибрати заголовок (напр. Content-Type для multipart)
  for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  } catch {
    throw { code: 'NETWORK', message: "Немає з'єднання з сервером" };
  }

  let result = {};
  try { result = await response.json(); } catch { /* порожня відповідь */ }

  if (response.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiRequest(endpoint, options, true);
    clearTokens();
    if (onUnauthorized) onUnauthorized();
    throw result.error || { code: 'UNAUTHORIZED', message: 'Сесію завершено' };
  }

  if (!response.ok || result.success === false) {
    throw result.error || { code: 'ERROR', message: 'Помилка запиту' };
  }
  return result.data;
}

function qs(params) {
  const clean = Object.fromEntries(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : '';
}

export const Api = {
  get: (endpoint, params) => apiRequest(`${endpoint}${qs(params)}`, { method: 'GET' }),
  post: (endpoint, data) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(data || {}) }),
  put: (endpoint, data) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(data || {}) }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
  // multipart: НЕ ставимо Content-Type — браузер сам додасть boundary.
  upload: (endpoint, formData) => apiRequest(endpoint, { method: 'POST', body: formData, headers: { 'Content-Type': undefined } }),
};

// Завантаження файлу (CSV/PDF) з Authorization-заголовком → зберегти на диск.
export async function downloadFile(endpoint, filename) {
  return saveBlob(endpoint, filename, { method: 'GET' });
}

// Те саме, але через POST із тілом (напр. конструктор звітів).
export async function downloadFilePost(endpoint, filename, data) {
  return saveBlob(endpoint, filename, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {}),
  });
}

async function saveBlob(endpoint, filename, options) {
  const token = getToken();
  const resp = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!resp.ok) throw { code: 'ERROR', message: 'Не вдалося завантажити файл' };
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
