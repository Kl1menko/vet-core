/**
 * Запис у audit_logs (ТЗ §14). Можна викликати з пулу або всередині транзакції
 * (передавши client). Помилка аудиту не повинна валити основну операцію.
 */
import { pool } from '../config/database.js';

export async function writeAudit(
  { clinicId = null, userId = null, action, entityType, entityId = null, oldValue = null, newValue = null, ip = null, userAgent = null },
  client = pool,
) {
  try {
    await client.query(
      `INSERT INTO audit_logs
         (clinic_id, user_id, action, entity_type, entity_id, old_value, new_value, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        clinicId,
        userId,
        action,
        entityType,
        entityId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ip,
        userAgent,
      ],
    );
  } catch (err) {
    console.error('[audit] failed to write log', err.message);
  }
}

/** Зручно дістати ip/ua з req. */
export function auditCtx(req) {
  return {
    clinicId: req.user?.clinicId ?? null,
    userId: req.user?.id ?? null,
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
}
