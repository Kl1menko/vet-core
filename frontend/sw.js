// Service Worker (ТЗ §16). Кешуємо лише статику застосунку (app shell).
// API НЕ кешуємо — фінансові/медичні дані мають бути завжди свіжими.
const CACHE = 'vetcore-v3';
const SHELL = [
  '/', '/index.html', '/manifest.json', '/assets/images/logo-vetcore.png',
  '/assets/fonts/epilogue-latin-var.woff2',
  '/css/reset.css', '/css/variables.css', '/css/layout.css', '/css/components.css', '/css/pages.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // API і WebSocket — лише мережа (не кешуємо)
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws') || url.pathname.startsWith('/uploads')) return;

  // Статика / JS-модулі: cache-first з фоновим оновленням
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((resp) => {
          if (resp.ok) caches.open(CACHE).then((c) => c.put(request, resp.clone()));
          return resp;
        }).catch(() => cached || caches.match('/index.html'));
        return cached || network;
      }),
    );
  }
});
