import { el, clear } from '../utils/dom.js';
import { onRealtime } from '../realtime.js';
import { icon } from './icons.js';
import { Toast } from './toast.js';
import { fmtTime } from '../utils/format.js';

// Внутрішні сповіщення (ТЗ §17): дзвіночок у шапці + live toast.
const items = [];
let badgeEl = null;
let listEl = null;
let subscribed = false;

const EVENT_MAP = {
  'appointment.created': (d) => ({ title: 'Новий запис', msg: `${d.title || ''}${d.patientName ? ' · ' + d.patientName : ''}` }),
  'invoice.created': (d) => ({ title: 'Сформовано рахунок', msg: `Сума: ${Number(d.total).toFixed(2)} грн` }),
  'invoice.paid': (d) => ({ title: 'Оплата рахунку', msg: `${Number(d.amount).toFixed(2)} грн` }),
  'stock.low': (d) => ({ title: 'Малий залишок', msg: `${d.name}: ${d.qty}` }),
};

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  for (const [event, fmt] of Object.entries(EVENT_MAP)) {
    onRealtime(event, (data) => {
      const { title, msg } = fmt(data);
      items.unshift({ title, msg, ts: Date.now(), read: false });
      if (items.length > 50) items.pop();
      if (event === 'stock.low') Toast.error(title, msg); else Toast.info(title, msg);
      render();
    });
  }
}

function unreadCount() { return items.filter((i) => !i.read).length; }

function render() {
  if (badgeEl) {
    const n = unreadCount();
    badgeEl.textContent = n ? String(n) : '';
    badgeEl.style.display = n ? 'flex' : 'none';
  }
  if (listEl && listEl.parentElement && listEl.parentElement.style.display !== 'none') renderList();
}

function renderList() {
  clear(listEl);
  if (!items.length) { listEl.append(el('div', { class: 'gsr-item muted' }, 'Немає сповіщень')); return; }
  items.forEach((it) => listEl.append(el('div', { class: 'gsr-item' }, [
    el('div', {}, [el('strong', {}, it.title), el('span', { class: 'muted' }, `  ${fmtTime(it.ts)}`)]),
    it.msg ? el('div', { class: 'muted', style: 'font-size:13px' }, it.msg) : null,
  ])));
}

// Кнопка-дзвіночок для шапки
export function notificationBell() {
  ensureSubscribed();
  badgeEl = el('span', { style: 'display:none;position:absolute;top:-4px;right:-4px;background:var(--c-danger);color:#fff;border-radius:999px;min-width:18px;height:18px;font-size:11px;align-items:center;justify-content:center;padding:0 4px' });
  const dropdown = el('div', { class: 'global-search-results', style: 'display:none;right:0;left:auto;width:300px' });
  listEl = dropdown;

  const btn = el('button', { class: 'btn btn-ghost btn-icon', style: 'position:relative', 'aria-label': 'Сповіщення',
    onClick: (e) => {
      e.stopPropagation();
      const open = dropdown.style.display !== 'none';
      dropdown.style.display = open ? 'none' : 'block';
      if (!open) { items.forEach((i) => { i.read = true; }); renderList(); render(); }
    } }, [icon('bell', { size: 19 }), badgeEl]);

  document.addEventListener('mousedown', (e) => {
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) dropdown.style.display = 'none';
  });

  render();
  return el('div', { style: 'position:relative' }, [btn, dropdown]);
}
