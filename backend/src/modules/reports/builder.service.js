import { query } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { DATASETS } from './builder.schema.js';

const MAX_ROWS = 1000;
const FILTER_OPS = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'ILIKE' };

function coerce(type, raw) {
  if (type === 'number' || type === 'money') {
    const n = Number(raw);
    if (Number.isNaN(n)) throw ApiError.validation('Фільтр очікує число');
    return n;
  }
  return String(raw);
}

/**
 * Збирає звіт за специфікацією. Усе перевіряється проти білого списку схеми;
 * значення параметризуються. clinicId підставляється сервером — клієнт ним не керує.
 *
 * spec = {
 *   dataset: string,
 *   dimensions: string[],            // ключі групування (0..3)
 *   measures: string[],              // ключі агрегатів (>=1)
 *   filters: [{ field, op, value }], // op із FILTER_OPS
 *   from, to,                        // період по dateField (необов'язково)
 *   orderBy: { key, dir },           // key = dimension|measure, dir = asc|desc
 *   limit: number
 * }
 */
export async function buildReport(clinicId, spec, user) {
  const ds = DATASETS[spec.dataset];
  if (!ds) throw ApiError.validation('Невідомий набір даних');
  const fullAccess = user.role === 'superadmin' || user.role === 'owner';
  if (!fullAccess && !(user.permissions || []).includes(ds.permission)) {
    throw ApiError.forbidden('Немає доступу до цього набору даних');
  }

  const dims = Array.isArray(spec.dimensions) ? spec.dimensions : [];
  const measures = Array.isArray(spec.measures) ? spec.measures : [];
  if (dims.length > 3) throw ApiError.validation('Не більше 3 групувань');
  if (!measures.length) throw ApiError.validation('Оберіть хоча б один показник');

  // Параметри: $1 — clinic_id
  const params = [clinicId];
  const where = [ds.where.replace('{clinic}', '$1')];

  // SELECT-частини + опис колонок для фронтенду
  const selectParts = [];
  const columns = [];
  const groupByIdx = [];

  dims.forEach((key) => {
    const d = ds.dimensions[key];
    if (!d) throw ApiError.validation(`Невідоме групування: ${key}`);
    selectParts.push(`${d.sql} AS "${key}"`);
    columns.push({ key, label: d.label, type: d.type, role: 'dimension' });
    groupByIdx.push(String(selectParts.length)); // GROUP BY за порядковим номером
  });

  measures.forEach((key) => {
    const m = ds.measures[key];
    if (!m) throw ApiError.validation(`Невідомий показник: ${key}`);
    selectParts.push(`${m.sql} AS "${key}"`);
    columns.push({ key, label: m.label, type: m.type, role: 'measure' });
  });

  // Фільтр періоду
  if (ds.dateField) {
    if (spec.from) { params.push(spec.from); where.push(`${ds.dateField} >= $${params.length}`); }
    if (spec.to) { params.push(spec.to); where.push(`${ds.dateField} <= $${params.length}`); }
  }

  // Довільні фільтри з білого списку
  for (const f of (Array.isArray(spec.filters) ? spec.filters : [])) {
    const def = ds.filters[f.field];
    if (!def) throw ApiError.validation(`Невідомий фільтр: ${f.field}`);
    const op = FILTER_OPS[f.op];
    if (!op) throw ApiError.validation(`Невідомий оператор: ${f.op}`);
    if (f.value === undefined || f.value === null || f.value === '') continue;
    const val = op === 'ILIKE' ? `%${f.value}%` : coerce(def.type, f.value);
    params.push(val);
    where.push(`${def.sql} ${op} $${params.length}`);
  }

  // ORDER BY — лише за відомим ключем
  let orderSql = '';
  if (spec.orderBy && spec.orderBy.key) {
    const known = ds.dimensions[spec.orderBy.key] || ds.measures[spec.orderBy.key];
    if (!known) throw ApiError.validation('Невідоме сортування');
    const dir = spec.orderBy.dir === 'asc' ? 'ASC' : 'DESC';
    orderSql = ` ORDER BY "${spec.orderBy.key}" ${dir} NULLS LAST`;
  } else if (groupByIdx.length) {
    orderSql = ` ORDER BY 1`;
  }

  const limit = Math.min(MAX_ROWS, Math.max(1, Number(spec.limit) || 200));
  const groupSql = groupByIdx.length ? ` GROUP BY ${groupByIdx.join(', ')}` : '';

  const sql = `SELECT ${selectParts.join(', ')} FROM ${ds.base} WHERE ${where.join(' AND ')}${groupSql}${orderSql} LIMIT ${limit}`;
  const { rows } = await query(sql, params);

  // Підсумки по числових показниках
  const totals = {};
  measures.forEach((key) => {
    const m = ds.measures[key];
    if (m.type === 'money' || m.type === 'number') {
      totals[key] = rows.reduce((s, r) => s + Number(r[key] || 0), 0);
    }
  });

  return { dataset: spec.dataset, columns, rows, totals, rowCount: rows.length, limit };
}
