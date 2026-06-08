import { el, clear } from '../utils/dom.js';
import { SupplierService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/emptyState.js';

export function renderSuppliersPage(root) {
  const state = { loading: true, items: [] };
  root.append(el('div', { class: 'page-head' }, [
    el('h1', {}, 'Постачальники'),
    can('warehouse.manage') ? el('button', { class: 'btn btn-primary', onClick: () => openForm(null, reload) }, '+ Постачальник') : null,
  ]));
  const container = el('div'); root.append(container);

  async function load() {
    state.loading = true; render();
    try { state.items = await SupplierService.list(); } catch (e) { Toast.fromError(e); }
    finally { state.loading = false; render(); }
  }
  function reload() { load(); }
  function render() {
    clear(container);
    container.append(renderTable([
      { title: 'Назва', render: (s) => el('strong', {}, s.name) },
      { title: 'Контактна особа', render: (s) => s.contact_person || '—' },
      { title: 'Телефон', render: (s) => s.phone || '—' },
      { title: 'Email', render: (s) => s.email || '—' },
      { title: '', width: '120px', render: (s) => can('warehouse.manage') ? el('div', { class: 'row-actions' }, [
        el('button', { class: 'btn btn-ghost btn-sm', title: 'Редагувати', onClick: () => openForm(s, reload) }, [icon('edit', { size: 15 })]),
        el('button', { class: 'btn btn-ghost btn-sm', title: 'Видалити', onClick: async () => {
          if (await confirmDialog({ title: 'Видалити?', message: s.name, danger: true, okText: 'Видалити' })) {
            try { await SupplierService.remove(s.id); Toast.success('Видалено'); reload(); } catch (e) { Toast.fromError(e); }
          }
        } }, [icon('trash', { size: 15 })]),
      ]) : null },
    ], state.items, { loading: state.loading, emptyText: emptyState({ icon: 'truck', title: 'Немає постачальників',
      action: can('warehouse.manage') ? { label: '+ Постачальник', onClick: () => openForm(null, reload) } : null }) }));
  }
  load();
}

function openForm(s, onSaved) {
  const isEdit = !!s;
  const { form } = buildForm([
    { name: 'name', label: 'Назва', required: true, value: s?.name, full: true },
    { name: 'contactPerson', label: 'Контактна особа', value: s?.contact_person },
    { name: 'phone', label: 'Телефон', type: 'tel', value: s?.phone },
    { name: 'email', label: 'Email', type: 'email', value: s?.email },
    { name: 'address', label: 'Адреса', value: s?.address, full: true },
    { name: 'comment', label: 'Коментар', type: 'textarea', value: s?.comment, full: true },
  ], {
    submitText: isEdit ? 'Зберегти' : 'Створити', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try { if (isEdit) await SupplierService.update(s.id, v); else await SupplierService.create(v);
        Toast.success('Збережено'); ctrl.close(); onSaved?.(); }
      catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: isEdit ? 'Редагувати постачальника' : 'Новий постачальник', body: form });
}
