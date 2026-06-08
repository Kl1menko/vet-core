import { el } from '../utils/dom.js';
import { can } from '../permissions.js';
import { navigate } from '../router.js';
import { icon } from './icons.js';

const NAV = [
  { path: '/dashboard', label: 'Дашборд', icon: 'dashboard', perm: null },
  { path: '/calendar', label: 'Календар', icon: 'calendar', perm: 'calendar.view' },
  { path: '/reception', label: 'Регістратура', icon: 'reception', perm: 'appointments.view' },
  { path: '/owners', label: 'Власники', icon: 'user', perm: 'owners.view' },
  { path: '/patients', label: 'Пацієнти', icon: 'paw', perm: 'patients.view' },
  { path: '/appointments', label: 'Прийоми', icon: 'stethoscope', perm: 'appointments.view' },
  { path: '/invoices', label: 'Рахунки', icon: 'invoice', perm: 'finance.view' },
  { path: '/price', label: 'Прайс', icon: 'price', perm: 'finance.view' },
  { path: '/pharmacy', label: 'Аптека', icon: 'pill', perm: 'warehouse.view' },
  { path: '/warehouse', label: 'Склад', icon: 'box', perm: 'warehouse.view' },
  { path: '/suppliers', label: 'Постачальники', icon: 'truck', perm: 'warehouse.view' },
  { path: '/reminders', label: 'Нагадування', icon: 'bell', perm: 'appointments.view' },
  { path: '/reports', label: 'Звіти', icon: 'chart', perm: 'reports.view' },
  { path: '/salary', label: 'Зарплати', icon: 'money', perm: 'salary.view' },
  { path: '/staff', label: 'Співробітники', icon: 'users', perm: 'staff.view' },
  { path: '/settings', label: 'Налаштування', icon: 'settings', perm: 'settings.view' },
];

export function renderSidebar(currentPath) {
  const links = NAV.filter((n) => !n.perm || can(n.perm)).map((n) =>
    el('a', {
      href: n.path,
      class: `nav-link ${currentPath.startsWith(n.path) ? 'active' : ''}`,
      onClick: (e) => { e.preventDefault(); navigate(n.path); closeMobile(); },
    }, [el('span', { class: 'nav-ico' }, [icon(n.icon, { size: 19 })]), n.label]));

  return el('aside', { class: 'sidebar', id: 'sidebar' }, [
    el('div', { class: 'sidebar__brand' }, [
      el('img', { src: '/assets/images/logo-vetcore.png', alt: 'VetCore', class: 'sidebar__logo' }),
      'VetCore',
    ]),
    el('nav', { class: 'sidebar__nav' }, links),
  ]);
}

export function toggleMobileSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const open = sb.classList.toggle('open');
  let backdrop = document.querySelector('.backdrop');
  if (open && !backdrop) {
    backdrop = el('div', { class: 'backdrop', onClick: closeMobile });
    document.querySelector('.app-shell')?.append(backdrop);
  } else if (!open && backdrop) {
    backdrop.remove();
  }
}
function closeMobile() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.querySelector('.backdrop')?.remove();
}
