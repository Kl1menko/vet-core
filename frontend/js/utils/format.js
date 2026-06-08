export function fullName(o, { last = 'last', first = 'first', middle = 'middle' } = {}) {
  if (!o) return '—';
  const parts = [o[`${last}_name`] ?? o.lastName, o[`${first}_name`] ?? o.firstName, o[`${middle}_name`] ?? o.middleName];
  return parts.filter(Boolean).join(' ') || '—';
}

export function money(value, currency = 'грн') {
  const n = Number(value || 0);
  return `${n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export function initials(o) {
  const f = (o?.first_name ?? o?.firstName ?? '')[0] || '';
  const l = (o?.last_name ?? o?.lastName ?? '')[0] || '';
  return (f + l).toUpperCase() || '?';
}

export const APPT_STATUS = {
  draft: ['Чернетка', 'badge-gray'],
  planned: ['Заплановано', 'badge-blue'],
  in_progress: ['Триває', 'badge-amber'],
  completed: ['Завершено', 'badge-green'],
  cancelled: ['Скасовано', 'badge-red'],
};
export const EVENT_STATUS = {
  planned: ['Заплановано', 'badge-blue'],
  confirmed: ['Підтверджено', 'badge-blue'],
  arrived: ['Прийшов', 'badge-amber'],
  in_progress: ['Триває', 'badge-amber'],
  completed: ['Завершено', 'badge-green'],
  cancelled: ['Скасовано', 'badge-red'],
  no_show: ['Не з’явився', 'badge-red'],
};
