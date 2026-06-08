/**
 * Декларативна схема конструктора звітів.
 *
 * Безпека: клієнт оперує ЛИШЕ ключами (datasetKey, dimension/measure/filter keys).
 * Жодного SQL-фрагмента з клієнта не приймається — увесь SQL збирається на сервері
 * з білого списку нижче, значення фільтрів параметризуються ($1, $2, ...).
 *
 * Кожен dataset:
 *   - base: FROM/JOIN з обов'язковим `{clinic}` плейсхолдером для clinic_id-параметра
 *   - permission: яке право потрібне для перегляду (перевіряється у роуті)
 *   - dimensions: колонки для GROUP BY (sql — вираз, type — для форматування)
 *   - measures: агрегати (sql — агрегатний вираз)
 *   - filters: дозволені фільтри (sql — лівий бік умови, type — як парсити значення)
 *   - dateField: колонка для фільтра періоду from/to (необов'язково)
 */

export const DATASETS = {
  payments: {
    label: 'Платежі (каса)',
    permission: 'finance.view',
    base: 'payments p',
    where: 'p.clinic_id = {clinic}',
    dateField: 'date(p.created_at)',
    dimensions: {
      day: { label: 'День', sql: 'date(p.created_at)', type: 'date' },
      month: { label: 'Місяць', sql: "to_char(p.created_at, 'YYYY-MM')", type: 'string' },
      method: { label: 'Спосіб оплати', sql: 'p.method', type: 'string' },
      status: { label: 'Статус', sql: 'p.status', type: 'string' },
    },
    measures: {
      amount_sum: { label: 'Сума', sql: 'COALESCE(SUM(p.amount),0)', type: 'money' },
      amount_avg: { label: 'Середній чек', sql: 'COALESCE(AVG(p.amount),0)', type: 'money' },
      count: { label: 'К-сть платежів', sql: 'COUNT(*)', type: 'number' },
    },
    filters: {
      method: { label: 'Спосіб оплати', sql: 'p.method', type: 'string' },
      status: { label: 'Статус', sql: 'p.status', type: 'string' },
    },
  },

  invoice_items: {
    label: 'Позиції рахунків',
    permission: 'finance.view',
    base: 'invoice_items ii JOIN invoices i ON i.id = ii.invoice_id',
    where: 'i.clinic_id = {clinic} AND i.deleted_at IS NULL',
    dateField: 'date(i.created_at)',
    dimensions: {
      day: { label: 'День', sql: 'date(i.created_at)', type: 'date' },
      month: { label: 'Місяць', sql: "to_char(i.created_at, 'YYYY-MM')", type: 'string' },
      type: { label: 'Тип', sql: 'ii.type', type: 'string' },
      name: { label: 'Назва позиції', sql: 'ii.name', type: 'string' },
    },
    measures: {
      total_sum: { label: 'Сума', sql: 'COALESCE(SUM(ii.total),0)', type: 'money' },
      qty_sum: { label: 'Кількість', sql: 'COALESCE(SUM(ii.quantity),0)', type: 'number' },
      count: { label: 'К-сть рядків', sql: 'COUNT(*)', type: 'number' },
    },
    filters: {
      type: { label: 'Тип (service/drug)', sql: 'ii.type', type: 'string' },
    },
  },

  appointments: {
    label: 'Прийоми',
    permission: 'appointments.view',
    base: 'appointments a LEFT JOIN users u ON u.id = a.doctor_id',
    where: 'a.clinic_id = {clinic} AND a.deleted_at IS NULL',
    dateField: 'date(COALESCE(a.completed_at, a.created_at))',
    dimensions: {
      day: { label: 'День', sql: 'date(COALESCE(a.completed_at, a.created_at))', type: 'date' },
      month: { label: 'Місяць', sql: "to_char(COALESCE(a.completed_at, a.created_at), 'YYYY-MM')", type: 'string' },
      status: { label: 'Статус', sql: 'a.status', type: 'string' },
      doctor: { label: 'Лікар', sql: "COALESCE(u.last_name || ' ' || u.first_name, '—')", type: 'string' },
    },
    measures: {
      count: { label: 'К-сть прийомів', sql: 'COUNT(*)', type: 'number' },
      avg_weight: { label: 'Середня вага', sql: 'COALESCE(AVG(a.weight),0)', type: 'number' },
    },
    filters: {
      status: { label: 'Статус', sql: 'a.status', type: 'string' },
    },
  },

  patients: {
    label: 'Пацієнти',
    permission: 'patients.view',
    base: 'patients p',
    where: 'p.clinic_id = {clinic} AND p.deleted_at IS NULL',
    dateField: 'date(p.created_at)',
    dimensions: {
      species: { label: 'Вид', sql: "COALESCE(NULLIF(p.species,''), '—')", type: 'string' },
      sex: { label: 'Стать', sql: 'p.sex', type: 'string' },
      status: { label: 'Статус', sql: 'p.status', type: 'string' },
      month: { label: 'Місяць реєстрації', sql: "to_char(p.created_at, 'YYYY-MM')", type: 'string' },
    },
    measures: {
      count: { label: 'К-сть пацієнтів', sql: 'COUNT(*)', type: 'number' },
      avg_weight: { label: 'Середня вага', sql: 'COALESCE(AVG(p.weight),0)', type: 'number' },
    },
    filters: {
      species: { label: 'Вид', sql: 'p.species', type: 'string' },
      status: { label: 'Статус', sql: 'p.status', type: 'string' },
    },
  },
};

/** Публічний опис схеми для фронтенду (без SQL). */
export function describeDatasets() {
  const out = {};
  for (const [key, ds] of Object.entries(DATASETS)) {
    const pick = (obj) => Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, { label: v.label, type: v.type }]),
    );
    out[key] = {
      label: ds.label,
      permission: ds.permission,
      hasDate: Boolean(ds.dateField),
      dimensions: pick(ds.dimensions),
      measures: pick(ds.measures),
      filters: pick(ds.filters),
    };
  }
  return out;
}
