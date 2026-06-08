import { ApiError } from '../../utils/ApiError.js';

/**
 * Складська логіка (ТЗ §13.4). Усе виконується в межах переданого client (транзакція).
 */

/** Поточний залишок препарату по клініці. */
export async function getDrugStock(client, clinicId, drugId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(quantity),0) AS qty FROM stock_batches
      WHERE clinic_id=$1 AND drug_id=$2`, [clinicId, drugId]);
  return Number(rows[0].qty);
}

/**
 * Списання за FEFO (першими — партії з найближчим терміном придатності).
 * allowExpired=false → прострочені партії пропускаються.
 * Повертає масив { batchId, quantity } фактичних списань.
 */
export async function writeOffFEFO(client, {
  clinicId, branchId = null, drugId, quantity, reason = null,
  relatedAppointmentId = null, relatedInvoiceId = null, createdBy = null, allowExpired = false,
}) {
  let remaining = Number(quantity);
  if (!(remaining > 0)) throw ApiError.badRequest('Кількість має бути більшою за 0');

  const { rows: batches } = await client.query(
    `SELECT * FROM stock_batches
      WHERE clinic_id=$1 AND drug_id=$2 AND quantity > 0
        ${allowExpired ? '' : 'AND (expiration_date IS NULL OR expiration_date >= current_date)'}
      ORDER BY expiration_date NULLS LAST, received_at`,
    [clinicId, drugId]);

  const available = batches.reduce((s, b) => s + Number(b.quantity), 0);
  if (available < remaining) {
    throw ApiError.badRequest(`Недостатньо залишку: потрібно ${remaining}, доступно ${available}`);
  }

  const applied = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(Number(b.quantity), remaining);
    await client.query(`UPDATE stock_batches SET quantity = quantity - $1, updated_at=now() WHERE id=$2`,
      [take, b.id]);
    await client.query(
      `INSERT INTO stock_movements (clinic_id, branch_id, drug_id, batch_id, type, quantity, reason, related_appointment_id, related_invoice_id, created_by)
       VALUES ($1,$2,$3,$4,'write_off',$5,$6,$7,$8,$9)`,
      [clinicId, branchId, drugId, b.id, take, reason, relatedAppointmentId, relatedInvoiceId, createdBy]);
    applied.push({ batchId: b.id, quantity: take });
    remaining -= take;
  }
  return applied;
}

/** Перевірка чи залишок нижчий за min_stock (для low-stock сповіщень). */
export async function isLowStock(client, clinicId, drugId) {
  const { rows } = await client.query(
    `SELECT d.min_stock, COALESCE(SUM(b.quantity),0) AS qty
       FROM drugs d LEFT JOIN stock_batches b ON b.drug_id=d.id AND b.clinic_id=d.clinic_id
      WHERE d.id=$1 AND d.clinic_id=$2 GROUP BY d.min_stock`, [drugId, clinicId]);
  if (!rows[0]) return false;
  return Number(rows[0].qty) <= Number(rows[0].min_stock);
}
