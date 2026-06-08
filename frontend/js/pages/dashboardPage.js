import { el, clear } from '../utils/dom.js';
import { DashboardService } from '../services/index.js';
import { fmtDateTime, fmtDate, fullName, money } from '../utils/format.js';
import { navigate } from '../router.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { openOwnerForm } from './ownersPage.js';
import { openEventForm } from './calendarPage.js';
import { icon } from '../components/icons.js';
import { skeletonStats, skeletonCard } from '../components/skeleton.js';

export async function renderDashboardPage(root) {
  root.append(el('div', { class: 'page-head' }, [
    el('h1', {}, 'Дашборд'),
    el('div', { class: 'toolbar' }, [
      can('owners.create') ? el('button', { class: 'btn btn-ghost', onClick: () => openOwnerForm(null, () => renderDashboardPage(clear(root) || root)) }, '+ Власник') : null,
      can('calendar.manage') ? el('button', { class: 'btn btn-primary', onClick: () => openEventForm(null, new Date(), () => renderDashboardPage(clear(root) || root)) }, '+ Запис') : null,
    ]),
  ]));

  const grid = el('div', { class: 'stats-grid' }, skeletonStats(5));
  const cols = el('div', { class: 'dash-2col' }, [skeletonCard(3), skeletonCard(3), skeletonCard(2), skeletonCard(2)]);
  root.append(grid, cols);

  let d;
  try { d = await DashboardService.get(); }
  catch (err) { Toast.fromError(err); clear(grid); grid.append(el('p', { class: 'muted' }, 'Не вдалося завантажити дані')); return; }

  clear(grid);
  grid.append(
    stat('Прийомів сьогодні', d.appointmentsToday, '/calendar'),
    stat('Виручка за день', money(d.revenueToday), '/reports'),
    stat('Нових клієнтів', d.newOwnersToday, '/owners'),
    stat('Активних пацієнтів', d.activePatients, '/patients'),
    stat('Боржників', d.debtors, '/reports'),
  );

  clear(cols);
  cols.append(
    block('calendar', 'Найближчі записи', d.upcoming, (e) => listItem(
      `${fmtDateTime(e.start_at)} · ${e.title}`,
      upcomingSubtitle(e),
      () => navigate('/calendar'),
    ), 'Немає запланованих записів'),

    block('stethoscope', 'Завантаженість лікарів', d.doctorLoad, (u) => listItem(
      fullName(u), `${u.events} записів сьогодні`, null,
    ), 'Немає лікарів'),

    block('warning', 'Малий залишок препаратів', d.lowStock, (s) => listItem(
      s.name, `залишок ${Number(s.qty)} ${s.unit} (мін. ${Number(s.min_stock)})`,
      () => navigate('/pharmacy'), 'badge-red',
    ), 'Усі залишки в нормі'),

    block('clock', 'Терміни придатності', d.expiringStock, (s) => listItem(
      s.name, `${Number(s.quantity)} · до ${fmtDate(s.expiration_date)}`,
      () => navigate('/warehouse'), 'badge-amber',
    ), 'Немає препаратів із близьким терміном'),

    block('vaccine', 'Вакцинації (14 днів)', d.overdueVaccinations, (v) => listItem(
      `${v.patient_name} · ${v.vaccine_name}`, fmtDate(v.next_vaccination_date),
      () => navigate(`/patients/${v.patient_id}`),
    ), 'Немає найближчих вакцинацій'),

    block('money', 'Боржники', d.debtorsList, (o) => listItem(
      fullName(o), money(o.debt),
      () => navigate(`/owners/${o.id}`), 'badge-red',
    ), 'Боржників немає'),
  );
}

function stat(label, value, to) {
  return el('div', { class: 'stat', style: to ? 'cursor:pointer' : '', onClick: to ? () => navigate(to) : null }, [
    el('div', { class: 'stat__label' }, label),
    el('div', { class: 'stat__value', style: 'font-size:26px' }, String(value)),
  ]);
}

function upcomingSubtitle(e) {
  const owner = fullName({ first_name: e.owner_first_name, last_name: e.owner_last_name }) || 'без власника';
  return e.patient_name ? `${owner} · ${e.patient_name}` : owner;
}

function block(iconName, title, items, renderItem, emptyText) {
  const card = el('div', { class: 'card card-pad' }, [
    el('h2', { style: 'font-size:16px;margin-bottom:10px;display:flex;align-items:center;gap:8px' }, [
      el('span', { style: 'color:var(--c-primary);display:inline-flex' }, [icon(iconName, { size: 18 })]),
      title,
    ]),
  ]);
  if (!items || !items.length) card.append(el('p', { class: 'muted' }, emptyText));
  else items.forEach((it) => card.append(renderItem(it)));
  return card;
}

function listItem(title, subtitle, onClick, badgeCls) {
  return el('div', { class: 'list-line', style: onClick ? 'cursor:pointer' : '', onClick: onClick || null }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' }, [
      el('strong', {}, title),
      badgeCls ? el('span', { class: `badge ${badgeCls}` }, subtitle) : el('span', { class: 'muted', style: 'font-size:13px' }, subtitle),
    ]),
  ]);
}
