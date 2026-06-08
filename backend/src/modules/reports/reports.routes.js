import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { describeDatasets } from './builder.schema.js';
import { buildReport } from './builder.service.js';
import { toCSV } from '../../utils/csv.js';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);
reportsRouter.use(requirePermission('reports.view', 'finance.view'));

// Період: ?from=YYYY-MM-DD&to=YYYY-MM-DD (за замовч. поточний місяць)
function period(req) {
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const from = req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  return { from, to };
}

// Виручка за платежами
reportsRouter.get('/revenue', asyncHandler(async (req, res) => {
  const { from, to } = period(req);
  const { rows } = await query(
    `SELECT date(created_at) AS day,
            SUM(amount) FILTER (WHERE amount > 0) AS income,
            SUM(amount) FILTER (WHERE amount < 0) AS refunds,
            SUM(amount) AS net
       FROM payments
      WHERE clinic_id=$1 AND date(created_at) BETWEEN $2 AND $3
      GROUP BY day ORDER BY day`, [req.user.clinicId, from, to]);
  const totals = (await query(
    `SELECT COALESCE(SUM(amount),0) AS net,
            COALESCE(SUM(amount) FILTER (WHERE method='cash'),0) AS cash,
            COALESCE(SUM(amount) FILTER (WHERE method='card'),0) AS card
       FROM payments WHERE clinic_id=$1 AND date(created_at) BETWEEN $2 AND $3`,
    [req.user.clinicId, from, to])).rows[0];
  ok(res, { from, to, byDay: rows, totals });
}));

// Прибуток (виручка послуг/препаратів мінус собівартість — спрощено)
reportsRouter.get('/profit', asyncHandler(async (req, res) => {
  const { from, to } = period(req);
  const { rows } = await query(
    `SELECT
        COALESCE(SUM(ii.total),0) AS revenue
       FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id
      WHERE i.clinic_id=$1 AND date(i.created_at) BETWEEN $2 AND $3 AND i.deleted_at IS NULL`,
    [req.user.clinicId, from, to]);
  ok(res, { from, to, ...rows[0] });
}));

// Лікарі: к-сть прийомів, сума по послугах
reportsRouter.get('/doctors', asyncHandler(async (req, res) => {
  const { from, to } = period(req);
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_name,
            COUNT(DISTINCT a.id) AS appointments,
            COALESCE(SUM(asv.total),0) AS services_sum
       FROM users u
       LEFT JOIN appointments a ON a.doctor_id=u.id AND a.status='completed'
            AND date(a.completed_at) BETWEEN $2 AND $3
       LEFT JOIN appointment_services asv ON asv.appointment_id=a.id
      WHERE u.clinic_id=$1 AND u.deleted_at IS NULL
      GROUP BY u.id ORDER BY appointments DESC`, [req.user.clinicId, from, to]);
  ok(res, { from, to, doctors: rows });
}));

// Склад: вартість залишків
reportsRouter.get('/warehouse', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.name, d.unit, COALESCE(SUM(b.quantity),0) AS qty,
            COALESCE(SUM(b.quantity * b.purchase_price),0) AS stock_value,
            d.min_stock
       FROM drugs d LEFT JOIN stock_batches b ON b.drug_id=d.id
      WHERE d.clinic_id=$1 AND d.deleted_at IS NULL
      GROUP BY d.id ORDER BY d.name`, [req.user.clinicId]);
  const total = rows.reduce((s, r) => s + Number(r.stock_value), 0);
  ok(res, { items: rows, totalValue: total.toFixed(2) });
}));

// Боржники
reportsRouter.get('/debtors', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, o.first_name, o.last_name, o.phone,
            COALESCE(SUM(d.amount - d.paid_amount),0) AS debt
       FROM owners o JOIN debts d ON d.owner_id=o.id AND d.status='active'
      WHERE o.clinic_id=$1 AND o.deleted_at IS NULL
      GROUP BY o.id HAVING COALESCE(SUM(d.amount - d.paid_amount),0) > 0
      ORDER BY debt DESC`, [req.user.clinicId]);
  ok(res, { debtors: rows });
}));

// ТОП послуг
reportsRouter.get('/services', asyncHandler(async (req, res) => {
  const { from, to } = period(req);
  const { rows } = await query(
    `SELECT ii.name, SUM(ii.quantity) AS qty, SUM(ii.total) AS total
       FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id
      WHERE i.clinic_id=$1 AND ii.type='service' AND date(i.created_at) BETWEEN $2 AND $3
      GROUP BY ii.name ORDER BY total DESC LIMIT 50`, [req.user.clinicId, from, to]);
  ok(res, { from, to, services: rows });
}));

// ТОП препаратів
reportsRouter.get('/drugs', asyncHandler(async (req, res) => {
  const { from, to } = period(req);
  const { rows } = await query(
    `SELECT ii.name, SUM(ii.quantity) AS qty, SUM(ii.total) AS total
       FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id
      WHERE i.clinic_id=$1 AND ii.type='drug' AND date(i.created_at) BETWEEN $2 AND $3
      GROUP BY ii.name ORDER BY total DESC LIMIT 50`, [req.user.clinicId, from, to]);
  ok(res, { from, to, drugs: rows });
}));

// ---- Конструктор звітів (§20) ----

// Опис доступних наборів даних/вимірів/показників (без SQL) для UI
reportsRouter.get('/builder/schema', asyncHandler(async (req, res) => {
  ok(res, { datasets: describeDatasets() });
}));

// Виконати довільний звіт за специфікацією
reportsRouter.post('/builder/run', asyncHandler(async (req, res) => {
  const result = await buildReport(req.user.clinicId, req.body || {}, req.user);
  ok(res, result);
}));

// Експорт того ж звіту в CSV
reportsRouter.post('/builder/export.csv', asyncHandler(async (req, res) => {
  const result = await buildReport(req.user.clinicId, req.body || {}, req.user);
  const columns = result.columns.map((c) => ({
    key: c.key,
    title: c.label,
    format: (v) => (c.type === 'money' || c.type === 'number' ? Number(v || 0) : (v ?? '')),
  }));
  const csv = toCSV(result.rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
  res.send(csv);
}));
