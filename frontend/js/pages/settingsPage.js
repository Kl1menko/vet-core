import { el, clear } from '../utils/dom.js';
import {
  RoleService, RoleAdminService, PermissionService, TemplateService, SettingsService,
} from '../services/index.js';
import { Store } from '../store.js';
import { Toast } from '../components/toast.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { can } from '../permissions.js';
import { fullName } from '../utils/format.js';
import { icon } from '../components/icons.js';

const TEMPLATE_TYPES = [
  ['diagnosis', 'Діагнози'], ['recommendation', 'Рекомендації'], ['procedure', 'Процедури'],
  ['vaccination', 'Вакцинації'], ['analysis', 'Аналізи'], ['message', 'Повідомлення'], ['document', 'Документи'],
];

export function renderSettingsPage(root) {
  root.append(el('div', { class: 'page-head' }, [el('h1', {}, 'Налаштування')]));
  const tabsBar = el('div', { class: 'tabs' });
  const body = el('div');
  root.append(tabsBar, body);

  const tabs = {
    'Клініка': clinicTab,
    'Ролі та права': rolesTab,
    'Шаблони': templatesTab,
  };
  Object.keys(tabs).forEach((name, i) => {
    const t = el('div', { class: `tab ${i === 0 ? 'active' : ''}`, onClick: () => {
      tabsBar.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      clear(body); tabs[name](body);
    } }, name);
    tabsBar.append(t);
  });
  clear(body); clinicTab(body);
}

// ---------- Клініка + профіль ----------
async function clinicTab(root) {
  const user = Store.get('user');
  root.append(el('div', { class: 'spinner' }));
  let data;
  try { data = await SettingsService.get(); } catch (e) { Toast.fromError(e); }
  clear(root);

  root.append(el('div', { class: 'card card-pad', style: 'margin-bottom:16px' }, [
    el('h2', { style: 'font-size:16px;margin-bottom:12px' }, 'Профіль'),
    el('dl', { class: 'kv' }, [kv("Ім'я", fullName(user)), kv('Email', user?.email), kv('Роль', roleLabel(user?.role))]),
  ]));

  const c = data?.clinic || {};
  const card = el('div', { class: 'card card-pad' }, [el('h2', { style: 'font-size:16px;margin-bottom:12px' }, 'Клініка')]);
  if (can('settings.manage')) {
    const { form } = buildForm([
      { name: 'name', label: 'Назва', value: c.name, full: true },
      { name: 'phone', label: 'Телефон', type: 'tel', value: c.phone },
      { name: 'email', label: 'Email', type: 'email', value: c.email },
      { name: 'address', label: 'Адреса', value: c.address, full: true },
      { name: 'timezone', label: 'Часовий пояс', value: c.timezone },
      { name: 'currency', label: 'Валюта', value: c.currency },
    ], {
      submitText: 'Зберегти',
      onSubmit: async (v) => {
        try { await SettingsService.update(v); Toast.success('Налаштування збережено'); }
        catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
      },
    });
    card.append(form);
  } else {
    card.append(el('dl', { class: 'kv' }, [
      kv('Назва', c.name), kv('Телефон', c.phone), kv('Email', c.email),
      kv('Адреса', c.address), kv('Валюта', c.currency),
    ]));
  }
  root.append(card);
}

// ---------- Ролі та права ----------
async function rolesTab(root) {
  root.append(el('div', { class: 'spinner' }));
  let roles = [], perms = [];
  try { [roles, perms] = await Promise.all([RoleService.list(), PermissionService.list()]); }
  catch (e) { Toast.fromError(e); }
  clear(root);
  const permLabels = Object.fromEntries(perms.map((p) => [p.code, p.name]));

  if (can('settings.manage')) {
    root.append(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
      el('button', { class: 'btn btn-primary', onClick: () => openRoleForm(null, perms, () => rolesTab(root)) }, '+ Роль'),
    ]));
  }

  roles.forEach((r) => {
    root.append(el('div', { class: 'card card-pad', style: 'margin-bottom:12px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
        el('div', {}, [
          el('strong', {}, r.name),
          r.is_system ? el('span', { class: 'badge badge-gray', style: 'margin-left:8px' }, 'системна') : null,
        ]),
        (!r.is_system && can('settings.manage'))
          ? el('button', { class: 'btn btn-ghost btn-sm', onClick: () => openRoleForm(r, perms, () => rolesTab(root)) }, 'Редагувати')
          : null,
      ]),
      el('div', { class: 'role-permissions' },
        (r.permissions || []).length
          ? (r.permissions || []).map((code) => el('span', { class: 'badge badge-gray role-permission' }, permLabels[code] || code))
          : [el('span', { class: 'badge badge-green role-permission' }, 'Повний доступ')]),
    ]));
  });
}

function openRoleForm(role, perms, onSaved) {
  const isEdit = !!role;
  const checks = {};
  const grid = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:320px;overflow:auto;border:1px solid var(--c-border);border-radius:8px;padding:12px;margin-bottom:14px' },
    perms.map((p) => {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = (role?.permissions || []).includes(p.code);
      checks[p.code] = cb;
      return el('label', { style: 'display:flex;gap:8px;align-items:center;font-size:13px' }, [cb, p.name]);
    }));

  const nameInput = el('input', { type: 'text', value: role?.name || '', placeholder: 'Назва ролі' });
  const codeInput = el('input', { type: 'text', value: role?.code || '', placeholder: 'code (латиницею)', disabled: isEdit });
  const errBox = el('div', { class: 'err' });

  const body = el('div', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Назва *'), nameInput]),
    !isEdit ? el('div', { class: 'field' }, [el('label', {}, 'Код *'), codeInput]) : null,
    el('label', { style: 'font-weight:500;margin-bottom:6px;display:block' }, 'Дозволи'),
    grid,
    errBox,
    el('div', { class: 'form-actions' }, [
      el('button', { class: 'btn btn-ghost', onClick: () => ctrl.close() }, 'Скасувати'),
      el('button', { class: 'btn btn-primary', onClick: save }, isEdit ? 'Зберегти' : 'Створити'),
    ]),
  ]);

  async function save() {
    errBox.textContent = '';
    const permissions = Object.entries(checks).filter(([, cb]) => cb.checked).map(([code]) => code);
    const payload = { name: nameInput.value.trim(), permissions };
    if (!payload.name) { errBox.textContent = 'Вкажіть назву'; return; }
    try {
      if (isEdit) await RoleAdminService.update(role.id, payload);
      else { payload.code = codeInput.value.trim(); if (!payload.code) { errBox.textContent = 'Вкажіть код'; return; }
        await RoleAdminService.create(payload); }
      Toast.success('Збережено'); ctrl.close(); onSaved?.();
    } catch (e) { errBox.textContent = e?.message || 'Помилка'; }
  }

  const ctrl = openModal({ title: isEdit ? `Роль: ${role.name}` : 'Нова роль', body, wide: true });
}

// ---------- Шаблони ----------
async function templatesTab(root) {
  const typeSel = el('select', { onChange: () => load() }, [
    el('option', { value: '' }, 'Усі типи'),
    ...TEMPLATE_TYPES.map(([v, l]) => el('option', { value: v }, l)),
  ]);
  if (can('settings.manage')) {
    root.append(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
      typeSel,
      el('button', { class: 'btn btn-primary', onClick: () => openTplForm(null, () => load()) }, '+ Шаблон'),
    ]));
  } else {
    root.append(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [typeSel]));
  }
  const list = el('div'); root.append(list);

  async function load() {
    clear(list); list.append(el('div', { class: 'spinner' }));
    try {
      const tpls = await TemplateService.list({ type: typeSel.value || undefined });
      clear(list);
      if (!tpls.length) { list.append(el('p', { class: 'muted' }, 'Шаблонів немає')); return; }
      tpls.forEach((t) => list.append(el('div', { class: 'card card-pad', style: 'margin-bottom:8px' }, [
        el('div', { style: 'display:flex;justify-content:space-between' }, [
          el('div', {}, [el('strong', {}, t.name), el('span', { class: 'badge badge-blue', style: 'margin-left:8px' }, tplLabel(t.type))]),
          can('settings.manage') ? el('div', { class: 'row-actions' }, [
            el('button', { class: 'btn btn-ghost btn-sm', title: 'Редагувати', onClick: () => openTplForm(t, () => load()) }, [icon('edit', { size: 15 })]),
            el('button', { class: 'btn btn-ghost btn-sm', title: 'Видалити', onClick: async () => {
              if (await confirmDialog({ title: 'Видалити шаблон?', message: t.name, danger: true, okText: 'Видалити' })) {
                try { await TemplateService.remove(t.id); Toast.success('Видалено'); load(); } catch (e) { Toast.fromError(e); }
              }
            } }, [icon('trash', { size: 15 })]),
          ]) : null,
        ]),
        el('div', { class: 'muted', style: 'font-size:13px;margin-top:6px;white-space:pre-wrap' }, t.content),
      ])));
    } catch (e) { clear(list); list.append(el('p', { class: 'muted' }, 'Помилка')); }
  }
  load();
}

function openTplForm(tpl, onSaved) {
  const isEdit = !!tpl;
  const { form } = buildForm([
    { name: 'type', label: 'Тип', type: 'select', required: true, value: tpl?.type || 'diagnosis',
      options: TEMPLATE_TYPES.map(([v, l]) => ({ value: v, label: l })) },
    { name: 'name', label: 'Назва', required: true, value: tpl?.name },
    { name: 'content', label: 'Текст шаблону', type: 'textarea', required: true, value: tpl?.content, full: true },
  ], {
    submitText: isEdit ? 'Зберегти' : 'Створити', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try { if (isEdit) await TemplateService.update(tpl.id, v); else await TemplateService.create(v);
        Toast.success('Збережено'); ctrl.close(); onSaved?.(); }
      catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: isEdit ? 'Редагувати шаблон' : 'Новий шаблон', body: form });
}

function tplLabel(type) { return (Object.fromEntries(TEMPLATE_TYPES))[type] || type; }
function roleLabel(role) {
  return ({
    owner: 'Власник клініки',
    superadmin: 'Суперадмін',
    admin: 'Адміністратор',
    doctor: 'Лікар',
    receptionist: 'Реєстратор',
    accountant: 'Бухгалтер',
    warehouse: 'Склад',
  })[role] || role;
}
function kv(label, value) {
  return el('div', { style: 'display:contents' }, [el('dt', {}, label), el('dd', {}, value || '—')]);
}
