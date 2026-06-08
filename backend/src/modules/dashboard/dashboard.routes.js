import { Router } from 'express';
import { query } from '../../config/database.js';
import { asyncHandler, ok } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);

// Повне зведення для дашборду (ТЗ §6.2)
dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const cid = req.user.clinicId;
    const [
      today, newOwners, activePatients, debtorsCount, revenueToday,
      upcoming, overdueVacc, lowStock, expiringStock, debtorsList, doctorLoad,
    ] = await Promise.all([
      query(`SELECT count(*) FROM calendar_events
              WHERE clinic_id=$1 AND deleted_at IS NULL AND date(start_at)=current_date`, [cid]),
      query(`SELECT count(*) FROM owners
              WHERE clinic_id=$1 AND deleted_at IS NULL AND date(created_at)=current_date`, [cid]),
      query(`SELECT count(*) FROM patients
              WHERE clinic_id=$1 AND deleted_at IS NULL AND status='active'`, [cid]),
      query(`SELECT count(*) FROM owners WHERE clinic_id=$1 AND is_debtor=true AND deleted_at IS NULL`, [cid]),
      query(`SELECT COALESCE(SUM(amount),0) AS sum FROM payments
              WHERE clinic_id=$1 AND date(created_at)=current_date`, [cid]),

      query(`SELECT e.id, e.title, e.start_at, e.type, e.status,
                    p.name AS patient_name, o.first_name AS owner_first_name, o.last_name AS owner_last_name,
                    d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
               FROM calendar_events e
               LEFT JOIN patients p ON p.id=e.patient_id
               LEFT JOIN owners o ON o.id=e.owner_id
               LEFT JOIN users d ON d.id=e.doctor_id
              WHERE e.clinic_id=$1 AND e.deleted_at IS NULL AND e.start_at >= now()
                AND e.status NOT IN ('cancelled','no_show')
              ORDER BY e.start_at LIMIT 8`, [cid]),

      // прострочені / найближчі вакцинації
      query(`SELECT v.id, v.vaccine_name, v.next_vaccination_date, p.id AS patient_id, p.name AS patient_name
               FROM vaccinations v JOIN patients p ON p.id=v.patient_id
              WHERE v.clinic_id=$1 AND v.deleted_at IS NULL AND v.next_vaccination_date IS NOT NULL
                AND v.next_vaccination_date <= current_date + interval '14 days'
              ORDER BY v.next_vaccination_date LIMIT 10`, [cid]),

      // препарати з малим залишком
      query(`SELECT d.id, d.name, d.unit, d.min_stock, COALESCE(SUM(b.quantity),0) AS qty
               FROM drugs d LEFT JOIN stock_batches b ON b.drug_id=d.id AND b.clinic_id=d.clinic_id
              WHERE d.clinic_id=$1 AND d.deleted_at IS NULL
              GROUP BY d.id HAVING COALESCE(SUM(b.quantity),0) <= d.min_stock AND d.min_stock > 0
              ORDER BY qty LIMIT 10`, [cid]),

      // препарати з наближенням терміну придатності (30 днів)
      query(`SELECT d.name, b.batch_number, b.quantity, b.expiration_date
               FROM stock_batches b JOIN drugs d ON d.id=b.drug_id
              WHERE b.clinic_id=$1 AND b.quantity > 0 AND b.expiration_date IS NOT NULL
                AND b.expiration_date <= current_date + interval '30 days'
              ORDER BY b.expiration_date LIMIT 10`, [cid]),

      // боржники (топ)
      query(`SELECT o.id, o.first_name, o.last_name, o.phone,
                    COALESCE(SUM(dt.amount - dt.paid_amount),0) AS debt
               FROM owners o JOIN debts dt ON dt.owner_id=o.id AND dt.status='active'
              WHERE o.clinic_id=$1 AND o.deleted_at IS NULL
              GROUP BY o.id HAVING COALESCE(SUM(dt.amount - dt.paid_amount),0) > 0
              ORDER BY debt DESC LIMIT 8`, [cid]),

      // завантаженість лікарів на сьогодні
      query(`SELECT u.id, u.first_name, u.last_name, count(e.id) AS events
               FROM users u
               JOIN roles r ON r.id=u.role_id AND r.code='doctor'
               LEFT JOIN calendar_events e ON e.doctor_id=u.id AND e.deleted_at IS NULL
                    AND date(e.start_at)=current_date AND e.status NOT IN ('cancelled','no_show')
              WHERE u.clinic_id=$1 AND u.deleted_at IS NULL AND u.is_active=true
              GROUP BY u.id ORDER BY events DESC`, [cid]),
    ]);

    ok(res, {
      appointmentsToday: Number(today.rows[0].count),
      newOwnersToday: Number(newOwners.rows[0].count),
      activePatients: Number(activePatients.rows[0].count),
      debtors: Number(debtorsCount.rows[0].count),
      revenueToday: revenueToday.rows[0].sum,
      upcoming: upcoming.rows,
      overdueVaccinations: overdueVacc.rows,
      lowStock: lowStock.rows,
      expiringStock: expiringStock.rows,
      debtorsList: debtorsList.rows,
      doctorLoad: doctorLoad.rows,
    });
  }),
);
