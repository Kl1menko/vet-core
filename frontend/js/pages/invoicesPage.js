import { el, clear } from '../utils/dom.js';
import { InvoiceService } from '../services/index.js';
import { renderTable, renderPagination } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { fullName, money, fmtDateTime } from '../utils/format.js';
import { exportButton } from '../components/importExport.js';
import { emptyState } from '../components/emptyState.js';

const INV_STATUS = {
  draft: ['Чернетка', 'badge-gray'], unpaid: ['Не оплачено', 'badge-red'],
  partial: ['Частково', 'badge-amber'], paid: ['Оплачено', 'badge-green'],
};

export function renderInvoicesPage(root) {
  const state = { page: 1, status: '', loading: true, data: { items: [], meta: {} } };
  const statusSel = el('select', { onChange: (e) => { state.status = e.target.value; state.page = 1; load(); } }, [
    el('option', { value: '' }, 'Усі статуси'),
    ...Object.entries(INV_STATUS).map(([k, [l]]) => el('option', { value: k }, l)),
  ]);
  root.append(el('div', { class: 'page-head' }, [el('h1', {}, 'Рахунки'),
    el('div', { class: 'toolbar' }, [statusSel, exportButton('/export/invoices.csv', 'invoices.csv')])]));
  const container = el('div'); root.append(container);

  async function load() {
    state.loading = true; render();
    try { state.data = await InvoiceService.list({ page: state.page, status: state.status || undefined }); }
    catch (e) { Toast.fromError(e); } finally { state.loading = false; render(); }
  }
  function render() {
    clear(container);
    container.append(renderTable([
      { title: 'Дата', render: (i) => fmtDateTime(i.created_at) },
      { title: 'Власник', render: (i) => fullName({ first_name: i.owner_first_name, last_name: i.owner_last_name }) },
      { title: 'Пацієнт', render: (i) => i.patient_name || '—' },
      { title: 'Сума', render: (i) => el('strong', {}, money(i.total)) },
      { title: 'Сплачено', render: (i) => money(i.paid_amount) },
      { title: 'Борг', render: (i) => Number(i.debt_amount) > 0 ? el('span', { class: 'badge badge-red' }, money(i.debt_amount)) : '—' },
      { title: 'Статус', render: (i) => { const [l, c] = INV_STATUS[i.status] || [i.status, 'badge-gray']; return el('span', { class: `badge ${c}` }, l); } },
    ], state.data.items, { loading: state.loading, emptyText: emptyState({ icon: 'invoice', title: 'Немає рахунків', hint: 'Рахунки створюються при завершенні прийому' }), onRowClick: (i) => navigate(`/invoices/${i.id}`) }),
      renderPagination(state.data.meta, (p) => { state.page = p; load(); }));
  }
  load();
}
