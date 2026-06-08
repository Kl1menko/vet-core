// Реєстрація service worker (ТЗ §16, друга черга).
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // тільки на http(s), не на file://
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[pwa] SW реєстрація не вдалась:', err.message);
    });
  });
}
