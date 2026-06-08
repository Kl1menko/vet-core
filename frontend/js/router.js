// Клієнтський роутер на History API (ТЗ §11.1) з підтримкою :параметрів.
const routes = [];
let notFoundHandler = null;
let beforeEach = null;

export function defineRoutes(defs) {
  for (const [pattern, handler] of Object.entries(defs)) {
    if (pattern === '*') { notFoundHandler = handler; continue; }
    routes.push(compile(pattern, handler));
  }
}

export function setBeforeEach(fn) { beforeEach = fn; }

function compile(pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$',
  );
  return { regex, keys, handler };
}

export function navigate(path) {
  if (path === location.pathname) return renderRoute(path);
  history.pushState({}, '', path);
  renderRoute(path);
}

export function renderRoute(path = location.pathname) {
  if (beforeEach) {
    const redirect = beforeEach(path);
    if (redirect && redirect !== path) return navigate(redirect);
  }
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return r.handler({ params, path });
    }
  }
  if (notFoundHandler) notFoundHandler({ path });
}

window.addEventListener('popstate', () => renderRoute(location.pathname));
