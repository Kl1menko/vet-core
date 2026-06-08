import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { query } from '../../config/database.js';
import { asyncHandler } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { toCSV } from '../../utils/csv.js';

export const exportsRouter = Router();
exportsRouter.use(authMiddleware);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../../..');
const LOGO_PATH = path.join(projectRoot, 'frontend/assets/images/logo-vetcore.png');

function sendCSV(res, filename, rows, columns) {
  const csv = toCSV(rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '');
const fmtMoney = (v) => `${Number(v || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} грн`;

const PDF_FONT = [
  '/Library/Fonts/Arial Unicode.ttf',
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Helvetica.ttf',
].find((p) => fs.existsSync(p));

function pdfText(value) {
  const text = String(value ?? '');
  return PDF_FONT ? text : translit(text);
}

function usePdfFont(doc) {
  if (PDF_FONT) doc.font(PDF_FONT);
  else doc.font('Helvetica');
}

// ---- Власники ----
exportsRouter.get('/owners.csv', requirePermission('owners.view'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT first_name, last_name, middle_name, phone, secondary_phone, email, address,
            discount_percent, balance, is_debtor, created_at
       FROM owners WHERE clinic_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, [req.user.clinicId]);
  sendCSV(res, 'owners.csv', rows, [
    { key: 'last_name', title: 'Прізвище' }, { key: 'first_name', title: "Ім'я" }, { key: 'middle_name', title: 'По батькові' },
    { key: 'phone', title: 'Телефон' }, { key: 'secondary_phone', title: 'Дод. телефон' }, { key: 'email', title: 'Email' },
    { key: 'address', title: 'Адреса' }, { key: 'discount_percent', title: 'Знижка %' }, { key: 'balance', title: 'Баланс' },
    { key: 'is_debtor', title: 'Боржник', format: (v) => (v ? 'так' : 'ні') }, { key: 'created_at', title: 'Створено', format: fmtDate },
  ]);
}));

// ---- Пацієнти ----
exportsRouter.get('/patients.csv', requirePermission('patients.view'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT p.name, p.species, p.breed, p.sex, p.birth_date, p.weight, p.chip_number,
            o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone
       FROM patients p JOIN owners o ON o.id=p.owner_id
      WHERE p.clinic_id=$1 AND p.deleted_at IS NULL ORDER BY p.created_at DESC`, [req.user.clinicId]);
  sendCSV(res, 'patients.csv', rows, [
    { key: 'name', title: 'Кличка' }, { key: 'species', title: 'Вид' }, { key: 'breed', title: 'Порода' },
    { key: 'sex', title: 'Стать', format: (v) => ({ male: 'самець', female: 'самка', unknown: '' })[v] || '' },
    { key: 'birth_date', title: 'Народження', format: fmtDate }, { key: 'weight', title: 'Вага' },
    { key: 'chip_number', title: 'Чіп' }, { key: 'owner_last', title: 'Власник (прізвище)' },
    { key: 'owner_first', title: "Власник (ім'я)" }, { key: 'owner_phone', title: 'Телефон власника' },
  ]);
}));

// ---- Рахунки ----
exportsRouter.get('/invoices.csv', requirePermission('finance.view'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.created_at, o.first_name, o.last_name, i.total, i.paid_amount, i.debt_amount, i.status
       FROM invoices i JOIN owners o ON o.id=i.owner_id
      WHERE i.clinic_id=$1 AND i.deleted_at IS NULL ORDER BY i.created_at DESC`, [req.user.clinicId]);
  sendCSV(res, 'invoices.csv', rows, [
    { key: 'created_at', title: 'Дата', format: fmtDate }, { key: 'last_name', title: 'Прізвище' }, { key: 'first_name', title: "Ім'я" },
    { key: 'total', title: 'Сума' }, { key: 'paid_amount', title: 'Сплачено' }, { key: 'debt_amount', title: 'Борг' },
    { key: 'status', title: 'Статус' },
  ]);
}));

// ---- Склад ----
exportsRouter.get('/warehouse.csv', requirePermission('warehouse.view'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT d.name, d.unit, COALESCE(SUM(b.quantity),0) AS qty,
            COALESCE(SUM(b.quantity*b.purchase_price),0) AS value, d.min_stock
       FROM drugs d LEFT JOIN stock_batches b ON b.drug_id=d.id
      WHERE d.clinic_id=$1 AND d.deleted_at IS NULL GROUP BY d.id ORDER BY d.name`, [req.user.clinicId]);
  sendCSV(res, 'warehouse.csv', rows, [
    { key: 'name', title: 'Препарат' }, { key: 'unit', title: 'Одиниця' }, { key: 'qty', title: 'Залишок' },
    { key: 'value', title: 'Вартість' }, { key: 'min_stock', title: 'Мін. залишок' },
  ]);
}));

// ---- Боржники ----
exportsRouter.get('/debtors.csv', requirePermission('finance.view'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT o.first_name, o.last_name, o.phone, COALESCE(SUM(d.amount-d.paid_amount),0) AS debt
       FROM owners o JOIN debts d ON d.owner_id=o.id AND d.status='active'
      WHERE o.clinic_id=$1 GROUP BY o.id HAVING COALESCE(SUM(d.amount-d.paid_amount),0)>0 ORDER BY debt DESC`,
    [req.user.clinicId]);
  sendCSV(res, 'debtors.csv', rows, [
    { key: 'last_name', title: 'Прізвище' }, { key: 'first_name', title: "Ім'я" }, { key: 'phone', title: 'Телефон' },
    { key: 'debt', title: 'Борг' },
  ]);
}));

// ---- PDF рахунку ----
exportsRouter.get('/invoice/:id.pdf', requirePermission('finance.view'), asyncHandler(async (req, res) => {
  const id = req.params.id.replace(/\.pdf$/, '');
  const { rows: inv } = await query(
    `SELECT i.*, o.first_name, o.last_name, o.phone, p.name AS patient_name, c.name AS clinic_name, c.address AS clinic_address
       FROM invoices i JOIN owners o ON o.id=i.owner_id
       LEFT JOIN patients p ON p.id=i.patient_id JOIN clinics c ON c.id=i.clinic_id
      WHERE i.id=$1 AND i.clinic_id=$2 AND i.deleted_at IS NULL`, [id, req.user.clinicId]);
  if (!inv[0]) throw ApiError.notFound('Рахунок не знайдено');
  const items = (await query(`SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY created_at`, [id])).rows;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${id.slice(0, 8)}.pdf"`);
  const doc = new PDFDocument({ margin: 44, size: 'A4' });
  doc.pipe(res);

  const invoice = inv[0];
  const owner = [invoice.last_name, invoice.first_name].filter(Boolean).join(' ');
  usePdfFont(doc);

  doc.roundedRect(44, 40, 46, 46, 12).fillAndStroke('#f3f4f6', '#e5e7eb');
  if (fs.existsSync(LOGO_PATH)) {
    try { doc.image(LOGO_PATH, 52, 48, { fit: [30, 30] }); } catch { /* logo is optional */ }
  }
  doc.fillColor('#111827').fontSize(22).text(pdfText(invoice.clinic_name || 'VetCore'), 104, 42);
  doc.fontSize(10).fillColor('#6b7280').text(pdfText(invoice.clinic_address || ''), 104, 70, { width: 210 });
  doc.fontSize(22).fillColor('#111827').text(pdfText(`Рахунок #${id.slice(0, 8)}`), 320, 42, { width: 231, align: 'right' });
  doc.fontSize(10).fillColor('#6b7280').text(pdfText(`Дата: ${fmtDate(invoice.created_at)}`), 320, 70, { width: 231, align: 'right' });

  doc.moveTo(44, 104).lineTo(551, 104).strokeColor('#e5e7eb').lineWidth(1).stroke();

  doc.roundedRect(44, 124, 507, 76, 10).fillAndStroke('#f9fafb', '#e5e7eb');
  doc.fillColor('#6b7280').fontSize(9).text(pdfText('КЛІЄНТ'), 62, 140);
  doc.fillColor('#111827').fontSize(12).text(pdfText(`${owner || '—'}${invoice.phone ? ` · ${invoice.phone}` : ''}`), 62, 156, { width: 220 });
  doc.fillColor('#6b7280').fontSize(9).text(pdfText('ПАЦІЄНТ'), 330, 140);
  doc.fillColor('#111827').fontSize(12).text(pdfText(invoice.patient_name || 'Не вказано'), 330, 156, { width: 190 });

  const top = 232;
  doc.roundedRect(44, top - 12, 507, 30, 8).fill('#f3f4f6');
  doc.fillColor('#374151').fontSize(10);
  doc.text(pdfText('Позиція'), 62, top - 3, { width: 250 });
  doc.text(pdfText('К-сть'), 330, top - 3, { width: 50, align: 'right' });
  doc.text(pdfText('Ціна'), 402, top - 3, { width: 60, align: 'right' });
  doc.text(pdfText('Сума'), 482, top - 3, { width: 50, align: 'right' });

  let y = top + 34;
  for (const it of items) {
    doc.fillColor('#111827').fontSize(10);
    doc.text(pdfText(it.name), 62, y, { width: 250 });
    doc.text(String(Number(it.quantity)), 330, y, { width: 50, align: 'right' });
    doc.text(fmtMoney(it.unit_price), 390, y, { width: 72, align: 'right' });
    doc.text(fmtMoney(it.total), 470, y, { width: 62, align: 'right' });
    y += Math.max(24, doc.heightOfString(pdfText(it.name), { width: 250 }) + 10);
  }
  doc.moveTo(44, y).lineTo(551, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  y += 18;

  const summaryX = 352;
  const summary = [
    ['Разом', fmtMoney(invoice.total)],
    ['Сплачено', fmtMoney(invoice.paid_amount)],
    ['Борг', fmtMoney(invoice.debt_amount)],
  ];
  summary.forEach(([label, value], i) => {
    const yy = y + i * 22;
    doc.fillColor('#6b7280').fontSize(10).text(pdfText(label), summaryX, yy, { width: 80 });
    doc.fillColor(i === 2 && Number(invoice.debt_amount) > 0 ? '#ea580c' : '#111827')
      .fontSize(i === 0 ? 13 : 11).text(pdfText(value), 430, yy, { width: 102, align: 'right' });
  });

  doc.fillColor('#6b7280').fontSize(9)
    .text(pdfText('Дякуємо за довіру до VetCore.'), 44, 760, { width: 507, align: 'center' });
  doc.end();
}));

// ---- PDF висновку прийому (ТЗ §6.7) ----
exportsRouter.get('/appointment/:id.pdf', requirePermission('appointments.view'), asyncHandler(async (req, res) => {
  const id = req.params.id.replace(/\.pdf$/, '');
  const { rows: ap } = await query(
    `SELECT a.*, o.first_name, o.last_name, o.phone, p.name AS patient_name, p.species, p.breed,
            d.first_name AS doc_first, d.last_name AS doc_last, c.name AS clinic_name, c.address AS clinic_address
       FROM appointments a JOIN owners o ON o.id=a.owner_id
       LEFT JOIN patients p ON p.id=a.patient_id
       LEFT JOIN users d ON d.id=a.doctor_id
       JOIN clinics c ON c.id=a.clinic_id
      WHERE a.id=$1 AND a.clinic_id=$2 AND a.deleted_at IS NULL`, [id, req.user.clinicId]);
  if (!ap[0]) throw ApiError.notFound('Прийом не знайдено');
  const a = ap[0];
  const services = (await query(`SELECT * FROM appointment_services WHERE appointment_id=$1`, [id])).rows;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="conclusion-${id.slice(0, 8)}.pdf"`);
  const doc = new PDFDocument({ margin: 44, size: 'A4' });
  doc.pipe(res);
  usePdfFont(doc);

  doc.roundedRect(44, 40, 46, 46, 12).fillAndStroke('#f3f4f6', '#e5e7eb');
  if (fs.existsSync(LOGO_PATH)) {
    try { doc.image(LOGO_PATH, 52, 48, { fit: [30, 30] }); } catch { /* logo is optional */ }
  }
  doc.fillColor('#111827').fontSize(22).text(pdfText(a.clinic_name || 'VetCore'), 104, 42);
  doc.fontSize(10).fillColor('#6b7280').text(pdfText(a.clinic_address || ''), 104, 70, { width: 210 });
  doc.fontSize(22).fillColor('#111827').text(pdfText('Висновок прийому'), 320, 42, { width: 231, align: 'right' });
  doc.fontSize(10).fillColor('#6b7280')
    .text(pdfText(`Дата: ${fmtDate(a.completed_at || a.created_at)}`), 320, 70, { width: 231, align: 'right' });

  doc.moveTo(44, 104).lineTo(551, 104).strokeColor('#e5e7eb').lineWidth(1).stroke();

  const patientDetails = [a.patient_name || 'Не вказано', [a.species, a.breed].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  doc.roundedRect(44, 124, 507, 86, 10).fillAndStroke('#f9fafb', '#e5e7eb');
  doc.fillColor('#6b7280').fontSize(9).text(pdfText('ПАЦІЄНТ'), 62, 140);
  doc.fillColor('#111827').fontSize(12).text(pdfText(patientDetails), 62, 156, { width: 220 });
  doc.fillColor('#6b7280').fontSize(9).text(pdfText('ВЛАСНИК'), 330, 140);
  doc.fillColor('#111827').fontSize(12)
    .text(pdfText(`${[a.last_name, a.first_name].filter(Boolean).join(' ') || '—'}${a.phone ? ` · ${a.phone}` : ''}`), 330, 156, { width: 190 });
  doc.fillColor('#6b7280').fontSize(9).text(pdfText('ЛІКАР'), 62, 184);
  doc.fillColor('#111827').fontSize(12).text(pdfText([a.doc_last, a.doc_first].filter(Boolean).join(' ') || '—'), 104, 184, { width: 220 });

  doc.y = 236;

  const section = (label, value) => {
    if (!value) return;
    doc.fillColor('#111827').fontSize(12).text(pdfText(label), { continued: false });
    doc.moveDown(0.15);
    doc.fillColor('#374151').fontSize(10).text(pdfText(String(value)), { width: 507, lineGap: 2 });
    doc.moveDown(0.65);
  };
  section('Причина звернення', a.reason);
  section('Анамнез', a.anamnesis);
  section('Симптоми', a.symptoms);
  section('Діагноз', a.diagnosis);
  section('Лікування', a.treatment);
  section('Рекомендації', a.recommendations);
  if (a.weight) section('Вага', `${Number(a.weight)} кг`);
  if (a.temperature) section('Температура', `${Number(a.temperature)} °C`);

  if (services.length) {
    doc.moveDown(0.2).fillColor('#111827').fontSize(12).text(pdfText('Надані послуги'));
    doc.moveDown(0.2);
    services.forEach((s) => doc.fillColor('#374151').fontSize(10)
      .text(pdfText(`• ${s.name} × ${Number(s.quantity)} = ${fmtMoney(s.total)}`), { indent: 10 }));
  }
  if (a.next_visit_at) {
    doc.moveDown(0.7).fillColor('#111827').fontSize(10)
      .text(pdfText(`Наступний візит: ${fmtDate(a.next_visit_at)}`));
  }
  doc.end();
}));

// Транслітерація укр -> лат (бо стандартні PDF-шрифти без кирилиці)
function translit(s) {
  if (!s) return '';
  const map = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia' };
  return String(s).split('').map((ch) => {
    const lower = ch.toLowerCase();
    const tr = map[lower];
    if (tr === undefined) return ch;
    return ch === lower ? tr : (tr.charAt(0).toUpperCase() + tr.slice(1));
  }).join('');
}
