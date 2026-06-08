import { el, clear } from '../utils/dom.js';
import { ReportService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { barChart } from '../components/chart.js';
import { Toast } from '../components/toast.js';
import { downloadFilePost } from '../api.js';
import { money, fmtDate } from '../utils/format.js';
import { icon } from '../components/icons.js';

const OPS = [
  ['eq', '='], ['ne', '≠'], ['gt', '>'], ['gte', '≥'],
  ['lt', '<'], ['lte', '≤'], ['like', 'містить'],
];

/**
 * Конструктор звітів (§20): набір даних → виміри (групування) + показники +
 * фільтри + період. Усе валідується на бекенді проти білого списку схеми.
 */
export function renderReportBuilder(root) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);

  const state = {
    schema: null,
    dataset: null,
    dimensions: [],
    measures: [],
    filters: [],
    from: first.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
    orderBy: null,
  };

  const panel = el('div', { class: 'card card-pad', style: 'margin-bottom:16px' });
  const result = el('div');
  root.append(panel, result);

  ReportService.builderSchema()
    .then((d) => { state.schema = d.datasets; state.dataset = Object.keys(d.datasets)[0] || null; renderPanel(); })
    .catch((e) => { Toast.fromError(e); panel.append(el('p', { class: 'muted' }, 'Не вдалося завантажити схему')); });

  function ds() { return state.schema?.[state.dataset]; }

  function renderPanel() {
    clear(panel);
    const def = ds();
    if (!def) return;

    // 1. Набір даних
    const datasetSel = el('select', { class: 'input', onChange: (e) => {
      state.dataset = e.target.value;
      state.dimensions = []; state.measures = []; state.filters = []; state.orderBy = null;
      renderPanel();
    } }, Object.entries(state.schema).map(([k, v]) =>
      el('option', { value: k, selected: k === state.dataset }, v.label)));

    // 2. Виміри (групування) — чекбокси
    const dimsBox = el('div', { class: 'rb-chips' },
      Object.entries(def.dimensions).map(([k, v]) => chip(v.label, state.dimensions.includes(k), () => {
        toggle(state.dimensions, k); renderPanel();
      })));

    // 3. Показники — чекбокси
    const measBox = el('div', { class: 'rb-chips' },
      Object.entries(def.measures).map(([k, v]) => chip(v.label, state.measures.includes(k), () => {
        toggle(state.measures, k); renderPanel();
      })));

    // 4. Період (якщо набір має дату)
    const periodRow = def.hasDate ? el('div', { class: 'field-row' }, [
      el('label', { class: 'field' }, [el('span', {}, 'Період з'),
        el('input', { type: 'date', class: 'input', value: state.from, onChange: (e) => { state.from = e.target.value; } })]),
      el('label', { class: 'field' }, [el('span', {}, 'по'),
        el('input', { type: 'date', class: 'input', value: state.to, onChange: (e) => { state.to = e.target.value; } })]),
    ]) : null;

    // 5. Фільтри
    const filtersBox = el('div');
    renderFilters(filtersBox, def);

    // 6. Сортування
    const sortOptions = [
      el('option', { value: '' }, 'За замовчуванням'),
      ...state.dimensions.map((k) => el('option', { value: `${k}`, selected: state.orderBy?.key === k }, `${def.dimensions[k].label} ↑↓`)),
      ...state.measures.map((k) => el('option', { value: `${k}`, selected: state.orderBy?.key === k }, `${def.measures[k].label} ↑↓`)),
    ];
    const sortSel = el('select', { class: 'input', onChange: (e) => {
      state.orderBy = e.target.value ? { key: e.target.value, dir: state.orderBy?.dir || 'desc' } : null;
    } }, sortOptions);
    const dirSel = el('select', { class: 'input', onChange: (e) => {
      if (state.orderBy) state.orderBy.dir = e.target.value;
    } }, [
      el('option', { value: 'desc', selected: state.orderBy?.dir !== 'asc' }, '↓ спадання'),
      el('option', { value: 'asc', selected: state.orderBy?.dir === 'asc' }, '↑ зростання'),
    ]);

    const runBtn = el('button', { class: 'btn btn-primary', onClick: run }, [icon('chart', { size: 16 }), ' Побудувати']);
    const csvBtn = el('button', { class: 'btn btn-ghost', onClick: exportCsv }, [icon('download', { size: 15 }), ' CSV']);

    panel.append(
      group('Набір даних', datasetSel),
      group('Групування (виміри)', dimsBox),
      group('Показники', measBox),
      periodRow ? group('Період', periodRow) : null,
      group('Фільтри', filtersBox),
      group('Сортування', el('div', { class: 'field-row' }, [sortSel, dirSel])),
      el('div', { class: 'form-actions', style: 'margin-top:14px' }, [runBtn, csvBtn]),
    );
  }

  function renderFilters(box, def) {
    clear(box);
    state.filters.forEach((f, idx) => {
      const fieldSel = el('select', { class: 'input', onChange: (e) => { f.field = e.target.value; } },
        Object.entries(def.filters).map(([k, v]) => el('option', { value: k, selected: k === f.field }, v.label)));
      const opSel = el('select', { class: 'input', onChange: (e) => { f.op = e.target.value; } },
        OPS.map(([k, lbl]) => el('option', { value: k, selected: k === f.op }, lbl)));
      const valInput = el('input', { class: 'input', value: f.value || '', placeholder: 'значення', onInput: (e) => { f.value = e.target.value; } });
      const del = el('button', { class: 'btn btn-ghost btn-sm', title: 'Прибрати', onClick: () => { state.filters.splice(idx, 1); renderFilters(box, def); } }, '✕');
      box.append(el('div', { class: 'field-row', style: 'margin-bottom:6px' }, [fieldSel, opSel, valInput, del]));
    });
    if (Object.keys(def.filters).length) {
      box.append(el('button', { class: 'btn btn-ghost btn-sm', onClick: () => {
        const firstField = Object.keys(def.filters)[0];
        state.filters.push({ field: firstField, op: 'eq', value: '' });
        renderFilters(box, def);
      } }, '+ Фільтр'));
    } else {
      box.append(el('span', { class: 'muted' }, 'Немає доступних фільтрів'));
    }
  }

  function spec() {
    const def = ds();
    return {
      dataset: state.dataset,
      dimensions: state.dimensions,
      measures: state.measures,
      filters: state.filters.filter((f) => f.value !== ''),
      from: def?.hasDate ? state.from : undefined,
      to: def?.hasDate ? state.to : undefined,
      orderBy: state.orderBy,
      limit: 500,
    };
  }

  async function run() {
    if (!state.measures.length) { Toast.error('Оберіть хоча б один показник'); return; }
    clear(result); result.append(el('div', { class: 'table-state' }, [el('div', { class: 'spinner' })]));
    try {
      const d = await ReportService.builderRun(spec());
      clear(result); result.append(renderResult(d));
    } catch (e) { Toast.fromError(e); clear(result); result.append(el('p', { class: 'muted' }, 'Помилка побудови')); }
  }

  async function exportCsv() {
    if (!state.measures.length) { Toast.error('Оберіть хоча б один показник'); return; }
    try { await downloadFilePost('/reports/builder/export.csv', 'report.csv', spec()); Toast.success('Завантажено', 'report.csv'); }
    catch (e) { Toast.fromError(e); }
  }

  function renderResult(d) {
    const fmt = (col, v) => {
      if (v == null) return '—';
      if (col.type === 'money') return money(v);
      if (col.type === 'number') return Number(v).toLocaleString('uk-UA', { maximumFractionDigits: 2 });
      if (col.type === 'date') return fmtDate(v);
      return String(v);
    };
    const columns = d.columns.map((col) => ({
      title: col.label + (col.role === 'measure' ? '' : ''),
      render: (r) => (col.role === 'measure' ? el('strong', {}, fmt(col, r[col.key])) : fmt(col, r[col.key])),
    }));

    // Графік: 1 вимір + 1 числовий показник
    const dim = d.columns.find((c) => c.role === 'dimension');
    const meas = d.columns.find((c) => c.role === 'measure' && (c.type === 'money' || c.type === 'number'));
    let chart = null;
    if (dim && meas && d.rows.length > 1 && d.rows.length <= 30) {
      const data = d.rows.map((r) => ({
        label: String(fmt(dim, r[dim.key])).slice(0, 12),
        value: Number(r[meas.key] || 0),
      }));
      chart = el('div', { class: 'card card-pad', style: 'margin-bottom:16px' }, [
        el('h3', { style: 'font-size:14px;margin-bottom:6px' }, meas.label),
        barChart(data, { format: (v) => (meas.type === 'money' ? money(v) : String(v)) }),
      ]);
    }

    // Підсумковий рядок
    const totalsRow = Object.keys(d.totals).length ? el('div', { class: 'stats-grid', style: 'margin-bottom:12px' },
      d.columns.filter((c) => c.role === 'measure' && d.totals[c.key] !== undefined).map((c) =>
        el('div', { class: 'stat' }, [
          el('div', { class: 'stat__label' }, `Σ ${c.label}`),
          el('div', { class: 'stat__value', style: 'font-size:22px' }, fmt(c, d.totals[c.key])),
        ]))) : null;

    return el('div', {}, [
      el('p', { class: 'muted', style: 'margin-bottom:8px' }, `Рядків: ${d.rowCount}${d.rowCount >= d.limit ? ` (обмеження ${d.limit})` : ''}`),
      totalsRow,
      chart,
      renderTable(columns, d.rows, { emptyText: 'Немає даних за заданими параметрами' }),
    ]);
  }
}

function group(label, node) {
  return el('div', { class: 'rb-group' }, [el('label', { class: 'rb-label' }, label), node]);
}

function chip(label, active, onClick) {
  return el('button', { class: `rb-chip ${active ? 'active' : ''}`, onClick }, label);
}

function toggle(arr, key) {
  const i = arr.indexOf(key);
  if (i >= 0) arr.splice(i, 1); else arr.push(key);
}
