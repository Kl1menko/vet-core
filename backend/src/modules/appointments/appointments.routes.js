import { Router } from 'express';
import { query, withTransaction } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';
import { writeOffFEFO, isLowStock } from '../warehouse/stock.service.js';
import { broadcast } from '../../realtime/ws.js';

export const appointmentsRouter = Router();
appointmentsRouter.use(authMiddleware);

const SELECT = `
  SELECT a.*,
         ce.start_at AS calendar_start_at, ce.end_at AS calendar_end_at,
         o.first_name AS owner_first_name, o.last_name AS owner_last_name, o.phone AS owner_phone,
         p.name AS patient_name, p.species AS patient_species,
         d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
    FROM appointments a
    LEFT JOIN calendar_events ce ON ce.id = a.calendar_event_id
    LEFT JOIN owners o ON o.id = a.owner_id
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN users d ON d.id = a.doctor_id`;

async function loadFull(id) {
  const { rows } = await query(`${SELECT} WHERE a.id=$1`, [id]);
  if (!rows[0]) return null;
  const services = (await query(`SELECT * FROM appointment_services WHERE appointment_id=$1 ORDER BY created_at`, [id])).rows;
  const drugs = (await query(`SELECT * FROM appointment_drugs WHERE appointment_id=$1 ORDER BY created_at`, [id])).rows;
  const extraDoctors = (await query(
    `SELECT ad.*, u.first_name, u.last_name FROM appointment_doctors ad
       JOIN users u ON u.id=ad.doctor_id WHERE ad.appointment_id=$1 ORDER BY ad.role`, [id])).rows;
  return { ...rows[0], services, drugs, extraDoctors };
}

appointmentsRouter.get(
  '/',
  requirePermission('appointments.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const params = [req.user.clinicId];
    let where = `WHERE a.clinic_id=$1 AND a.deleted_at IS NULL`;
    if (req.query.doctorId) { params.push(req.query.doctorId); where += ` AND a.doctor_id=$${params.length}`; }
    if (req.query.patientId) { params.push(req.query.patientId); where += ` AND a.patient_id=$${params.length}`; }
    if (req.query.status) { params.push(req.query.status); where += ` AND a.status=$${params.length}`; }
    if (req.query.date) {
      params.push(req.query.date);
      where += ` AND date(COALESCE(a.started_at, ce.start_at, a.created_at)) = $${params.length}`;
    }

    const total = (await query(
      `SELECT count(*) FROM appointments a LEFT JOIN calendar_events ce ON ce.id = a.calendar_event_id ${where}`,
      params,
    )).rows[0].count;
    params.push(limit, offset);
    const { rows } = await query(
      `${SELECT} ${where} ORDER BY COALESCE(ce.start_at, a.started_at, a.created_at) DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    ok(res, { items: rows, meta: paginationMeta(total, page, limit) });
  }),
);

appointmentsRouter.get(
  '/:id',
  requirePermission('appointments.view'),
  asyncHandler(async (req, res) => {
    const full = await loadFull(req.params.id);
    if (!full || full.clinic_id !== req.user.clinicId) throw ApiError.notFound('Прийом не знайдено');
    ok(res, full);
  }),
);

appointmentsRouter.post(
  '/',
  requirePermission('appointments.create'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, {
      ownerId: { required: true },
      patientId: {},
      doctorId: {},
      calendarEventId: {},
      reason: { max: 1000 },
    });
    const { rows } = await query(
      `INSERT INTO appointments (clinic_id, branch_id, owner_id, patient_id, doctor_id, calendar_event_id, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.clinicId, req.user.branchId, d.ownerId, d.patientId || null,
        d.doctorId || null, d.calendarEventId || null, d.reason || null, req.user.id],
    );
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'appointment', entityId: rows[0].id });
    created(res, await loadFull(rows[0].id));
  }),
);

// Оновлення медичних полів (чернетка)
appointmentsRouter.put(
  '/:id',
  requirePermission('appointments.edit'),
  asyncHandler(async (req, res) => {
    const cur = await getOwned(req);
    if (cur.status === 'completed') {
      // завершений прийом редагується тільки зі спец-правом (ТЗ §6.5)
      if (!(req.user.role === 'owner' || req.user.permissions.includes('appointments.complete'))) {
        throw ApiError.forbidden('Завершений прийом не можна редагувати');
      }
    }
    const d = validate(req.body, {
      reason: { max: 1000 }, anamnesis: { max: 5000 }, symptoms: { max: 5000 },
      diagnosis: { max: 5000 }, treatment: { max: 5000 }, recommendations: { max: 5000 },
      weight: { type: 'number', min: 0 }, temperature: { type: 'number' },
      nextVisitAt: {}, doctorId: {}, patientId: {},
    });
    const { rows } = await query(
      `UPDATE appointments SET
         reason=COALESCE($1,reason), anamnesis=COALESCE($2,anamnesis), symptoms=COALESCE($3,symptoms),
         diagnosis=COALESCE($4,diagnosis), treatment=COALESCE($5,treatment), recommendations=COALESCE($6,recommendations),
         weight=COALESCE($7,weight), temperature=COALESCE($8,temperature), next_visit_at=COALESCE($9,next_visit_at),
         doctor_id=COALESCE($10,doctor_id), patient_id=COALESCE($11,patient_id), updated_at=now()
       WHERE id=$12 RETURNING id`,
      [d.reason ?? null, d.anamnesis ?? null, d.symptoms ?? null, d.diagnosis ?? null,
        d.treatment ?? null, d.recommendations ?? null, d.weight ?? null, d.temperature ?? null,
        d.nextVisitAt ?? null, d.doctorId ?? null, d.patientId ?? null, req.params.id],
    );
    await writeAudit({ ...auditCtx(req), action: 'update', entityType: 'appointment', entityId: rows[0].id });
    ok(res, await loadFull(req.params.id));
  }),
);

appointmentsRouter.post(
  '/:id/start',
  requirePermission('appointments.edit'),
  asyncHandler(async (req, res) => {
    await getOwned(req);
    await query(
      `UPDATE appointments SET status='in_progress', started_at=COALESCE(started_at, now()), updated_at=now()
        WHERE id=$1`, [req.params.id]);
    await query(`UPDATE calendar_events SET status='in_progress' WHERE appointment_id=$1`, [req.params.id]);
    await writeAudit({ ...auditCtx(req), action: 'start', entityType: 'appointment', entityId: req.params.id });
    ok(res, await loadFull(req.params.id), 'Прийом розпочато');
  }),
);

// Завершення: статуси + рахунок зі списанням позицій (ТЗ §13.2, спрощено для MVP)
appointmentsRouter.post(
  '/:id/complete',
  requirePermission('appointments.complete'),
  asyncHandler(async (req, res) => {
    const cur = await getOwned(req);
    if (cur.status === 'completed') throw ApiError.badRequest('Прийом уже завершено');

    const result = await withTransaction(async (c) => {
      await c.query(
        `UPDATE appointments SET status='completed', completed_at=now(), updated_at=now() WHERE id=$1`,
        [req.params.id]);
      await c.query(`UPDATE calendar_events SET status='completed' WHERE appointment_id=$1`, [req.params.id]);

      // Зібрати позиції прийому
      const services = (await c.query(`SELECT * FROM appointment_services WHERE appointment_id=$1`, [req.params.id])).rows;
      const drugs = (await c.query(`SELECT * FROM appointment_drugs WHERE appointment_id=$1`, [req.params.id])).rows;

      const lowStock = [];
      let invoice = null;
      if (services.length || drugs.length) {
        const subtotal = [...services, ...drugs]
          .reduce((s, it) => s + Number(it.total || 0), 0);

        // Знижка: максимум зі знижки власника і знижки активної дисконтної картки (ТЗ §6.3, §20)
        const discPct = await resolveDiscountPercent(c, cur.owner_id);
        const discount = +(subtotal * discPct / 100).toFixed(2);
        const total = +(subtotal - discount).toFixed(2);

        const inv = (await c.query(
          `INSERT INTO invoices (clinic_id, branch_id, owner_id, patient_id, appointment_id, status, subtotal, discount, total, debt_amount, created_by)
           VALUES ($1,$2,$3,$4,$5,'unpaid',$6,$7,$8,$8,$9) RETURNING *`,
          [cur.clinic_id, cur.branch_id, cur.owner_id, cur.patient_id, cur.id,
            subtotal.toFixed(2), discount.toFixed(2), total.toFixed(2), req.user.id],
        )).rows[0];

        for (const s of services) {
          await c.query(
            `INSERT INTO invoice_items (invoice_id, type, item_id, name, quantity, unit_price, discount, total)
             VALUES ($1,'service',$2,$3,$4,$5,$6,$7)`,
            [inv.id, s.service_id, s.name, s.quantity, s.price, s.discount, s.total]);
        }
        for (const dr of drugs) {
          await c.query(
            `INSERT INTO invoice_items (invoice_id, type, item_id, name, quantity, unit_price, total)
             VALUES ($1,'drug',$2,$3,$4,$5,$6)`,
            [inv.id, dr.drug_id, dr.name, dr.quantity, dr.price || 0, dr.total || 0]);
          // Списання зі складу за FEFO (ТЗ §13.2 крок 5) — лише для позицій із реальним drug_id
          if (dr.drug_id) {
            await writeOffFEFO(c, {
              clinicId: cur.clinic_id, branchId: cur.branch_id, drugId: dr.drug_id, quantity: Number(dr.quantity),
              reason: 'Списання за прийомом', relatedAppointmentId: cur.id, relatedInvoiceId: inv.id, createdBy: req.user.id,
            });
            if (await isLowStock(c, cur.clinic_id, dr.drug_id)) lowStock.push({ drugId: dr.drug_id, name: dr.name });
          }
        }
        invoice = inv;
      }
      return { invoice, lowStock };
    });

    await writeAudit({ ...auditCtx(req), action: 'complete', entityType: 'appointment', entityId: req.params.id });
    if (result.invoice) broadcast(cur.clinic_id, 'invoice.created', { id: result.invoice.id, total: result.invoice.total });
    for (const ls of result.lowStock) broadcast(cur.clinic_id, 'stock.low', ls);
    ok(res, { appointment: await loadFull(req.params.id), invoice: result.invoice }, 'Прийом завершено');
  }),
);

appointmentsRouter.post(
  '/:id/cancel',
  requirePermission('appointments.edit'),
  asyncHandler(async (req, res) => {
    await getOwned(req);
    await query(`UPDATE appointments SET status='cancelled', updated_at=now() WHERE id=$1`, [req.params.id]);
    await query(`UPDATE calendar_events SET status='cancelled' WHERE appointment_id=$1`, [req.params.id]);
    await writeAudit({ ...auditCtx(req), action: 'cancel', entityType: 'appointment', entityId: req.params.id });
    ok(res, await loadFull(req.params.id), 'Прийом скасовано');
  }),
);

// Створити наступний візит у календарі (ТЗ §6.7)
appointmentsRouter.post(
  '/:id/next-visit',
  requirePermission('appointments.edit', 'calendar.manage'),
  asyncHandler(async (req, res) => {
    const cur = await getOwned(req);
    const d = validate(req.body, { startAt: { required: true }, reason: { max: 500 } });
    const start = new Date(d.startAt);
    const end = new Date(start.getTime() + 30 * 60000);
    const { rows } = await query(
      `INSERT INTO calendar_events (clinic_id, branch_id, owner_id, patient_id, doctor_id, title, type, status, start_at, end_at, comment, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'appointment','planned',$7,$8,$9,$10) RETURNING *`,
      [cur.clinic_id, cur.branch_id, cur.owner_id, cur.patient_id, cur.doctor_id,
        'Повторний візит', start.toISOString(), end.toISOString(), d.reason || null, req.user.id]);
    await query(`UPDATE appointments SET next_visit_at=$1, updated_at=now() WHERE id=$2`, [start.toISOString(), cur.id]);
    // нагадування власнику за день
    const remind = new Date(start.getTime() - 24 * 3600 * 1000);
    await query(
      `INSERT INTO reminders (clinic_id, owner_id, patient_id, appointment_id, type, channel, title, message, scheduled_at)
       VALUES ($1,$2,$3,$4,'visit','internal',$5,$6,$7)`,
      [cur.clinic_id, cur.owner_id, cur.patient_id, cur.id, 'Нагадування про візит',
        `Повторний візит ${start.toLocaleDateString('uk-UA')}`, remind.toISOString()]);
    broadcast(cur.clinic_id, 'appointment.created', { id: rows[0].id, title: rows[0].title, startAt: rows[0].start_at });
    await writeAudit({ ...auditCtx(req), action: 'next_visit', entityType: 'appointment', entityId: cur.id });
    created(res, rows[0], 'Наступний візит створено');
  }),
);

// Спільний прийом — додаткові лікарі (ТЗ §6.7)
appointmentsRouter.get(
  '/:id/doctors',
  requirePermission('appointments.view'),
  asyncHandler(async (req, res) => {
    await getOwned(req);
    const { rows } = await query(
      `SELECT ad.*, u.first_name, u.last_name FROM appointment_doctors ad
         JOIN users u ON u.id=ad.doctor_id WHERE ad.appointment_id=$1 ORDER BY ad.role`, [req.params.id]);
    ok(res, rows);
  }),
);

appointmentsRouter.post(
  '/:id/doctors',
  requirePermission('appointments.edit'),
  asyncHandler(async (req, res) => {
    await getOwned(req);
    const d = validate(req.body, {
      doctorId: { required: true },
      role: { enum: ['main', 'assistant', 'consultant'], default: 'assistant' },
      salaryPercent: { type: 'number', min: 0, max: 100, default: 0 },
    });
    const { rows } = await query(
      `INSERT INTO appointment_doctors (appointment_id, doctor_id, role, salary_percent)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, d.doctorId, d.role || 'assistant', d.salaryPercent || 0]);
    created(res, rows[0], 'Лікаря додано');
  }),
);

appointmentsRouter.delete(
  '/:id/doctors/:linkId',
  requirePermission('appointments.edit'),
  asyncHandler(async (req, res) => {
    await getOwned(req);
    await query(`DELETE FROM appointment_doctors WHERE id=$1 AND appointment_id=$2`, [req.params.linkId, req.params.id]);
    ok(res, {}, 'Лікаря прибрано');
  }),
);

// Позиції — послуги
appointmentsRouter.post(
  '/:id/services',
  requirePermission('appointments.edit'),
  asyncHandler(async (req, res) => {
    await getOwned(req);
    const d = validate(req.body, {
      serviceId: {}, name: { required: true, max: 255 },
      quantity: { type: 'number', min: 0, default: 1 },
      price: { type: 'number', min: 0, required: true },
      discount: { type: 'number', min: 0, default: 0 },
      doctorId: {},
    });
    const total = (d.quantity * d.price - (d.discount || 0)).toFixed(2);
    const { rows } = await query(
      `INSERT INTO appointment_services (appointment_id, service_id, doctor_id, name, quantity, price, discount, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, d.serviceId || null, d.doctorId || null, d.name, d.quantity, d.price, d.discount || 0, total]);
    created(res, rows[0]);
  }),
);

appointmentsRouter.delete(
  '/:id/services/:itemId',
  requirePermission('appointments.edit'),
  asyncHandler(async (req, res) => {
    await getOwned(req);
    await query(`DELETE FROM appointment_services WHERE id=$1 AND appointment_id=$2`,
      [req.params.itemId, req.params.id]);
    ok(res, {}, 'Послугу видалено');
  }),
);

// Позиції — препарати (списання складу — у складському модулі 2-ї черги; тут лише позиція)
appointmentsRouter.post(
  '/:id/drugs',
  requirePermission('appointments.edit'),
  asyncHandler(async (req, res) => {
    await getOwned(req);
    const d = validate(req.body, {
      drugId: {}, name: { required: true, max: 255 },
      quantity: { type: 'number', min: 0, required: true },
      unit: { max: 50 }, price: { type: 'number', min: 0, default: 0 },
    });
    const total = (d.quantity * (d.price || 0)).toFixed(2);
    const { rows } = await query(
      `INSERT INTO appointment_drugs (appointment_id, drug_id, name, quantity, unit, price, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, d.drugId || null, d.name, d.quantity, d.unit || null, d.price || 0, total]);
    created(res, rows[0]);
  }),
);

// helper: дістати прийом поточної клініки або 404
async function getOwned(req) {
  const { rows } = await query(`SELECT * FROM appointments WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
    [req.params.id, req.user.clinicId]);
  if (!rows[0]) throw ApiError.notFound('Прийом не знайдено');
  return rows[0];
}

// Ефективна знижка власника: max(знижка власника, знижка активної дисконтної картки).
async function resolveDiscountPercent(client, ownerId) {
  const { rows } = await client.query(
    `SELECT GREATEST(
       COALESCE((SELECT discount_percent FROM owners WHERE id=$1), 0),
       COALESCE((SELECT MAX(discount_percent) FROM discount_cards WHERE owner_id=$1 AND is_active=true), 0)
     ) AS pct`, [ownerId]);
  return Number(rows[0]?.pct || 0);
}
