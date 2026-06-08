import { el, clear } from '../utils/dom.js';
import { UserService, RoleService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { fullName } from '../utils/format.js';
import { icon } from '../components/icons.js';

export function renderStaffPage(root) {
  const state = { loading: true, users: [], roles: [] };

  root.append(el('div', { class: 'page-head' }, [
    el('h1', {}, 'Співробітники'),
    can('staff.manage') ? el('button', { class: 'btn btn-primary', onClick: () => openUserForm(null, state.roles, reload) }, '+ Співробітник') : null,
  ]));
  const container = el('div');
  root.append(container);

  async function load() {
    state.loading = true; render();
    try {
      const [users, roles] = await Promise.all([UserService.list(), RoleService.list()]);
      state.users = users; state.roles = roles;
    } catch (err) { Toast.fromError(err); }
    finally { state.loading = false; render(); }
  }
  function reload() { load(); }

  function render() {
    clear(container);
    container.append(renderTable([
      { title: "Ім'я", render: (u) => el('strong', {}, fullName(u)) },
      { title: 'Email', render: (u) => u.email || '—' },
      { title: 'Телефон', render: (u) => u.phone || '—' },
      { title: 'Роль', render: (u) => el('span', { class: 'badge badge-blue' }, u.role_name || '—') },
      { title: 'Статус', render: (u) => u.is_active ? el('span', { class: 'badge badge-green' }, 'Активний') : el('span', { class: 'badge badge-gray' }, 'Вимкнено') },
      { title: '', width: '120px', render: (u) => can('staff.manage') ? el('div', { class: 'row-actions' }, [
        el('button', { class: 'btn btn-ghost btn-sm', title: 'Редагувати', onClick: () => openUserForm(u, state.roles, reload) }, [icon('edit', { size: 15 })]),
      ]) : null },
    ], state.users, { loading: state.loading, emptyText: 'Немає співробітників' }));
  }

  load();
}

function openUserForm(user, roles, onSaved) {
  const isEdit = !!user;
  const roleOptions = roles.filter((r) => r.code !== 'superadmin').map((r) => ({ value: r.id, label: r.name }));
  const fields = [
    { name: 'lastName', label: 'Прізвище', required: true, value: user?.last_name },
    { name: 'firstName', label: "Ім'я", required: true, value: user?.first_name },
    { name: 'middleName', label: 'По батькові', value: user?.middle_name },
    { name: 'phone', label: 'Телефон', type: 'tel', value: user?.phone },
    { name: 'roleId', label: 'Роль', type: 'select', required: true, value: user?.role_id, options: roleOptions, full: true },
  ];
  if (!isEdit) {
    fields.splice(3, 0, { name: 'email', label: 'Email', type: 'email', required: true });
    fields.push({ name: 'password', label: 'Пароль', type: 'password', required: true, full: true });
  }

  const { form } = buildForm(fields, {
    submitText: isEdit ? 'Зберегти' : 'Створити',
    onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try {
        if (isEdit) await UserService.update(user.id, v);
        else await UserService.create(v);
        Toast.success(isEdit ? 'Збережено' : 'Співробітника створено');
        ctrl.close(); onSaved?.();
      } catch (err) { if (err?.fields) throw err; Toast.fromError(err); }
    },
  });
  const ctrl = openModal({ title: isEdit ? 'Редагувати співробітника' : 'Новий співробітник', body: form });
}
