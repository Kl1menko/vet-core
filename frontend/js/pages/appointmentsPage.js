import { el, clear } from '../utils/dom.js';
import { AppointmentService } from '../services/index.js';
import { renderTable, renderPagination } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { fullName, fmtDateTime, APPT_STATUS } from '../utils/format.js';
import { navigate } from '../router.js';
import { emptyState } from '../components/emptyState.js';

export function renderAppointmentsPage(root) {
  const state = { page: 1, status: '', loading: true, data: { items: [], meta: {} } };

  const statusSelect = el('select', { onChange: (e) => { state.status = e.target.value; state.page = 1; load(); } }, [
    el('option', { value: '' }, 'Усі статуси'),
    ...Object.entries(APPT_STATUS).map(([k, [l]]) => el('option', { value: k }, l)),
  ]);

  root.append(
    el('div', { class: 'page-head' }, [el('h1', {}, 'Прийоми'), el('div', { class: 'toolbar' }, [statusSelect])]),
  );
  const container = el('div');
  root.append(container);

  async function load() {
    state.loading = true; render();
    try { state.data = await AppointmentService.list({ page: state.page, status: state.status || undefined }); }
    catch (err) { Toast.fromError(err); }
    finally { state.loading = false; render(); }
  }

  function render() {
    clear(container);
    const table = renderTable([
      { title: 'Дата', render: (a) => fmtDateTime(a.started_at || a.created_at) },
      { title: 'Пацієнт', render: (a) => a.patient_name || '—' },
      { title: 'Власник', render: (a) => fullName({ first_name: a.owner_first_name, last_name: a.owner_last_name }) },
      { title: 'Лікар', render: (a) => fullName({ first_name: a.doctor_first_name, last_name: a.doctor_last_name }) },
      { title: 'Діагноз', render: (a) => a.diagnosis || a.reason || '—' },
      { title: 'Статус', render: (a) => { const [l, c] = APPT_STATUS[a.status] || [a.status, 'badge-gray']; return el('span', { class: `badge ${c}` }, l); } },
    ], state.data.items, {
      loading: state.loading, emptyText: emptyState({ icon: 'stethoscope', title: 'Немає прийомів', hint: 'Прийоми створюються із календаря або регістратури' }),
      onRowClick: (a) => navigate(`/appointments/${a.id}`),
    });
    container.append(table, renderPagination(state.data.meta, (p) => { state.page = p; load(); }));
  }

  load();
}
