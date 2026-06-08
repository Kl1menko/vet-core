import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePermission } from '../../middlewares/permissionMiddleware.js';
import { validate } from '../../utils/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export const patientsRouter = Router();
patientsRouter.use(authMiddleware);

const patientSchema = {
  ownerId: { required: true },
  name: { required: true, max: 100 },
  species: { max: 100 },
  breed: { max: 100 },
  color: { max: 100 },
  sex: { enum: ['male', 'female', 'unknown'], default: 'unknown' },
  isSterilized: { type: 'boolean', default: false },
  birthDate: {},
  weight: { type: 'number', min: 0 },
  chipNumber: { max: 100 },
  passportNumber: { max: 100 },
  notes: { max: 2000 },
  status: { enum: ['active', 'archived', 'deceased'], default: 'active' },
};

patientsRouter.get(
  '/',
  requirePermission('patients.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const params = [req.user.clinicId];
    let where = `WHERE p.clinic_id = $1 AND p.deleted_at IS NULL`;

    if (req.query.ownerId) { params.push(req.query.ownerId); where += ` AND p.owner_id = $${params.length}`; }
    if (req.query.search && req.query.search.trim().length >= 2) {
      params.push(`%${req.query.search.trim()}%`);
      const i = params.length;
      where += ` AND (p.name ILIKE $${i} OR p.chip_number ILIKE $${i} OR p.breed ILIKE $${i})`;
    }

    const total = (await query(`SELECT count(*) FROM patients p ${where}`, params)).rows[0].count;
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT p.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name, o.phone AS owner_phone
         FROM patients p JOIN owners o ON o.id = p.owner_id
         ${where}
        ORDER BY p.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    ok(res, { items: rows, meta: paginationMeta(total, page, limit) });
  }),
);

patientsRouter.get(
  '/:id',
  requirePermission('patients.view'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT p.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name, o.phone AS owner_phone
         FROM patients p JOIN owners o ON o.id = p.owner_id
        WHERE p.id=$1 AND p.clinic_id=$2 AND p.deleted_at IS NULL`,
      [req.params.id, req.user.clinicId],
    );
    if (!rows[0]) throw ApiError.notFound('Пацієнта не знайдено');
    const vaccinations = (
      await query(`SELECT * FROM vaccinations WHERE patient_id=$1 AND deleted_at IS NULL ORDER BY vaccination_date DESC`,
        [req.params.id])
    ).rows;
    ok(res, { ...rows[0], vaccinations });
  }),
);

function toRow(d) {
  return [d.ownerId, d.name, d.species || null, d.breed || null, d.color || null,
    d.sex || 'unknown', d.isSterilized ?? false, d.birthDate || null, d.weight ?? null,
    d.chipNumber || null, d.passportNumber || null, d.notes || null, d.status || 'active'];
}

patientsRouter.post(
  '/',
  requirePermission('patients.create'),
  asyncHandler(async (req, res) => {
    const d = validate(req.body, patientSchema);
    // власник має належати клініці
    const { rows: own } = await query(`SELECT id FROM owners WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [d.ownerId, req.user.clinicId]);
    if (!own[0]) throw ApiError.badRequest('Власника не знайдено');

    const { rows } = await query(
      `INSERT INTO patients (clinic_id, owner_id, name, species, breed, color, sex,
                             is_sterilized, birth_date, weight, chip_number, passport_number, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.clinicId, ...toRow(d)],
    );
    await writeAudit({ ...auditCtx(req), action: 'create', entityType: 'patient', entityId: rows[0].id, newValue: rows[0] });
    created(res, rows[0]);
  }),
);

patientsRouter.put(
  '/:id',
  requirePermission('patients.edit'),
  asyncHandler(async (req, res) => {
    const { rows: ex } = await query(`SELECT * FROM patients WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!ex[0]) throw ApiError.notFound('Пацієнта не знайдено');
    const d = validate({ ...mapPatient(ex[0]), ...req.body }, patientSchema);
    const { rows } = await query(
      `UPDATE patients SET owner_id=$1, name=$2, species=$3, breed=$4, color=$5, sex=$6,
              is_sterilized=$7, birth_date=$8, weight=$9, chip_number=$10, passport_number=$11,
              notes=$12, status=$13, updated_at=now()
        WHERE id=$14 RETURNING *`,
      [...toRow(d), req.params.id],
    );
    await writeAudit({ ...auditCtx(req), action: 'update', entityType: 'patient', entityId: req.params.id,
      oldValue: ex[0], newValue: rows[0] });
    ok(res, rows[0]);
  }),
);

patientsRouter.delete(
  '/:id',
  requirePermission('patients.delete'),
  asyncHandler(async (req, res) => {
    await query(`UPDATE patients SET deleted_at=now(), status='archived' WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinicId]);
    await writeAudit({ ...auditCtx(req), action: 'delete', entityType: 'patient', entityId: req.params.id });
    ok(res, {}, 'Пацієнта архівовано');
  }),
);

function mapPatient(r) {
  return {
    ownerId: r.owner_id, name: r.name, species: r.species, breed: r.breed, color: r.color,
    sex: r.sex, isSterilized: r.is_sterilized,
    birthDate: r.birth_date ? r.birth_date.toISOString().slice(0, 10) : null,
    weight: r.weight != null ? Number(r.weight) : null,
    chipNumber: r.chip_number, passportNumber: r.passport_number, notes: r.notes, status: r.status,
  };
}
