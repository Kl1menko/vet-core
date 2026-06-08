import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const ownersRouter = Router();
ownersRouter.use(authMiddleware);

const ownerSchema = {
  firstName: { required: true, max: 100 },
  lastName: { max: 100 },
  middleName: { max: 100 },
  phone: { required: true, max: 50 },
  secondaryPhone: { max: 50 },
  email: { max: 255, email: true },
  address: { max: 1000 },
  comment: { max: 2000 },
  discountPercent: { type: 'number', min: 0, max: 100, default: 0 },
};

function toRow(d) {
  return [d.firstName, d.lastName || null, d.middleName || null, d.phone,
    d.secondaryPhone || null, d.email || null, d.address || null, d.comment || null,
    d.discountPercent ?? 0];
}

// GET /owners — список з пошуком/пагінацією (ТЗ §6.3)
ownersRouter.get(
  '/',
  requirePermission('owners.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const params = [req.user.clinicId];
    let where = `WHERE o.clinic_id = $1 AND o.deleted_at IS NULL`;

    if (req.query.search && req.query.search.trim().length >= 2) {
      params.push(`%${req.query.search.trim()}%`);
      const i = params.length;
      where += ` AND (o.first_name ILIKE $${i} OR o.last_name ILIKE $${i}
                      OR o.phone ILIKE $${i} OR o.email ILIKE $${i}
                      OR o.secondary_phone ILIKE $${i})`;
    }
    if (req.query.debtor === 'true') where += ` AND o.is_debtor = true`;

    const total = (await query(`SELECT count(*) FROM owners o ${where}`, params)).rows[0].count;
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT o.*,
              (SELECT count(*) FROM patients p WHERE p.owner_id = o.id AND p.deleted_at IS NULL) AS animals_count
         FROM owners o ${where}
        ORDER BY o.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    ok(res, { items: rows, meta: paginationMeta(total, page, limit) });
  }),
);

// GET /owners/:id — картка з тваринами
ownersRouter.get(
  '/:id',
  requirePermission('owners.view'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM owners WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId],
    );
    if (!rows[0]) throw ApiError.notFound('Власника не знайдено');
    const animals = (
      await query(`SELECT * FROM patients WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY name`,
        [req.params.id])
    ).rows;
    ok(res, { ...rows[0], animals });
  }),
);

ownersRouter.post(
  '/',
  requirePermission('owners.create'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, ownerSchema);
    const { rows } = await query(
      `INSERT INTO owners (clinic_id, first_name, last_name, middle_name, phone,
                           secondary_phone, email, address, comment, discount_percent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.clinicId, ...toRow(d)],
    );
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'owner', entityId: rows[0].id, newValue: rows[0] });
    created(res, rows[0]);
  }),
);

ownersRouter.put(
  '/:id',
  requirePermission('owners.edit'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(
      `SELECT * FROM owners WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId],
    );
    if (!ex[0]) throw ApiError.notFound('Власника не знайдено');
    const d = validate({ ...mapOwner(ex[0]), ...req.body }, ownerSchema);
    const { rows } = await query(
      `UPDATE owners SET first_name=$1, last_name=$2, middle_name=$3, phone=$4,
              secondary_phone=$5, email=$6, address=$7, comment=$8, discount_percent=$9, updated_at=now()
        WHERE id=$10 RETURNING *`,
      [...toRow(d), req.params.id],
    );
    await writeAudit({ ...auditCtx(req), action: 'update', entityType: 'owner', entityId: req.params.id,
      oldValue: ex[0], newValue: rows[0] });
    ok(res, rows[0]);
  }),
);

ownersRouter.delete(
  '/:id',
  requirePermission('owners.delete'),
  asyncHandler(async (req, res) => {
    await query(`UPDATE owners SET deleted_at=now(), is_active=false WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinicId]);
    await writeAudit({ ...auditCtx(req), action: 'delete', entityType: 'owner', entityId: req.params.id });
    ok(res, {}, 'Власника архівовано');
  }),
);

// привести row до camelCase для повторної валідації при PUT
function mapOwner(r) {
  return {
    firstName: r.first_name, lastName: r.last_name, middleName: r.middle_name,
    phone: r.phone, secondaryPhone: r.secondary_phone, email: r.email,
    address: r.address, comment: r.comment, discountPercent: Number(r.discount_percent),
  };
}
