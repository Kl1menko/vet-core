import { el } from '../utils/dom.js';
import { Toast } from './toast.js';

// Індикатор з'єднання (ТЗ §16). Реагує на online/offline.
export function OnlineIndicator() {
  const dot = el('span', { title: 'З\'єднання' , style: dotStyle(navigator.onLine) });
  const wrap = el('div', { style: 'display:flex;align-items:center;gap:6px' }, [dot]);

  function update() {
    dot.style.cssText = dotStyle(navigator.onLine);
    dot.title = navigator.onLine ? 'Онлайн' : 'Немає з\'єднання';
  }
  window.addEventListener('online', () => { update(); Toast.success("З'єднання відновлено"); });
  window.addEventListener('offline', () => { update(); Toast.error('Немає з\'єднання', 'Працюємо в офлайн-режимі'); });
  return wrap;
}

function dotStyle(online) {
  return `width:10px;height:10px;border-radius:50%;background:${online ? 'var(--c-success)' : 'var(--c-danger)'}`;
}
