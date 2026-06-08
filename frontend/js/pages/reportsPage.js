import { el, clear } from '../utils/dom.js';
import { ReportService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { money, fullName, fmtDate } from '../utils/format.js';
import { exportButton } from '../components/importExport.js';
import { barChart, lineChart } from '../components/chart.js';
import { renderReportBuilder } from './reportBuilder.js';

export function renderReportsPage(root) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const state = { tab: 'revenue', from: first.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };

  const fromI = el('input', { id: 'reports-from', type: 'date', value: state.from, onChange: (e) => { state.from = e.target.value; load(); } });
  const toI = el('input', { id: 'reports-to', type: 'date', value: state.to, onChange: (e) => { state.to = e.target.value; load(); } });

  const toolbar = el('div', { class: 'toolbar reports-toolbar' }, [
    el('div', { class: 'reports-period' }, [
      el('label', { class: 'reports-date-field', for: 'reports-from' }, [el('span', {}, 'з'), fromI]),
      el('label', { class: 'reports-date-field', for: 'reports-to' }, [el('span', {}, 'по'), toI]),
    ]),
    el('div', { class: 'reports-actions' }, [
      exportButton('/export/debtors.csv', 'debtors.csv', 'Боржники CSV'),
      exportButton('/export/warehouse.csv', 'warehouse.csv', 'Склад CSV'),
    ]),
  ]);
  root.append(el('div', { class: 'page-head' }, [el('h1', {}, 'Звіти'), toolbar]));

  const tabsBar = el('div', { class: 'tabs' });
  const container = el('div');
  root.append(tabsBar, container);

  const TABS = [
    ['revenue', 'Виручка'], ['doctors', 'Лікарі'], ['services', 'Послуги'],
    ['drugs', 'Препарати'], ['warehouse', 'Склад'], ['debtors', 'Боржники'],
    ['builder', 'Конструктор'],
  ];
  TABS.forEach(([key, label], i) => {
    const t = el('div', { class: `tab ${i === 0 ? 'active' : ''}`, onClick: () => {
      state.tab = key; tabsBar.querySelectorAll('.tab').forEach((x) => x.classList.remove('active')); t.classList.add('active'); load();
    } }, label);
    tabsBar.append(t);
  });

  async function load() {
    // Конструктор має власні елементи керування — ховаємо спільний тулбар періоду
    toolbar.style.display = state.tab === 'builder' ? 'none' : '';
    if (state.tab === 'builder') { clear(container); renderReportBuilder(container); return; }

    clear(container); container.append(el('div', { class: 'table-state' }, [el('div', { class: 'spinner' })]));
    const p = { from: state.from, to: state.to };
    try {
      let node;
      if (state.tab === 'revenue') {
        const d = await ReportService.revenue(p);
        const chartData = d.byDay.map((r) => ({ label: new Date(r.day).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }), value: Number(r.net) }));
        node = el('div', {}, [
          el('div', { class: 'stats-grid' }, [
            stat('Чиста виручка', money(d.totals.net)), stat('Готівка', money(d.totals.cash)), stat('Картка', money(d.totals.card)),
          ]),
          chartData.length ? el('div', { class: 'card card-pad', style: 'margin-bottom:16px' }, [
            el('h3', { style: 'font-size:14px;margin-bottom:6px' }, 'Динаміка виручки'),
            lineChart(chartData, { format: (v) => money(v) }),
          ]) : null,
          renderTable([
            { title: 'День', render: (r) => fmtDate(r.day) },
            { title: 'Надходження', render: (r) => money(r.income) },
            { title: 'Повернення', render: (r) => money(r.refunds || 0) },
            { title: 'Чисто', render: (r) => el('strong', {}, money(r.net)) },
          ], d.byDay, { emptyText: 'Немає платежів за період' }),
        ]);
      } else if (state.tab === 'doctors') {
        const d = await ReportService.doctors(p);
        const withWork = d.doctors.filter((r) => Number(r.appointments) > 0);
        node = el('div', {}, [
          withWork.length ? el('div', { class: 'card card-pad', style: 'margin-bottom:16px' }, [
            el('h3', { style: 'font-size:14px;margin-bottom:6px' }, 'Прийоми за лікарями'),
            barChart(withWork.map((r) => ({ label: r.last_name || r.first_name, value: Number(r.appointments) })), { format: (v) => `${v}` }),
          ]) : null,
          renderTable([
            { title: 'Лікар', render: (r) => fullName(r) },
            { title: 'Прийомів', render: (r) => String(r.appointments) },
            { title: 'Сума послуг', render: (r) => money(r.services_sum) },
          ], d.doctors, { emptyText: 'Немає даних' }),
        ]);
      } else if (state.tab === 'services' || state.tab === 'drugs') {
        const d = state.tab === 'services' ? await ReportService.services(p) : await ReportService.drugs(p);
        const list = d.services || d.drugs;
        node = renderTable([
          { title: 'Назва', render: (r) => r.name },
          { title: 'Кількість', render: (r) => String(Number(r.qty)) },
          { title: 'Сума', render: (r) => el('strong', {}, money(r.total)) },
        ], list, { emptyText: 'Немає даних за період' });
      } else if (state.tab === 'warehouse') {
        const d = await ReportService.warehouse();
        node = el('div', {}, [
          el('div', { class: 'stats-grid' }, [stat('Вартість складу', money(d.totalValue))]),
          renderTable([
            { title: 'Препарат', render: (r) => r.name },
            { title: 'Залишок', render: (r) => `${Number(r.qty)} ${r.unit}` },
            { title: 'Вартість', render: (r) => money(r.stock_value) },
          ], d.items, { emptyText: 'Склад порожній' }),
        ]);
      } else if (state.tab === 'debtors') {
        const d = await ReportService.debtors();
        node = renderTable([
          { title: 'Власник', render: (r) => fullName(r) },
          { title: 'Телефон', render: (r) => r.phone || '—' },
          { title: 'Борг', render: (r) => el('strong', { class: 'badge badge-red' }, money(r.debt)) },
        ], d.debtors, { emptyText: 'Боржників немає' });
      }
      clear(container); container.append(node);
    } catch (e) { Toast.fromError(e); clear(container); container.append(el('p', { class: 'muted' }, 'Помилка завантаження')); }
  }

  function stat(label, value) {
    return el('div', { class: 'stat' }, [el('div', { class: 'stat__label' }, label), el('div', { class: 'stat__value', style: 'font-size:24px' }, value)]);
  }
  load();
}
