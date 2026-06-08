import { el, clear } from '../utils/dom.js';
import { SalaryService, UserService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { openModal } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { money, fullName, fmtDate } from '../utils/format.js';

export async function renderSalaryPage(root) {
  const state = { rules: [], payments: [], staff: [] };
  root.append(el('div', { class: 'page-head' }, [
    el('h1', {}, 'Зарплати'),
    el('div', { class: 'toolbar' }, [
      can('salary.manage') ? el('button', { class: 'btn btn-ghost', onClick: () => openCalc(state.staff) }, 'Розрахувати') : null,
      can('salary.manage') ? el('button', { class: 'btn btn-primary', onClick: () => openRule(state.staff, reload) }, '+ Правило') : null,
    ]),
  ]));
  const rulesC = el('div', { class: 'card card-pad', style: 'margin-bottom:16px' }, [el('div', { class: 'spinner' })]);
  const payC = el('div', { class: 'card card-pad' }, [el('div', { class: 'spinner' })]);
  root.append(rulesC, payC);

  async function load() {
    try {
      [state.rules, state.payments, state.staff] = await Promise.all([
        SalaryService.rules(), SalaryService.payments(), UserService.list().catch(() => []),
      ]);
    } catch (e) { Toast.fromError(e); }
    render();
  }
  function reload() { load(); }
  function render() {
    clear(rulesC); rulesC.append(el('h2', { style: 'font-size:16px;margin-bottom:10px' }, 'Правила нарахування'));
    rulesC.append(renderTable([
      { title: 'Співробітник', render: (r) => fullName(r) },
      { title: 'Тип', render: (r) => ({ fixed: 'Фікс', percent: 'Відсоток', mixed: 'Змішаний' })[r.type] || r.type },
      { title: 'Ставка', render: (r) => money(r.fixed_amount) },
      { title: '% послуг', render: (r) => `${Number(r.service_percent)}%` },
      { title: '% препаратів', render: (r) => `${Number(r.drug_percent)}%` },
    ], state.rules, { emptyText: 'Правил ще немає' }));

    clear(payC); payC.append(el('h2', { style: 'font-size:16px;margin-bottom:10px' }, 'Виплати'));
    payC.append(renderTable([
      { title: 'Співробітник', render: (p) => fullName(p) },
      { title: 'Період', render: (p) => `${fmtDate(p.period_from)} – ${fmtDate(p.period_to)}` },
      { title: 'Сума', render: (p) => el('strong', {}, money(p.amount)) },
      { title: 'Виплачено', render: (p) => fmtDate(p.paid_at) },
    ], state.payments, { emptyText: 'Виплат ще не було' }));
  }
  load();
}

function openRule(staff, onSaved) {
  const { form } = buildForm([
    { name: 'userId', label: 'Співробітник', type: 'select', required: true, full: true,
      options: staff.map((u) => ({ value: u.id, label: fullName(u) })) },
    { name: 'type', label: 'Тип', type: 'select', value: 'mixed',
      options: [{ value: 'fixed', label: 'Фіксована' }, { value: 'percent', label: 'Відсоток' }, { value: 'mixed', label: 'Змішана' }] },
    { name: 'fixedAmount', label: 'Ставка', type: 'number', min: 0, value: 0 },
    { name: 'servicePercent', label: '% з послуг', type: 'number', min: 0, max: 100, value: 0 },
    { name: 'drugPercent', label: '% з препаратів', type: 'number', min: 0, max: 100, value: 0 },
    { name: 'profitPercent', label: '% з прибутку', type: 'number', min: 0, max: 100, value: 0 },
  ], {
    submitText: 'Зберегти', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try { await SalaryService.saveRule(v); Toast.success('Збережено'); ctrl.close(); onSaved?.(); }
      catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: 'Правило зарплати', body: form });
}

function openCalc(staff) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const resultBox = el('div', { style: 'margin-top:12px' });
  const { form } = buildForm([
    { name: 'userId', label: 'Співробітник', type: 'select', required: true, full: true,
      options: staff.map((u) => ({ value: u.id, label: fullName(u) })) },
    { name: 'from', label: 'З', type: 'date', required: true, value: first.toISOString().slice(0, 10) },
    { name: 'to', label: 'По', type: 'date', required: true, value: today.toISOString().slice(0, 10) },
  ], {
    submitText: 'Розрахувати', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try {
        const r = await SalaryService.calculate(v);
        clear(resultBox);
        resultBox.append(el('dl', { class: 'kv' }, [
          kv('Сума послуг', money(r.servicesSum)), kv('Сума препаратів', money(r.drugsSum)),
          kv('Фіксована', money(r.fixed)), kv('З послуг', money(r.fromServices)), kv('З препаратів', money(r.fromDrugs)),
          kv('Разом', el('strong', {}, money(r.total))),
        ]));
        resultBox.append(el('button', { class: 'btn btn-primary', style: 'margin-top:12px', onClick: async () => {
          try { await SalaryService.pay({ userId: v.userId, from: v.from, to: v.to, amount: Number(r.total) });
            Toast.success('Виплату зафіксовано'); ctrl.close(); }
          catch (e) { Toast.fromError(e); }
        } }, 'Зафіксувати виплату'));
      } catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: 'Розрахунок зарплати', body: el('div', {}, [form, resultBox]) });
}

function kv(label, value) {
  return el('div', { style: 'display:contents' }, [el('dt', {}, label), el('dd', {}, value)]);
}
