import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query } from '../../config/database.js';
import { asyncHandler, ok, created } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../../../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 МБ (ТЗ §14)
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
});

export const filesRouter = Router();
filesRouter.use(authMiddleware);

filesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = [req.user.clinicId];
    let where = `WHERE clinic_id=$1 AND deleted_at IS NULL`;
    if (req.query.patientId) { params.push(req.query.patientId); where += ` AND patient_id=$${params.length}`; }
    if (req.query.appointmentId) { params.push(req.query.appointmentId); where += ` AND appointment_id=$${params.length}`; }
    const { rows } = await query(`SELECT * FROM files ${where} ORDER BY created_at DESC`, params);
    ok(res, rows);
  }),
);

filesRouter.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Файл відсутній або неприпустимого типу');
    const { patientId, ownerId, appointmentId, category } = req.body;
    const { rows } = await query(
      `INSERT INTO files (clinic_id, owner_id, patient_id, appointment_id, file_name, file_type, file_size, file_url, category, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.clinicId, ownerId || null, patientId || null, appointmentId || null,
        req.file.originalname, req.file.mimetype, req.file.size,
        `/uploads/${req.file.filename}`, category || 'other', req.user.id]);
    await writeAudit({ ...auditCtx(req), action: 'upload', entityType: 'file', entityId: rows[0].id });
    created(res, rows[0]);
  }),
);

filesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT * FROM files WHERE id=$1 AND clinic_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.clinicId]);
    if (!rows[0]) throw ApiError.notFound('Файл не знайдено');
    await query(`UPDATE files SET deleted_at=now() WHERE id=$1`, [req.params.id]);
    await writeAudit({ ...auditCtx(req), action: 'delete', entityType: 'file', entityId: req.params.id });
    ok(res, {}, 'Файл видалено');
  }),
);
