import { el, clear } from '../utils/dom.js';
import { CalendarService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { fullName, fmtTime, EVENT_STATUS } from '../utils/format.js';
import { openEventForm } from './calendarPage.js';
import { navigate } from '../router.js';

// Регістратура — записи на сьогодні (ТЗ §6.6, MVP)
export function renderReceptionPage(root) {
  const head = el('div', { class: 'page-head' }, [
    el('h1', {}, 'Регістратура'),
    can('calendar.manage')
      ? el('button', { class: 'btn btn-primary', onClick: () => openEventForm(null, new Date(), load) }, '+ Запис')
      : null,
  ]);
  const container = el('div');
  root.append(head, container);

  async function load() {
    clear(container); container.append(el('div', { class: 'table-state' }, [el('div', { class: 'spinner' })]));
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(); to.setHours(23, 59, 59, 999);
    let events = [];
    try { events = await CalendarService.events({ from: from.toISOString(), to: to.toISOString() }); }
    catch (err) { Toast.fromError(err); }

    clear(container);
    const table = renderTable([
      { title: 'Час', render: (e) => el('strong', {}, fmtTime(e.start_at)) },
      { title: 'Власник', render: (e) => e.owner_first_name ? fullName({ first_name: e.owner_first_name, last_name: e.owner_last_name }) : '—' },
      { title: 'Телефон', render: (e) => e.owner_phone ? el('a', { href: `tel:${e.owner_phone}`, style: 'color:var(--c-primary)' }, e.owner_phone) : '—' },
      { title: 'Пацієнт', render: (e) => e.patient_name || '—' },
      { title: 'Лікар', render: (e) => e.doctor_first_name ? fullName({ first_name: e.doctor_first_name, last_name: e.doctor_last_name }) : '—' },
      { title: 'Статус', render: (e) => { const [l, c] = EVENT_STATUS[e.status] || [e.status, 'badge-gray']; return el('span', { class: `badge ${c}` }, l); } },
    ], events, { emptyText: 'На сьогодні записів немає', onRowClick: (e) => openEventForm(e, null, load) });
    container.append(table);
  }

  load();
}
