import { el, clear, debounce } from '../utils/dom.js';
import { OwnerService } from '../services/index.js';
import { renderTable, renderPagination } from '../components/table.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { can } from '../permissions.js';
import { fullName, money } from '../utils/format.js';
import { exportButton, importButton } from '../components/importExport.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/emptyState.js';

export function renderOwnersPage(root) {
  const state = { page: 1, search: '', loading: true, data: { items: [], meta: {} } };

  const head = el('div', { class: 'page-head owners-head' }, [
    el('h1', {}, 'Власники'),
    el('div', { class: 'toolbar owners-toolbar' }, [
      searchInput(),
      el('div', { class: 'owners-actions' }, [
        exportButton('/export/owners.csv', 'owners.csv'),
        can('owners.create') ? importButton('owners', 'Власники', reload) : null,
        can('owners.create')
          ? el('button', { class: 'btn btn-primary owners-add-btn', onClick: () => openOwnerForm(null, reload) }, [
            icon('plus', { size: 16 }),
            'Власник',
          ])
          : null,
      ]),
    ]),
  ]);
  const container = el('div');
  root.append(head, container);

  function searchInput() {
    const input = el('input', { type: 'search', placeholder: 'Пошук за іменем, телефоном, email…', class: 'owners-search' });
    input.addEventListener('input', debounce((e) => {
      state.search = e.target.value; state.page = 1; load();
    }, 300));
    return input;
  }

  async function load() {
    state.loading = true; render();
    try {
      state.data = await OwnerService.list({ page: state.page, search: state.search });
    } catch (err) { Toast.fromError(err); }
    finally { state.loading = false; render(); }
  }
  function reload() { load(); }

  function render() {
    clear(container);
    const table = renderTable([
      { title: "Ім'я", render: (o) => el('strong', {}, fullName(o)) },
      { title: 'Телефон', render: (o) => o.phone || '—' },
      { title: 'Email', render: (o) => o.email || '—' },
      { title: 'Тварин', render: (o) => String(o.animals_count ?? 0) },
      { title: 'Знижка', render: (o) => `${Number(o.discount_percent || 0)}%` },
      { title: 'Баланс', render: (o) => money(o.balance) },
      { title: '', width: '120px', render: (o) => rowActions(o, reload) },
    ], state.data.items, {
      loading: state.loading,
      emptyText: state.search
        ? emptyState({ icon: 'search', title: 'Нічого не знайдено', hint: 'Спробуйте інший запит' })
        : emptyState({ icon: 'user', title: 'Ще немає власників', hint: 'Додайте першого клієнта клініки',
            action: can('owners.create') ? { label: '+ Власник', onClick: () => openOwnerForm(null, reload) } : null }),
      onRowClick: (o) => navigate(`/owners/${o.id}`),
    });
    container.append(table, renderPagination(state.data.meta, (p) => { state.page = p; load(); }));
  }

  load();
}

function rowActions(owner, reload) {
  return el('div', { class: 'row-actions' }, [
    can('owners.edit')
      ? el('button', { class: 'btn btn-ghost btn-sm', title: 'Редагувати', onClick: () => openOwnerForm(owner, reload) }, [icon('edit', { size: 15 })])
      : null,
    can('owners.delete')
      ? el('button', { class: 'btn btn-ghost btn-sm', title: 'Архівувати', onClick: async () => {
          if (await confirmDialog({ title: 'Архівувати власника?', message: fullName(owner), danger: true, okText: 'Архівувати' })) {
            try { await OwnerService.remove(owner.id); Toast.success('Готово', 'Власника архівовано'); reload(); }
            catch (err) { Toast.fromError(err); }
          }
        } }, [icon('trash', { size: 15 })])
      : null,
  ]);
}

// Спільна форма власника (create + edit)
export function openOwnerForm(owner, onSaved) {
  const isEdit = !!owner;
  const { form } = buildForm([
    { name: 'lastName', label: 'Прізвище', value: owner?.last_name, full: false },
    { name: 'firstName', label: "Ім'я", required: true, value: owner?.first_name },
    { name: 'middleName', label: 'По батькові', value: owner?.middle_name },
    { name: 'phone', label: 'Телефон', type: 'tel', required: true, value: owner?.phone },
    { name: 'secondaryPhone', label: 'Додатковий телефон', type: 'tel', value: owner?.secondary_phone },
    { name: 'email', label: 'Email', type: 'email', value: owner?.email },
    { name: 'discountPercent', label: 'Знижка, %', type: 'number', min: 0, value: owner ? Number(owner.discount_percent) : 0 },
    { name: 'address', label: 'Адреса', value: owner?.address, full: true },
    { name: 'comment', label: 'Коментар', type: 'textarea', value: owner?.comment, full: true },
  ], {
    submitText: isEdit ? 'Зберегти' : 'Створити',
    onCancel: () => ctrl.close(),
    onSubmit: async (values) => {
      try {
        if (isEdit) { await OwnerService.update(owner.id, values); Toast.success('Збережено'); }
        else { await OwnerService.create(values); Toast.success('Власника створено'); }
        ctrl.close();
        onSaved?.();
      } catch (err) {
        if (err?.fields) throw err;
        Toast.fromError(err);
      }
    },
  });
  const ctrl = openModal({ title: isEdit ? 'Редагувати власника' : 'Новий власник', body: form });
}
