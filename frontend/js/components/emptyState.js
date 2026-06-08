import { el } from '../utils/dom.js';
import { icon } from './icons.js';

/**
 * Порожній стан з іконкою-ілюстрацією (ТЗ §23.14).
 * emptyState({ icon, title, hint, action: { label, onClick } })
 */
export function emptyState({ icon: iconName = 'inbox', title = 'Поки порожньо', hint = '', action = null } = {}) {
  return el('div', { class: 'empty-state' }, [
    el('div', { class: 'empty-state__art' }, [icon(iconName, { size: 40, stroke: 1.5 })]),
    el('div', { class: 'empty-state__title' }, title),
    hint ? el('div', { class: 'empty-state__hint' }, hint) : null,
    action ? el('button', { class: 'btn btn-primary btn-sm', style: 'margin-top:14px', onClick: action.onClick }, action.label) : null,
  ]);
}
