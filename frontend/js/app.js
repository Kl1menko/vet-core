import { defineRoutes, renderRoute, navigate, setBeforeEach } from './router.js';
import { Auth } from './auth.js';
import { Store } from './store.js';
import { setUnauthorizedHandler } from './api.js';
import { connectRealtime, disconnectRealtime } from './realtime.js';
import { registerServiceWorker } from './pwa.js';
import { el, clear } from './utils/dom.js';
import { icon } from './components/icons.js';
import { initTheme } from './theme.js';
import { renderSidebar } from './components/sidebar.js';
import { renderHeader } from './components/header.js';
import { Toast } from './components/toast.js';

import { renderLoginPage } from './pages/loginPage.js';
import { renderForgotPasswordPage } from './pages/forgotPasswordPage.js';
import { renderResetPasswordPage } from './pages/resetPasswordPage.js';
import { renderDashboardPage } from './pages/dashboardPage.js';
import { renderOwnersPage } from './pages/ownersPage.js';
import { renderOwnerProfilePage } from './pages/ownerProfilePage.js';
import { renderPatientsPage } from './pages/patientsPage.js';
import { renderPatientProfilePage } from './pages/patientProfilePage.js';
import { renderCalendarPage } from './pages/calendarPage.js';
import { renderReceptionPage } from './pages/receptionPage.js';
import { renderAppointmentsPage } from './pages/appointmentsPage.js';
import { renderAppointmentPage } from './pages/appointmentPage.js';
import { renderStaffPage } from './pages/staffPage.js';
import { renderSettingsPage } from './pages/settingsPage.js';
import { renderPricePage } from './pages/pricePage.js';
import { renderPharmacyPage } from './pages/pharmacyPage.js';
import { renderWarehousePage } from './pages/warehousePage.js';
import { renderSuppliersPage } from './pages/suppliersPage.js';
import { renderInvoicesPage } from './pages/invoicesPage.js';
import { renderInvoicePage } from './pages/invoicePage.js';
import { renderReportsPage } from './pages/reportsPage.js';
import { renderRemindersPage } from './pages/remindersPage.js';
import { renderSalaryPage } from './pages/salaryPage.js';
import { renderClientPortal } from './client/clientPortal.js';

const appRoot = () => document.getElementById('app');
const PUBLIC = ['/login', '/forgot-password', '/reset-password'];

// Рендерить сторінку всередині shell (sidebar + header).
function renderShell(path, pageRenderFn, ctx) {
  const existing = document.querySelector('.app-shell');
  if (existing) {
    // shell уже є — оновлюємо лише активний пункт меню й контент (без перебудови всього)
    const main = existing.querySelector('.main');
    main.classList.remove('page-enter');
    void main.offsetWidth; // reflow, щоб анімація перезапустилась
    main.replaceChildren();
    main.classList.add('page-enter');
    refreshSidebarActive(path);
    pageRenderFn(main, ctx);
    return;
  }
  clear(appRoot());
  const main = el('main', { class: 'main page-enter' });
  const shell = el('div', { class: 'app-shell' }, [
    renderSidebar(path),
    renderHeader(),
    main,
  ]);
  appRoot().append(shell);
  pageRenderFn(main, ctx);
}

// Оновити підсвітку активного пункту меню без повного перерендеру сайдбару.
function refreshSidebarActive(path) {
  document.querySelectorAll('.sidebar .nav-link').forEach((a) => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href && path.startsWith(href));
  });
}

function page(fn) {
  return (ctx) => renderShell(ctx.path, fn, ctx);
}

defineRoutes({
  '/login': () => { clear(appRoot()); renderLoginPage(appRoot()); },
  '/forgot-password': () => { clear(appRoot()); renderForgotPasswordPage(appRoot()); },
  '/reset-password': () => { clear(appRoot()); renderResetPasswordPage(appRoot()); },
  '/': () => navigate('/dashboard'),
  '/dashboard': page((root) => renderDashboardPage(root)),
  '/owners': page((root) => renderOwnersPage(root)),
  '/owners/:id': page((root, ctx) => renderOwnerProfilePage(root, ctx.params.id)),
  '/patients': page((root) => renderPatientsPage(root)),
  '/patients/:id': page((root, ctx) => renderPatientProfilePage(root, ctx.params.id)),
  '/calendar': page((root) => renderCalendarPage(root)),
  '/reception': page((root) => renderReceptionPage(root)),
  '/appointments': page((root) => renderAppointmentsPage(root)),
  '/appointments/:id': page((root, ctx) => renderAppointmentPage(root, ctx.params.id)),
  '/price': page((root) => renderPricePage(root)),
  '/pharmacy': page((root) => renderPharmacyPage(root)),
  '/warehouse': page((root) => renderWarehousePage(root)),
  '/suppliers': page((root) => renderSuppliersPage(root)),
  '/invoices': page((root) => renderInvoicesPage(root)),
  '/invoices/:id': page((root, ctx) => renderInvoicePage(root, ctx.params.id)),
  '/reports': page((root) => renderReportsPage(root)),
  '/reminders': page((root) => renderRemindersPage(root)),
  '/salary': page((root) => renderSalaryPage(root)),
  '/staff': page((root) => renderStaffPage(root)),
  '/settings': page((root) => renderSettingsPage(root)),
  // Клієнтський кабінет (окремий від staff-shell)
  '/client': () => { clear(appRoot()); renderClientPortal(appRoot(), 'home'); },
  '/client/pets/:id': (ctx) => { clear(appRoot()); renderClientPortal(appRoot(), 'pet', ctx.params.id); },
  '/client/appointments': () => { clear(appRoot()); renderClientPortal(appRoot(), 'appointments'); },
  '/client/invoices': () => { clear(appRoot()); renderClientPortal(appRoot(), 'invoices'); },
  '/client/discount-card': () => { clear(appRoot()); renderClientPortal(appRoot(), 'discount'); },
  '*': page((root) => {
    root.append(el('div', { class: 'empty-illus' }, [
      el('div', { class: 'big' }, [icon('search', { size: 44 })]),
      el('h2', {}, 'Сторінку не знайдено'),
    ]));
  }),
});

// Guard: неавторизованих — на /login; авторизованих з /login — на /dashboard.
// Клієнтський кабінет (/client*) має власну авторизацію — staff-guard його не чіпає.
setBeforeEach((path) => {
  if (path.startsWith('/client')) return null;
  const authed = Auth.isAuthenticated();
  if (!authed && !PUBLIC.includes(path)) return '/login';
  if (authed && path === '/login') return '/dashboard';
  return null;
});

setUnauthorizedHandler(() => {
  Store.set('user', null);
  disconnectRealtime();
  if (location.pathname !== '/login') {
    Toast.error('Сесія завершена', 'Увійдіть знову');
    navigate('/login');
  }
});

// Перепідключати realtime при зміні користувача (логін/логаут)
Store.on('user', (user) => { if (user) connectRealtime(); else disconnectRealtime(); });

// Старт
(async function boot() {
  initTheme();
  registerServiceWorker();
  if (Auth.isAuthenticated()) {
    try { await Auth.loadMe(); connectRealtime(); }
    catch { /* токен невалідний — guard поверне на /login */ }
  }
  renderRoute(location.pathname);
})();
