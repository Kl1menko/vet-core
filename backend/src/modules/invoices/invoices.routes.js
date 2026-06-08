import { Router } from 'express';
import { query, withTransaction } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';
import { broadcast } from '../../realtime/ws.js';

export const invoicesRouter = Router();
invoicesRouter.use(authMiddleware);

const SELECT = `
  SELECT i.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name, o.phone AS owner_phone,
         p.name AS patient_name
    FROM invoices i
    LEFT JOIN owners o ON o.id=i.owner_id
    LEFT JOIN patients p ON p.id=i.patient_id`;

async function loadFull(id) {
  const { rows } = await query(`${SELECT} WHERE i.id=$1`, [id]);
  if (!rows[0]) return null;
  const items = (await query(`SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY created_at`, [id])).rows;
  const payments = (await query(`SELECT * FROM payments WHERE invoice_id=$1 ORDER BY created_at`, [id])).rows;
  return { ...rows[0], items, payments };
}

function recalc(items) {
  const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
  const discount = items.reduce((s, it) => s + Number(it.discount || 0), 0);
  return { subtotal: subtotal.toFixed(2), discount: discount.toFixed(2), total: (subtotal - discount).toFixed(2) };
}

invoicesRouter.get(
  '/',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const params = [req.user.clinicId];
    let where = `WHERE i.clinic_id=$1 AND i.deleted_at IS NULL`;
    if (req.query.status) { params.push(req.query.status); where += ` AND i.status=$${params.length}`; }
    if (req.query.ownerId) { params.push(req.query.ownerId); where += ` AND i.owner_id=$${params.length}`; }
    const total = (await query(`SELECT count(*) FROM invoices i ${where}`, params)).rows[0].count;
    params.push(limit, offset);
    const { rows } = await query(
      `${SELECT} ${where} ORDER BY i.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    ok(res, { items: rows, meta: paginationMeta(total, page, limit) });
  }),
);

invoicesRouter.get(
  '/:id',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const full = await loadFull(req.params.id);
    if (!full || full.clinic_id !== req.user.clinicId) throw ApiError.notFound('Рахунок не знайдено');
    ok(res, full);
  }),
);

// Створення рахунку вручну (з позиціями)
invoicesRouter.post(
  '/',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, { ownerId: { required: true }, patientId: {} });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const norm = items.map((it) => ({
      type: it.type || 'service', itemId: it.itemId || null, name: String(it.name || '').trim(),
      quantity: Number(it.quantity || 1), unitPrice: Number(it.unitPrice || 0), discount: Number(it.discount || 0),
    })).filter((it) => it.name);
    const totals = recalc(norm);

    const inv = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO invoices (clinic_id, branch_id, owner_id, patient_id, status, subtotal, discount, total, debt_amount, created_by)
         VALUES ($1,$2,$3,$4,'unpaid',$5,$6,$7,$7,$8) RETURNING *`,
        [req.user.clinicId, req.user.branchId, d.ownerId, d.patientId || null,
          totals.subtotal, totals.discount, totals.total, req.user.id]);
      for (const it of norm) {
        await c.query(
          `INSERT INTO invoice_items (invoice_id, type, item_id, name, quantity, unit_price, discount, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [rows[0].id, it.type, it.itemId, it.name, it.quantity, it.unitPrice, it.discount,
            (it.quantity * it.unitPrice - it.discount).toFixed(2)]);
      }
      return rows[0];
    });
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'invoice', entityId: inv.id });
    created(res, await loadFull(inv.id));
  }),
);

// Оплата рахунку (ТЗ §13.3) — транзакція
invoicesRouter.post(
  '/:id/pay',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, {
      amount: { type: 'number', min: 0, required: true },
      method: { required: true, enum: ['cash', 'card', 'transfer', 'bonus'] },
      comment: { max: 500 },
    });
    if (!(d.amount > 0)) throw ApiError.badRequest('Сума має бути більшою за 0');

    const result = await withTransaction(async (c) => {
      const { rows: inv } = await c.query(
        `SELECT * FROM invoices WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL FOR UPDATE`,
        [req.params.id, req.user.clinicId]);
      if (!inv[0]) throw ApiError.notFound('Рахунок не знайдено');
      if (inv[0].status === 'paid') throw ApiError.badRequest('Рахунок уже оплачено');

      const total = Number(inv[0].total);
      const alreadyPaid = Number(inv[0].paid_amount);
      const remaining = total - alreadyPaid;
      if (d.amount > remaining + 0.001) throw ApiError.badRequest(`Сума перевищує борг (${remaining.toFixed(2)})`);

      // Бонуси (ТЗ §20). Активна дисконтна картка власника.
      const { rows: cardRows } = await c.query(
        `SELECT * FROM discount_cards WHERE owner_id=$1 AND is_active=true ORDER BY created_at LIMIT 1 FOR UPDATE`,
        [inv[0].owner_id]);
      const card = cardRows[0];

      if (d.method === 'bonus') {
        if (!card) throw ApiError.badRequest('У власника немає дисконтної картки');
        if (Number(card.bonus_balance) < d.amount - 0.001) {
          throw ApiError.badRequest(`Недостатньо бонусів (доступно ${Number(card.bonus_balance).toFixed(2)})`);
        }
        await c.query(`UPDATE discount_cards SET bonus_balance = bonus_balance - $1 WHERE id=$2`, [d.amount.toFixed(2), card.id]);
        await c.query(
          `INSERT INTO bonus_transactions (clinic_id, discount_card_id, invoice_id, type, amount, comment)
           VALUES ($1,$2,$3,'redeem',$4,'Оплата бонусами')`,
          [req.user.clinicId, card.id, inv[0].id, d.amount.toFixed(2)]);
      }

      // 1. payment
      await c.query(
        `INSERT INTO payments (clinic_id, branch_id, invoice_id, owner_id, amount, method, comment, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.user.clinicId, inv[0].branch_id, inv[0].id, inv[0].owner_id, d.amount.toFixed(2), d.method, d.comment || null, req.user.id]);

      // Нарахування бонусів 2% за оплату реальними коштами (не бонусами)
      if (card && d.method !== 'bonus') {
        const accrued = +(d.amount * 0.02).toFixed(2);
        if (accrued > 0) {
          await c.query(`UPDATE discount_cards SET bonus_balance = bonus_balance + $1 WHERE id=$2`, [accrued, card.id]);
          await c.query(
            `INSERT INTO bonus_transactions (clinic_id, discount_card_id, invoice_id, type, amount, comment)
             VALUES ($1,$2,$3,'accrual',$4,'Нарахування 2%')`,
            [req.user.clinicId, card.id, inv[0].id, accrued]);
        }
      }

      // 2-4. оновити рахунок
      const newPaid = alreadyPaid + d.amount;
      const newDebt = Math.max(0, total - newPaid);
      const status = newDebt <= 0.001 ? 'paid' : 'partial';
      await c.query(
        `UPDATE invoices SET paid_amount=$1, debt_amount=$2, status=$3, updated_at=now() WHERE id=$4`,
        [newPaid.toFixed(2), newDebt.toFixed(2), status, inv[0].id]);

      // 6. борг при частковій оплаті
      if (newDebt > 0.001) {
        const { rows: existingDebt } = await c.query(
          `SELECT id FROM debts WHERE invoice_id=$1 AND status='active'`, [inv[0].id]);
        if (existingDebt[0]) {
          await c.query(`UPDATE debts SET amount=$1, updated_at=now() WHERE id=$2`, [newDebt.toFixed(2), existingDebt[0].id]);
        } else {
          await c.query(
            `INSERT INTO debts (clinic_id, owner_id, invoice_id, amount, status) VALUES ($1,$2,$3,$4,'active')`,
            [req.user.clinicId, inv[0].owner_id, inv[0].id, newDebt.toFixed(2)]);
        }
      } else {
        await c.query(`UPDATE debts SET status='closed', paid_amount=amount, updated_at=now() WHERE invoice_id=$1 AND status='active'`, [inv[0].id]);
      }

      // 5. баланс / прапорець боржника
      await c.query(
        `UPDATE owners SET is_debtor = EXISTS(SELECT 1 FROM debts WHERE owner_id=$1 AND status='active'), updated_at=now()
          WHERE id=$1`, [inv[0].owner_id]);

      return { status, paid: newPaid.toFixed(2), debt: newDebt.toFixed(2) };
    });

    await writeAudit({ ...auditCtx(req), action: 'pay', entityType: 'invoice', entityId: req.params.id, newValue: result });
    broadcast(req.user.clinicId, 'invoice.paid', { id: req.params.id, amount: d.amount, status: result.status });
    ok(res, { invoice: await loadFull(req.params.id), ...result }, 'Оплату прийнято');
  }),
);

// Повернення (refund)
invoicesRouter.post(
  '/:id/refund',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, { amount: { type: 'number', min: 0, required: true }, comment: { max: 500 } });
    const result = await withTransaction(async (c) => {
      const { rows: inv } = await c.query(`SELECT * FROM invoices WHERE id=$1 AND clinic_id=$2 FOR UPDATE`,
        [req.params.id, req.user.clinicId]);
      if (!inv[0]) throw ApiError.notFound('Рахунок не знайдено');
      if (d.amount > Number(inv[0].paid_amount) + 0.001) throw ApiError.badRequest('Сума перевищує сплачене');

      await c.query(
        `INSERT INTO payments (clinic_id, branch_id, invoice_id, owner_id, amount, method, status, comment, created_by)
         VALUES ($1,$2,$3,$4,$5,'cash','refunded',$6,$7)`,
        [req.user.clinicId, inv[0].branch_id, inv[0].id, inv[0].owner_id, (-d.amount).toFixed(2), d.comment || 'Повернення', req.user.id]);
      const newPaid = Number(inv[0].paid_amount) - d.amount;
      const newDebt = Number(inv[0].total) - newPaid;
      await c.query(`UPDATE invoices SET paid_amount=$1, debt_amount=$2, status='partial', updated_at=now() WHERE id=$3`,
        [newPaid.toFixed(2), newDebt.toFixed(2), inv[0].id]);
      return { paid: newPaid.toFixed(2) };
    });
    await writeAudit({ ...auditCtx(req), action: 'refund', entityType: 'invoice', entityId: req.params.id });
    ok(res, { invoice: await loadFull(req.params.id), ...result }, 'Повернення оформлено');
  }),
);
