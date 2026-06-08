import { el } from '../utils/dom.js';

const root = () => document.getElementById('toast-root');

function show(type, title, msg, ttl = 3500) {
  const node = el('div', { class: `toast ${type}` }, [
    el('div', { class: 'toast__title' }, title),
    msg ? el('div', { class: 'toast__msg' }, msg) : null,
  ]);
  root().append(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity .2s';
    setTimeout(() => node.remove(), 200);
  }, ttl);
}

export const Toast = {
  success: (title, msg) => show('success', title, msg),
  error: (title, msg) => show('error', title, msg),
  info: (title, msg) => show('info', title, msg),
  // Зручний хелпер під помилки API
  fromError: (err, fallback = 'Сталася помилка') =>
    show('error', 'Помилка', err?.message || fallback),
};
