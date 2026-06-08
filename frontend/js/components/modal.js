import { el, clear } from '../utils/dom.js';

const root = () => document.getElementById('modal-root');

// openModal({ title, body: Node, wide }) -> { close }
export function openModal({ title = '', body, wide = false }) {
  const overlay = el('div', { class: 'modal-overlay' });
  const modal = el('div', { class: `modal${wide ? ' wide' : ''}` }, [
    el('div', { class: 'modal__head' }, [
      el('h2', {}, title),
      el('button', { class: 'modal__close', onClick: close, 'aria-label': 'Закрити' }, '×'),
    ]),
    el('div', { class: 'modal__body' }, [body]),
  ]);
  overlay.append(modal);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  clear(root());
  root().append(overlay);
  return { close, modal };
}

export function closeModal() { clear(root()); }

// confirm-діалог -> Promise<boolean>
export function confirmDialog({ title = 'Підтвердження', message = '', danger = false, okText = 'Так' }) {
  return new Promise((resolve) => {
    const body = el('div', {}, [
      el('p', { class: 'muted', style: 'margin-bottom:18px' }, message),
      el('div', { class: 'form-actions' }, [
        el('button', { class: 'btn btn-ghost', onClick: () => { ctrl.close(); resolve(false); } }, 'Скасувати'),
        el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
          onClick: () => { ctrl.close(); resolve(true); } }, okText),
      ]),
    ]);
    const ctrl = openModal({ title, body });
  });
}
