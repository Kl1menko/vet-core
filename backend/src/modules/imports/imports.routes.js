import { Router } from 'express';
import multer from 'multer';
import { withTransaction } from '../../config/database.js';
import { asyncHandler, ok } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseCSV } from '../../utils/csv.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const importsRouter = Router();
importsRouter.use(authMiddleware);

// Гнучкий доступ до колонки за кількома можливими назвами
function pick(rec, ...names) {
  for (const n of names) {
    const key = Object.keys(rec).find((k) => k.toLowerCase().trim() === n.toLowerCase());
    if (key && rec[key] !== '') return rec[key];
  }
  return '';
}

const IMPORTERS = {
  owners: {
    perm: 'owners.create',
    sample: 'Прізвище,Ім\'я,Телефон,Email',
    async run(c, rec, clinicId) {
      const phone = pick(rec, 'phone', 'телефон');
      const firstName = pick(rec, "ім'я", 'imya', 'first_name', 'firstname', 'name');
      if (!phone) throw new Error('відсутній телефон');
      if (!firstName) throw new Error("відсутнє ім'я");
      await c.query(
        `INSERT INTO owners (clinic_id, first_name, last_name, middle_name, phone, email, address, discount_percent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [clinicId, firstName, pick(rec, 'прізвище', 'last_name', 'lastname') || null,
          pick(rec, 'по батькові', 'middle_name') || null, phone, pick(rec, 'email') || null,
          pick(rec, 'адреса', 'address') || null, Number(pick(rec, 'знижка', 'discount', 'discount_percent') || 0)]);
    },
  },
  services: {
    perm: 'finance.manage',
    sample: 'Назва,Ціна,Тривалість',
    async run(c, rec, clinicId) {
      const name = pick(rec, 'назва', 'name');
      const price = Number(pick(rec, 'ціна', 'price') || 0);
      if (!name) throw new Error('відсутня назва');
      await c.query(
        `INSERT INTO services (clinic_id, name, price, duration_minutes, code)
         VALUES ($1,$2,$3,$4,$5)`,
        [clinicId, name, price, Number(pick(rec, 'тривалість', 'duration', 'duration_minutes') || 0),
          pick(rec, 'код', 'code') || null]);
    },
  },
  drugs: {
    perm: 'warehouse.manage',
    sample: 'Назва,Одиниця,Ціна продажу,Закупівельна,Мін. залишок',
    async run(c, rec, clinicId) {
      const name = pick(rec, 'назва', 'name');
      if (!name) throw new Error('відсутня назва');
      await c.query(
        `INSERT INTO drugs (clinic_id, name, unit, selling_price, purchase_price, min_stock, manufacturer)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [clinicId, name, pick(rec, 'одиниця', 'unit') || 'шт',
          Number(pick(rec, 'ціна продажу', 'selling_price', 'ціна') || 0),
          Number(pick(rec, 'закупівельна', 'purchase_price') || 0),
          Number(pick(rec, 'мін. залишок', 'min_stock', 'мін залишок') || 0),
          pick(rec, 'виробник', 'manufacturer') || null]);
    },
  },
};

// Зразки заголовків
importsRouter.get('/:entity/sample', asyncHandler(async (req, res) => {
  const imp = IMPORTERS[req.params.entity];
  if (!imp) throw ApiError.badRequest('Невідома сутність');
  ok(res, { sample: imp.sample });
}));

importsRouter.post('/:entity', upload.single('file'), asyncHandler(async (req, res) => {
  const imp = IMPORTERS[req.params.entity];
  if (!imp) throw ApiError.badRequest('Невідома сутність для імпорту');
  // перевірка прав конкретного імпорту
  const u = req.user;
  if (!(u.role === 'superadmin' || u.role === 'owner' || u.permissions.includes(imp.perm))) {
    throw ApiError.forbidden(`Потрібен дозвіл: ${imp.perm}`);
  }
  if (!req.file) throw ApiError.badRequest('Файл відсутній');

  const text = req.file.buffer.toString('utf8');
  const { records } = parseCSV(text);
  if (!records.length) throw ApiError.badRequest('Файл порожній або без рядків даних');

  const errors = [];
  let imported = 0;
  // кожен рядок у власній під-транзакції-савпойнті, щоб одна помилка не валила весь імпорт
  await withTransaction(async (c) => {
    for (let i = 0; i < records.length; i++) {
      try {
        await c.query('SAVEPOINT row_sp');
        await imp.run(c, records[i], req.user.clinicId);
        await c.query('RELEASE SAVEPOINT row_sp');
        imported++;
      } catch (e) {
        await c.query('ROLLBACK TO SAVEPOINT row_sp');
        errors.push({ row: i + 2, message: e.message }); // +2: 1 рядок заголовка + 1-based
      }
    }
  });

  await writeAudit({ ...auditCtx(req), action: 'import', entityType: req.params.entity, newValue: { imported, errors: errors.length } });
  ok(res, { total: records.length, imported, failed: errors.length, errors: errors.slice(0, 50) }, 'Імпорт завершено');
}));
