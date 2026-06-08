import { el, clear, debounce } from '../utils/dom.js';
import { PriceService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { money } from '../utils/format.js';
import { importButton } from '../components/importExport.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/emptyState.js';

export function renderPricePage(root) {
  const state = { search: '', loading: true, items: [] };
  root.append(el('div', { class: 'page-head price-head' }, [
    el('h1', {}, 'Прайс-лист'),
    el('div', { class: 'toolbar price-toolbar' }, [
      search(),
      el('div', { class: 'price-actions' }, [
        can('finance.manage') ? importButton('services', 'Прайс', reload) : null,
        can('finance.manage') ? el('button', { class: 'btn btn-primary price-add-btn', onClick: () => openForm(null, reload) }, [
          icon('plus', { size: 16 }),
          'Послуга',
        ]) : null,
      ]),
    ]),
  ]));
  const container = el('div'); root.append(container);

  function search() {
    const i = el('input', { type: 'search', placeholder: 'Пошук послуги…', class: 'price-search' });
    i.addEventListener('input', debounce((e) => { state.search = e.target.value; load(); }, 300));
    return i;
  }
  async function load() {
    state.loading = true; render();
    try { state.items = await PriceService.list({ search: state.search }); } catch (e) { Toast.fromError(e); }
    finally { state.loading = false; render(); }
  }
  function reload() { load(); }
  function render() {
    clear(container);
    container.append(renderTable([
      { title: 'Назва', render: (s) => el('strong', {}, s.name) },
      { title: 'Категорія', render: (s) => s.category_name || '—' },
      { title: 'Тривалість', render: (s) => s.duration_minutes ? `${s.duration_minutes} хв` : '—' },
      { title: 'Собівартість', render: (s) => money(s.cost_price) },
      { title: 'Ціна', render: (s) => el('strong', {}, money(s.price)) },
      { title: '', width: '120px', render: (s) => can('finance.manage') ? el('div', { class: 'row-actions' }, [
        el('button', { class: 'btn btn-ghost btn-sm', title: 'Редагувати', onClick: () => openForm(s, reload) }, [icon('edit', { size: 15 })]),
        el('button', { class: 'btn btn-danger btn-sm', title: 'Видалити', onClick: () => del(s, reload) }, [icon('trash', { size: 15 })]),
      ]) : null },
    ], state.items, { loading: state.loading, emptyText: emptyState({ icon: 'price', title: 'Прайс порожній', hint: 'Додайте послуги або імпортуйте з CSV',
      action: can('finance.manage') ? { label: '+ Послуга', onClick: () => openForm(null, reload) } : null }) }));
  }
  async function del(s, reload) {
    if (await confirmDialog({ title: 'Видалити послугу?', message: s.name, danger: true, okText: 'Видалити' })) {
      try { await PriceService.remove(s.id); Toast.success('Видалено'); reload(); } catch (e) { Toast.fromError(e); }
    }
  }
  load();
}

function openForm(svc, onSaved) {
  const isEdit = !!svc;
  const { form } = buildForm([
    { name: 'name', label: 'Назва', required: true, value: svc?.name, full: true },
    { name: 'price', label: 'Ціна', type: 'number', min: 0, required: true, value: svc ? Number(svc.price) : 0 },
    { name: 'costPrice', label: 'Собівартість', type: 'number', min: 0, value: svc ? Number(svc.cost_price) : 0 },
    { name: 'durationMinutes', label: 'Тривалість, хв', type: 'number', min: 0, value: svc?.duration_minutes || 0 },
    { name: 'code', label: 'Код', value: svc?.code },
    { name: 'description', label: 'Опис', type: 'textarea', value: svc?.description, full: true },
  ], {
    submitText: isEdit ? 'Зберегти' : 'Створити', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try {
        if (isEdit) await PriceService.update(svc.id, v); else await PriceService.create(v);
        Toast.success('Збережено'); ctrl.close(); onSaved?.();
      } catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: isEdit ? 'Редагувати послугу' : 'Нова послуга', body: form });
}
