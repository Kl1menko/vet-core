import { el, clear } from '../utils/dom.js';
import { AppointmentService, PriceService, TemplateService, UserService } from '../services/index.js';
import { downloadFile } from '../api.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { fullName, money, APPT_STATUS } from '../utils/format.js';
import { navigate } from '../router.js';
import { icon } from '../components/icons.js';

export async function renderAppointmentPage(root, id) {
  root.append(el('div', { class: 'spinner' }));
  let a;
  try { a = await AppointmentService.get(id); }
  catch (err) { Toast.fromError(err); clear(root); root.append(el('p', { class: 'muted' }, 'Прийом не знайдено')); return; }

  const reload = () => renderAppointmentPage(root, id);
  const editable = a.status !== 'completed' && a.status !== 'cancelled';
  clear(root);

  const [label, cls] = APPT_STATUS[a.status] || [a.status, 'badge-gray'];

  root.append(
    el('div', { class: 'page-head' }, [
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => navigate('/appointments') }, [icon('back', { size: 15 }), ' Назад']),
      el('div', { class: 'toolbar' }, [actionButtons(a, reload)]),
    ]),
    el('div', { class: 'card card-pad' }, [
      el('div', { class: 'profile-head' }, [
        el('div', {}, [
          el('div', { class: 'appointment-title' }, [
            el('h1', {}, a.patient_name || 'Прийом'),
            el('span', { class: `badge ${cls} appointment-status` }, label),
          ]),
          el('div', { class: 'muted' }, `${fullName({ first_name: a.owner_first_name, last_name: a.owner_last_name })} · Лікар: ${fullName({ first_name: a.doctor_first_name, last_name: a.doctor_last_name })}`),
        ]),
      ]),
      medicalFields(a, editable, reload),
    ]),
    doctorsBlock(a, editable, reload),
    itemsBlock(a, editable, reload),
  );
}

// Спільний прийом: основний + асистенти/консультанти (ТЗ §6.7)
function doctorsBlock(a, editable, reload) {
  const block = el('div', { class: 'card card-pad', style: 'margin-top:16px' });
  block.append(el('div', { class: 'page-head', style: 'margin-bottom:10px' }, [
    el('h2', { style: 'font-size:18px' }, 'Лікарі прийому'),
    editable && can('appointments.edit')
      ? el('button', { class: 'btn btn-ghost btn-sm', onClick: () => openAddDoctor(a, reload) }, [icon('plus', { size: 14 }), ' Лікар'])
      : null,
  ]));
  block.append(el('div', { class: 'list-line' }, [
    el('strong', {}, fullName({ first_name: a.doctor_first_name, last_name: a.doctor_last_name })),
    el('span', { class: 'badge badge-blue', style: 'margin-left:8px' }, 'основний'),
  ]));
  (a.extraDoctors || []).forEach((d) => block.append(el('div', { class: 'list-line', style: 'display:flex;justify-content:space-between;align-items:center' }, [
    el('div', {}, [
      el('strong', {}, fullName(d)),
      el('span', { class: 'badge badge-gray', style: 'margin-left:8px' }, ({ assistant: 'асистент', consultant: 'консультант', main: 'основний' })[d.role] || d.role),
      Number(d.salary_percent) ? el('span', { class: 'muted', style: 'margin-left:8px' }, `${Number(d.salary_percent)}% ЗП`) : null,
    ]),
    editable && can('appointments.edit') ? el('button', { class: 'btn btn-danger btn-sm', title: 'Прибрати', onClick: async () => {
      try { await AppointmentService.removeDoctor(a.id, d.id); Toast.success('Прибрано'); reload(); } catch (e) { Toast.fromError(e); }
    } }, [icon('close', { size: 14 })]) : null,
  ])));
  return block;
}

async function openAddDoctor(a, reload) {
  let doctors = [];
  try { doctors = await UserService.doctors(); } catch (e) { Toast.fromError(e); return; }
  const taken = new Set([a.doctor_id, ...(a.extraDoctors || []).map((d) => d.doctor_id)]);
  const opts = doctors.filter((d) => !taken.has(d.id)).map((d) => ({ value: d.id, label: fullName(d) }));
  if (!opts.length) { Toast.info('Немає доступних лікарів'); return; }
  const { form } = buildForm([
    { name: 'doctorId', label: 'Лікар', type: 'select', required: true, options: opts, full: true },
    { name: 'role', label: 'Роль', type: 'select', value: 'assistant',
      options: [{ value: 'assistant', label: 'Асистент' }, { value: 'consultant', label: 'Консультант' }] },
    { name: 'salaryPercent', label: '% від послуг (ЗП)', type: 'number', min: 0, max: 100, value: 0 },
  ], {
    submitText: 'Додати', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try { await AppointmentService.addDoctor(a.id, v); Toast.success('Лікаря додано'); ctrl.close(); reload(); }
      catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: 'Додати лікаря', body: form });
}

function actionButtons(a, reload) {
  const wrap = el('div', { class: 'toolbar' });
  if (!can('appointments.edit')) return wrap;

  if (a.status === 'draft' || a.status === 'planned') {
    wrap.append(el('button', { class: 'btn btn-primary', onClick: async () => {
      try { await AppointmentService.start(a.id); Toast.success('Прийом розпочато'); reload(); }
      catch (err) { Toast.fromError(err); }
    } }, 'Почати прийом'));
  }
  if (a.status === 'in_progress' && can('appointments.complete')) {
    wrap.append(el('button', { class: 'btn btn-primary', onClick: async () => {
      if (await confirmDialog({ title: 'Завершити прийом?', message: 'Буде сформовано рахунок з позицій прийому.', okText: 'Завершити' })) {
        try { const r = await AppointmentService.complete(a.id); Toast.success('Прийом завершено', r.invoice ? `Рахунок: ${money(r.invoice.total)}` : ''); reload(); }
        catch (err) { Toast.fromError(err); }
      }
    } }, 'Завершити'));
  }
  // Наступний візит — доступний у процесі / після прийому
  if (a.status === 'in_progress' || a.status === 'completed') {
    wrap.append(el('button', { class: 'btn btn-ghost', onClick: () => openNextVisit(a, reload) }, [icon('calendar', { size: 15 }), ' Наступний візит']));
  }
  // PDF висновку — для завершеного
  if (a.status === 'completed') {
    wrap.append(el('button', { class: 'btn btn-ghost', onClick: async () => {
      try { await downloadFile(`/export/appointment/${a.id}.pdf`, `conclusion-${a.id.slice(0, 8)}.pdf`); }
      catch (e) { Toast.fromError(e); }
    } }, [icon('download', { size: 15 }), ' Висновок PDF']));
  }
  if (a.status !== 'completed' && a.status !== 'cancelled') {
    wrap.append(el('button', { class: 'btn btn-ghost', onClick: async () => {
      if (await confirmDialog({ title: 'Скасувати прийом?', danger: true, okText: 'Скасувати прийом' })) {
        try { await AppointmentService.cancel(a.id); Toast.info('Скасовано'); reload(); }
        catch (err) { Toast.fromError(err); }
      }
    } }, 'Скасувати'));
  }
  return wrap;
}

function openNextVisit(a, reload) {
  const d = new Date(); d.setDate(d.getDate() + 14); d.setHours(10, 0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const { form } = buildForm([
    { name: 'startAt', label: 'Дата і час', type: 'datetime-local', required: true, value: local },
    { name: 'reason', label: 'Причина', type: 'textarea', value: 'Повторний огляд', full: true },
  ], {
    submitText: 'Створити візит', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try {
        await AppointmentService.nextVisit(a.id, { startAt: new Date(v.startAt).toISOString(), reason: v.reason });
        Toast.success('Наступний візит створено'); ctrl.close(); reload();
      } catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: 'Наступний візит', body: form });
}

function medicalFields(a, editable, reload) {
  const fields = [
    { name: 'reason', label: 'Причина звернення', type: 'textarea', value: a.reason, full: true },
    { name: 'anamnesis', label: 'Анамнез', type: 'textarea', value: a.anamnesis, full: true },
    { name: 'symptoms', label: 'Симптоми', type: 'textarea', value: a.symptoms, full: true },
    { name: 'diagnosis', label: 'Діагноз', type: 'textarea', value: a.diagnosis, full: true },
    { name: 'treatment', label: 'Лікування', type: 'textarea', value: a.treatment, full: true },
    { name: 'recommendations', label: 'Рекомендації', type: 'textarea', value: a.recommendations, full: true },
    { name: 'weight', label: 'Вага, кг', type: 'number', min: 0, step: '0.001', value: a.weight != null ? Number(a.weight) : '' },
    { name: 'temperature', label: 'Температура, °C', type: 'number', step: '0.1', value: a.temperature != null ? Number(a.temperature) : '' },
  ];

  if (!editable) {
    return el('dl', { class: 'kv', style: 'margin-top:16px' }, fields.filter(f => a[f.name]).map((f) =>
      el('div', { style: 'display:contents' }, [el('dt', {}, f.label), el('dd', {}, String(a[f.name]))])));
  }

  const { form } = buildForm(fields, {
    submitText: 'Зберегти медкарту',
    onSubmit: async (values) => {
      if (!values.weight) values.weight = null;
      if (!values.temperature) values.temperature = null;
      try { await AppointmentService.update(a.id, values); Toast.success('Збережено'); }
      catch (err) { if (err?.fields) throw err; Toast.fromError(err); }
    },
  });
  form.style.marginTop = '16px';

  // Панель вставки шаблонів (ТЗ §6.7) — підставляє текст у відповідне поле форми
  const tplBar = el('div', { class: 'toolbar', style: 'margin-top:12px' }, [
    el('span', { class: 'muted', style: 'font-size:13px' }, 'Шаблони:'),
    tplBtn('Діагноз', 'diagnosis', 'f_diagnosis', form),
    tplBtn('Рекомендації', 'recommendation', 'f_recommendations', form),
    tplBtn('Процедура', 'procedure', 'f_treatment', form),
  ]);
  return el('div', {}, [tplBar, form]);
}

function tplBtn(label, type, fieldId, form) {
  return el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: async () => {
    let tpls;
    try {
      tpls = await TemplateService.list({ type });
    } catch (e) {
      Toast.error('Шаблони недоступні', e?.message || 'Не вдалося отримати шаблони');
      return;
    }
    if (!tpls.length) {
      const ctrl = openModal({ title: `Шаблони: ${label}`, body: el('div', {}, [
        el('p', { class: 'muted', style: 'margin-bottom:14px' }, 'Для цього розділу ще немає активних шаблонів. Додайте їх у налаштуваннях, і вони з’являться тут.'),
        el('div', { class: 'form-actions' }, [
          el('button', { class: 'btn btn-ghost', onClick: () => ctrl.close() }, 'Закрити'),
          el('button', { class: 'btn btn-primary', onClick: () => { ctrl.close(); navigate('/settings'); } }, 'До налаштувань'),
        ]),
      ]) });
      return;
    }
    const target = form.querySelector(`#${fieldId}`);
    const body = el('div', {}, tpls.map((t) => el('div', { class: 'list-line', style: 'cursor:pointer',
      onClick: () => {
        if (target) target.value = (target.value ? target.value + '\n' : '') + t.content;
        ctrl.close();
      } }, [el('strong', {}, t.name), el('div', { class: 'muted', style: 'font-size:13px' }, t.content)])));
    const ctrl = openModal({ title: `Шаблони: ${label}`, body });
  } }, `+ ${label}`);
}

function itemsBlock(a, editable, reload) {
  const block = el('div', { class: 'card card-pad', style: 'margin-top:16px' });

  // Послуги
  block.append(el('div', { class: 'page-head', style: 'margin-bottom:10px' }, [
    el('h2', { style: 'font-size:18px' }, 'Послуги та препарати'),
    editable && can('appointments.edit') ? el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => openServiceForm(a, reload) }, '+ Послуга'),
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => openDrugForm(a, reload) }, '+ Препарат'),
    ]) : null,
  ]));

  const items = [
    ...a.services.map((s) => ({ ...s, kind: 'Послуга' })),
    ...a.drugs.map((d) => ({ ...d, kind: 'Препарат' })),
  ];
  if (!items.length) {
    block.append(el('p', { class: 'muted' }, 'Позицій ще немає'));
  } else {
    let sum = 0;
    items.forEach((it) => {
      sum += Number(it.total || 0);
      block.append(el('div', { class: 'list-line', style: 'display:flex;justify-content:space-between;align-items:center' }, [
        el('div', {}, [
          el('strong', {}, it.name),
          el('span', { class: 'muted' }, `  · ${it.kind} · ${Number(it.quantity)} × ${money(it.price)}`),
        ]),
        el('div', { style: 'display:flex;gap:10px;align-items:center' }, [
          el('strong', {}, money(it.total)),
          editable && it.kind === 'Послуга' && can('appointments.edit')
            ? el('button', { class: 'btn btn-danger btn-sm', title: 'Видалити', onClick: async () => {
                try { await AppointmentService.removeService(a.id, it.id); Toast.success('Видалено'); reload(); }
                catch (err) { Toast.fromError(err); }
              } }, [icon('close', { size: 14 })]) : null,
        ]),
      ]));
    });
    block.append(el('div', { class: 'list-line', style: 'display:flex;justify-content:space-between;font-weight:700' }, [
      el('span', {}, 'Разом'), el('span', {}, money(sum)),
    ]));
  }
  return block;
}

async function openServiceForm(a, reload) {
  let services = [];
  try { services = await PriceService.list(); }
  catch (err) { Toast.fromError(err); return; }
  if (!services.length) {
    const ctrl = openModal({ title: 'Додати послугу', body: el('div', {}, [
      el('p', { class: 'muted', style: 'margin-bottom:14px' }, 'У прайсі ще немає послуг. Спочатку додайте послуги у прайс-листі.'),
      el('div', { class: 'form-actions' }, [
        el('button', { class: 'btn btn-ghost', onClick: () => ctrl.close() }, 'Закрити'),
        el('button', { class: 'btn btn-primary', onClick: () => { ctrl.close(); navigate('/price'); } }, 'До прайсу'),
      ]),
    ]) });
    return;
  }

  const { form } = buildForm([
    { name: 'serviceId', label: 'Послуга', type: 'select', required: true, full: true,
      options: services.map((s) => ({ value: s.id, label: `${s.name} · ${money(s.price)}` })) },
    { name: 'quantity', label: 'Кількість', type: 'number', min: 0, value: 1 },
    { name: 'price', label: 'Ціна', type: 'number', min: 0, required: true, value: 0 },
    { name: 'discount', label: 'Знижка (сума)', type: 'number', min: 0, value: 0 },
  ], {
    submitText: 'Додати', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      const svc = services.find((s) => s.id === v.serviceId);
      if (!svc) throw { fields: { serviceId: 'Оберіть послугу з прайсу' } };
      const payload = {
        serviceId: svc.id,
        name: svc.name,
        quantity: v.quantity,
        price: Number(v.price),
        discount: v.discount,
      };
      try { await AppointmentService.addService(a.id, payload); Toast.success('Послугу додано'); ctrl.close(); reload(); }
      catch (err) { if (err?.fields) throw err; Toast.fromError(err); }
    },
  });
  const serviceSelect = form.querySelector('#f_serviceId');
  const priceInput = form.querySelector('#f_price');
  const syncPrice = () => {
    const svc = services.find((s) => s.id === serviceSelect?.value);
    if (svc && priceInput) priceInput.value = Number(svc.price);
  };
  serviceSelect?.addEventListener('change', syncPrice);
  syncPrice();
  const ctrl = openModal({ title: 'Додати послугу', body: form });
}

function openDrugForm(a, reload) {
  const { form } = buildForm([
    { name: 'name', label: 'Назва препарату', required: true, full: true },
    { name: 'quantity', label: 'Кількість', type: 'number', min: 0, required: true, value: 1 },
    { name: 'unit', label: 'Одиниця', value: 'шт' },
    { name: 'price', label: 'Ціна за од.', type: 'number', min: 0, value: 0 },
  ], {
    submitText: 'Додати', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try { await AppointmentService.addDrug(a.id, v); Toast.success('Препарат додано'); ctrl.close(); reload(); }
      catch (err) { if (err?.fields) throw err; Toast.fromError(err); }
    },
  });
  const ctrl = openModal({ title: 'Додати препарат', body: form });
}
