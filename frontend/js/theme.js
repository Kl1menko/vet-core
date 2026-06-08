// Перемикання світла/темна тема. Зберігається в localStorage; за замовч. — системна.
const KEY = 'theme';

export function getTheme() {
  return localStorage.getItem(KEY)
    || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f1f1f1');
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

// Викликати якнайраніше, щоб не блимало.
export function initTheme() { applyTheme(getTheme()); }
