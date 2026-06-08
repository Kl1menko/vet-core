import { el, clear } from '../utils/dom.js';
import { WarehouseService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { openModal } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { money, fmtDate, fmtDateTime, fullName } from '../utils/format.js';
import { emptyState } from '../components/emptyState.js';

const MOVE_TYPES = { income: ['Прихід', 'badge-green'], write_off: ['Списання', 'badge-red'], correction: ['Корекція', 'badge-amber'] };

export function renderWarehousePage(root) {
  const state = { tab: 'stock', expiringOnly: false, loading: true, rows: [] };

  const tabsBar = el('div', { class: 'tabs' });
  const container = el('div');
  root.append(el('div', { class: 'page-head' }, [el('h1', {}, 'Склад')]), tabsBar, container);

  [['stock', 'Залишки'], ['movements', 'Рухи']].forEach(([key, label], i) => {
    const t = el('div', { class: `tab ${i === 0 ? 'active' : ''}`, onClick: () => {
      state.tab = key; tabsBar.querySelectorAll('.tab').forEach((x) => x.classList.remove('active')); t.classList.add('active'); load();
    } }, label);
    tabsBar.append(t);
  });

  async function load() {
    state.loading = true; render();
    try {
      state.rows = state.tab === 'stock'
        ? await WarehouseService.stock({ expiringSoon: state.expiringOnly ? 'true' : undefined })
        : await WarehouseService.movements();
    } catch (e) { Toast.fromError(e); } finally { state.loading = false; render(); }
  }
  function reload() { load(); }

  function render() {
    clear(container);
    if (state.tab === 'stock') {
      container.append(renderTable([
        { title: 'Препарат', render: (b) => el('strong', {}, b.drug_name) },
        { title: 'Партія', render: (b) => b.batch_number || '—' },
        { title: 'Залишок', render: (b) => `${Number(b.quantity)} ${b.drug_unit || ''}` },
        { title: 'Термін', render: (b) => {
          if (!b.expiration_date) return '—';
          const soon = new Date(b.expiration_date) <= new Date(Date.now() + 30 * 864e5);
          return el('span', { class: soon ? 'badge badge-amber' : '' }, fmtDate(b.expiration_date));
        } },
        { title: 'Постачальник', render: (b) => b.supplier_name || '—' },
        { title: 'Закупівля', render: (b) => money(b.purchase_price) },
        { title: '', width: '110px', render: (b) => can('warehouse.manage') ? el('div', { class: 'row-actions' }, [
          el('button', { class: 'btn btn-ghost btn-sm', onClick: () => openCorrection(b, reload) }, 'Корекція'),
        ]) : null },
      ], state.rows, { loading: state.loading, emptyText: emptyState({ icon: 'box', title: 'Немає залишків', hint: 'Оформіть прихід товару в розділі «Аптека»' }) }));
    } else {
      container.append(renderTable([
        { title: 'Дата', render: (m) => fmtDateTime(m.created_at) },
        { title: 'Препарат', render: (m) => m.drug_name },
        { title: 'Тип', render: (m) => { const [l, c] = MOVE_TYPES[m.type] || [m.type, 'badge-gray']; return el('span', { class: `badge ${c}` }, l); } },
        { title: 'Кількість', render: (m) => String(Number(m.quantity)) },
        { title: 'Причина', render: (m) => m.reason || '—' },
        { title: 'Користувач', render: (m) => fullName({ first_name: m.user_first_name, last_name: m.user_last_name }) },
      ], state.rows, { loading: state.loading, emptyText: emptyState({ icon: 'chart', title: 'Немає рухів', hint: 'Тут зʼявиться історія приходів і списань' }) }));
    }
  }
  load();
}

function openCorrection(batch, onSaved) {
  const { form } = buildForm([
    { name: 'newQuantity', label: 'Новий залишок', type: 'number', min: 0, required: true, value: Number(batch.quantity) },
    { name: 'reason', label: 'Причина', value: 'Інвентаризація', full: true },
  ], {
    submitText: 'Скоригувати', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try { await WarehouseService.correction({ batchId: batch.id, ...v }); Toast.success('Скориговано'); ctrl.close(); onSaved?.(); }
      catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: `Корекція: ${batch.drug_name}`, body: form });
}
