import { el, clear, debounce } from '../utils/dom.js';
import { PatientService, OwnerService } from '../services/index.js';
import { renderTable, renderPagination } from '../components/table.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { can } from '../permissions.js';
import { fullName, fmtDate } from '../utils/format.js';
import { exportButton } from '../components/importExport.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/emptyState.js';

export function renderPatientsPage(root) {
  const state = { page: 1, search: '', loading: true, data: { items: [], meta: {} } };

  const head = el('div', { class: 'page-head patients-head' }, [
    el('h1', {}, 'Пацієнти'),
    el('div', { class: 'toolbar patients-toolbar' }, [
      searchInput(),
      el('div', { class: 'patients-actions' }, [
        exportButton('/export/patients.csv', 'patients.csv'),
        can('patients.create')
          ? el('button', { class: 'btn btn-primary patients-add-btn', onClick: () => openPatientForm(null, null, reload) }, [
            icon('plus', { size: 16 }),
            'Пацієнт',
          ])
          : null,
      ]),
    ]),
  ]);
  const container = el('div');
  root.append(head, container);

  function searchInput() {
    const input = el('input', { type: 'search', placeholder: 'Пошук за кличкою, чіпом, породою…', class: 'patients-search' });
    input.addEventListener('input', debounce((e) => { state.search = e.target.value; state.page = 1; load(); }, 300));
    return input;
  }

  async function load() {
    state.loading = true; render();
    try { state.data = await PatientService.list({ page: state.page, search: state.search }); }
    catch (err) { Toast.fromError(err); }
    finally { state.loading = false; render(); }
  }
  function reload() { load(); }

  function render() {
    clear(container);
    const table = renderTable([
      { title: 'Кличка', render: (p) => el('strong', {}, p.name) },
      { title: 'Вид / порода', render: (p) => [p.species, p.breed].filter(Boolean).join(' · ') || '—' },
      { title: 'Стать', render: (p) => ({ male: '♂', female: '♀', unknown: '—' })[p.sex] || '—' },
      { title: 'Власник', render: (p) => fullName({ first_name: p.owner_first_name, last_name: p.owner_last_name }) },
      { title: 'Телефон', render: (p) => p.owner_phone || '—' },
      { title: 'Народження', render: (p) => fmtDate(p.birth_date) },
      { title: '', width: '104px', render: (p) => rowActions(p, reload) },
    ], state.data.items, {
      loading: state.loading,
      emptyText: state.search
        ? emptyState({ icon: 'search', title: 'Нічого не знайдено', hint: 'Спробуйте іншу кличку або чіп' })
        : emptyState({ icon: 'paw', title: 'Ще немає пацієнтів', hint: 'Додайте першу тварину',
            action: can('patients.create') ? { label: '+ Пацієнт', onClick: () => openPatientForm(null, null, reload) } : null }),
      onRowClick: (p) => navigate(`/patients/${p.id}`),
    });
    container.append(table, renderPagination(state.data.meta, (p) => { state.page = p; load(); }));
  }

  load();
}

function rowActions(patient, reload) {
  return el('div', { class: 'row-actions' }, [
    can('patients.edit')
      ? el('button', { class: 'btn btn-ghost row-action-btn', title: 'Редагувати', 'aria-label': 'Редагувати пацієнта', onClick: () => openPatientForm(patient, null, reload) }, [icon('edit', { size: 17 })])
      : null,
    can('patients.delete')
      ? el('button', { class: 'btn btn-ghost row-action-btn row-action-btn--danger', title: 'Архівувати', 'aria-label': 'Архівувати пацієнта', onClick: async () => {
          if (await confirmDialog({ title: 'Архівувати пацієнта?', message: patient.name, danger: true, okText: 'Архівувати' })) {
            try { await PatientService.remove(patient.id); Toast.success('Готово'); reload(); }
            catch (err) { Toast.fromError(err); }
          }
        } }, [icon('trash', { size: 17 })])
      : null,
  ]);
}

// fixedOwner: {id, label} — коли створюємо з картки власника
export async function openPatientForm(patient, fixedOwner, onSaved) {
  const isEdit = !!patient;

  // Опції власників: якщо власник фіксований — лише він; інакше підвантажуємо перелік.
  let ownerOptions = [];
  const ownerId = patient?.owner_id || fixedOwner?.id || '';
  if (fixedOwner) {
    ownerOptions = [{ value: fixedOwner.id, label: fixedOwner.label }];
  } else {
    try {
      const res = await OwnerService.list({ limit: 100 });
      ownerOptions = res.items.map((o) => ({ value: o.id, label: `${fullName(o)} · ${o.phone || ''}` }));
    } catch { ownerOptions = []; }
    if (isEdit && patient.owner_id && !ownerOptions.some((o) => o.value === patient.owner_id)) {
      ownerOptions.unshift({ value: patient.owner_id, label: fullName({ first_name: patient.owner_first_name, last_name: patient.owner_last_name }) });
    }
  }

  const { form } = buildForm([
    { name: 'ownerId', label: 'Власник', type: 'select', required: true, value: ownerId, options: ownerOptions, full: true },
    { name: 'name', label: 'Кличка', required: true, value: patient?.name },
    { name: 'species', label: 'Вид', value: patient?.species, placeholder: 'Собака, кіт…' },
    { name: 'breed', label: 'Порода', value: patient?.breed },
    { name: 'color', label: 'Окрас', value: patient?.color },
    { name: 'sex', label: 'Стать', type: 'select', value: patient?.sex || 'unknown',
      options: [{ value: 'unknown', label: 'Невідомо' }, { value: 'male', label: 'Самець' }, { value: 'female', label: 'Самка' }] },
    { name: 'birthDate', label: 'Дата народження', type: 'date',
      value: patient?.birth_date ? String(patient.birth_date).slice(0, 10) : '' },
    { name: 'weight', label: 'Вага, кг', type: 'number', min: 0, step: '0.001', value: patient?.weight != null ? Number(patient.weight) : '' },
    { name: 'chipNumber', label: 'Номер чіпа', value: patient?.chip_number },
    { name: 'passportNumber', label: 'Номер паспорта', value: patient?.passport_number },
    { name: 'notes', label: 'Примітки', type: 'textarea', value: patient?.notes, full: true },
  ], {
    submitText: isEdit ? 'Зберегти' : 'Створити',
    onCancel: () => ctrl.close(),
    onSubmit: async (values) => {
      if (!values.weight) values.weight = null;
      if (!values.birthDate) values.birthDate = null;
      try {
        if (isEdit) { await PatientService.update(patient.id, values); Toast.success('Збережено'); }
        else { await PatientService.create(values); Toast.success('Пацієнта створено'); }
        ctrl.close();
        onSaved?.();
      } catch (err) { if (err?.fields) throw err; Toast.fromError(err); }
    },
  });
  const ctrl = openModal({ title: isEdit ? 'Редагувати пацієнта' : 'Новий пацієнт', body: form });
}
