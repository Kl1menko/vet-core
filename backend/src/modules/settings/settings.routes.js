import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const settingsRouter = Router();
settingsRouter.use(authMiddleware);

// Налаштування клініки = clinics row + clinic_settings (key/value)
settingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows: clinic } = await query(`SELECT * FROM clinics WHERE id=$1`, [req.user.clinicId]);
    const { rows: kv } = await query(`SELECT key, value FROM clinic_settings WHERE clinic_id=$1`, [req.user.clinicId]);
    const settings = Object.fromEntries(kv.map((r) => [r.key, r.value]));
    ok(res, { clinic: clinic[0], settings });
  }),
);

settingsRouter.put(
  '/',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, {
      name: { max: 255 }, phone: { max: 50 }, email: { max: 255 }, address: { max: 1000 },
      timezone: { max: 100 }, currency: { max: 10 },
    });
    await query(
      `UPDATE clinics SET name=COALESCE($1,name), phone=COALESCE($2,phone), email=COALESCE($3,email),
              address=COALESCE($4,address), timezone=COALESCE($5,timezone), currency=COALESCE($6,currency), updated_at=now()
        WHERE id=$7`,
      [d.name ?? null, d.phone ?? null, d.email ?? null, d.address ?? null, d.timezone ?? null, d.currency ?? null, req.user.clinicId]);

    // довільні key/value налаштування
    if (req.body.settings && typeof req.body.settings === 'object') {
      for (const [key, value] of Object.entries(req.body.settings)) {
        await query(
          `INSERT INTO clinic_settings (clinic_id, key, value) VALUES ($1,$2,$3)
           ON CONFLICT (clinic_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
          [req.user.clinicId, key, JSON.stringify(value)]);
      }
    }
    await writeAudit({ ...auditCtx(req), action: 'update', entityType: 'clinic_settings', entityId: req.user.clinicId });
    const { rows: clinic } = await query(`SELECT * FROM clinics WHERE id=$1`, [req.user.clinicId]);
    ok(res, { clinic: clinic[0] }, 'Налаштування збережено');
  }),
);
