import { el, clear, debounce, esc } from '../utils/dom.js';
import { Store } from '../store.js';
import { Auth } from '../auth.js';
import { Api } from '../api.js';
import { navigate } from '../router.js';
import { toggleMobileSidebar } from './sidebar.js';
import { fullName, initials } from '../utils/format.js';
import { Toast } from './toast.js';
import { notificationBell } from './notifications.js';
import { OnlineIndicator } from './online.js';
import { icon } from './icons.js';
import { getTheme, toggleTheme } from '../theme.js';

function themeToggle() {
  const render = () => (getTheme() === 'dark' ? icon('sun', { size: 18 }) : icon('moon', { size: 18 }));
  const btn = el('button', { class: 'btn btn-ghost btn-icon', title: 'Світла / темна тема',
    'aria-label': 'Перемкнути тему' }, [render()]);
  btn.addEventListener('click', () => { toggleTheme(); btn.replaceChildren(render()); });
  return btn;
}

export function renderHeader() {
  const user = Store.get('user');

  const resultsBox = el('div', { class: 'global-search-results', style: 'display:none' });
  const input = el('input', {
    type: 'search',
    placeholder: 'Пошук: власник, телефон, пацієнт… (мін. 2 символи)',
    'aria-label': 'Глобальний пошук',
  });

  // Глобальний пошук (ТЗ §8): debounce 300, мін. 2 символи
  const runSearch = debounce(async (term) => {
    if (term.trim().length < 2) { resultsBox.style.display = 'none'; return; }
    try {
      const [owners, patients] = await Promise.all([
        Api.get('/owners', { search: term, limit: 5 }),
        Api.get('/patients', { search: term, limit: 5 }),
      ]);
      renderResults(resultsBox, owners.items || [], patients.items || []);
    } catch { resultsBox.style.display = 'none'; }
  }, 300);

  input.addEventListener('input', (e) => runSearch(e.target.value));
  input.addEventListener('focus', (e) => { if (e.target.value.trim().length >= 2) resultsBox.style.display = 'block'; });
  document.addEventListener('mousedown', (e) => {
    if (!resultsBox.contains(e.target) && e.target !== input) resultsBox.style.display = 'none';
  });

  return el('header', { class: 'header' }, [
    el('button', { class: 'btn btn-ghost btn-icon burger', onClick: toggleMobileSidebar, id: 'burger' }, [icon('menu')]),
    el('div', { class: 'header__search' }, [input, resultsBox]),
    el('div', { class: 'header__spacer' }),
    themeToggle(),
    OnlineIndicator(),
    notificationBell(),
    el('div', { class: 'header__user' }, [
      el('div', { class: 'avatar' }, initials(user)),
      el('div', { class: 'hide-mobile' }, [
        el('div', { style: 'font-weight:600' }, fullName(user) ),
        el('div', { class: 'muted', style: 'font-size:12px' }, roleLabel(user?.role)),
      ]),
      el('button', { class: 'btn btn-ghost btn-sm', title: 'Вийти', onClick: async () => {
        await Auth.logout();
        navigate('/login');
        Toast.info('Вихід', 'Сесію завершено');
      } }, [icon('logout', { size: 16 })]),
    ]),
  ]);
}

function renderResults(box, owners, patients) {
  clear(box);
  if (!owners.length && !patients.length) {
    box.append(el('div', { class: 'gsr-item muted' }, 'Нічого не знайдено'));
  }
  if (owners.length) {
    box.append(el('div', { class: 'gsr-group-title' }, 'Власники'));
    owners.forEach((o) => box.append(el('div', {
      class: 'gsr-item',
      onClick: () => { box.style.display = 'none'; navigate(`/owners/${o.id}`); },
      html: `<strong>${esc(fullName(o))}</strong> · ${esc(o.phone || '')}`,
    })));
  }
  if (patients.length) {
    box.append(el('div', { class: 'gsr-group-title' }, 'Пацієнти'));
    patients.forEach((p) => box.append(el('div', {
      class: 'gsr-item',
      onClick: () => { box.style.display = 'none'; navigate(`/patients/${p.id}`); },
      html: `<strong>${esc(p.name)}</strong> · ${esc(p.species || '')} · ${esc(fullName({ first_name: p.owner_first_name, last_name: p.owner_last_name }))}`,
    })));
  }
  box.style.display = 'block';
}

function roleLabel(role) {
  return ({
    superadmin: 'Суперадміністратор', owner: 'Власник клініки', admin: 'Адміністратор',
    doctor: 'Лікар', warehouse: 'Склад', accountant: 'Бухгалтер',
  })[role] || role || '';
}
