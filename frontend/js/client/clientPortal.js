import { el, clear } from '../utils/dom.js';
import { ClientApi, isClientAuthed, setClientToken, clearClientToken } from './clientApi.js';
import { Toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { fmtDate, fmtDateTime, money } from '../utils/format.js';
import { icon } from '../components/icons.js';

// Клієнтський кабінет власника тварини (ТЗ §5). Окремий від staff-UI.
export function renderClientPortal(root, view = 'home', param = null) {
  clear(root);
  if (!isClientAuthed()) { renderClientLogin(root); return; }
  renderClientShell(root, view, param);
}

// ---------- Вхід ----------
function renderClientLogin(root) {
  const phone = el('input', { type: 'tel', placeholder: '+380…' });
  const code = el('input', { type: 'text', placeholder: 'Код з SMS', maxlength: 6 });
  const codeField = el('div', { class: 'field', style: 'display:none' }, [el('label', {}, 'Код підтвердження'), code]);
  const errBox = el('div', { class: 'err', style: 'margin-bottom:10px' });
  const btn = el('button', { class: 'btn btn-primary', style: 'width:100%' }, 'Отримати код');
  let step = 'phone';

  btn.addEventListener('click', async () => {
    errBox.textContent = '';
    btn.disabled = true;
    try {
      if (step === 'phone') {
        const r = await ClientApi.login(phone.value.trim());
        codeField.style.display = '';
        if (r.demoCode) { code.value = r.demoCode; Toast.info('Демо-режим', `Код: ${r.demoCode}`); }
        step = 'code'; btn.textContent = 'Увійти';
      } else {
        const r = await ClientApi.verify(phone.value.trim(), code.value.trim());
        setClientToken(r.accessToken);
        Toast.success('Вітаємо!', 'Вхід виконано');
        navigate('/client');
      }
    } catch (e) { errBox.textContent = e?.message || 'Помилка'; }
    finally { btn.disabled = false; }
  });

  root.append(el('div', { class: 'auth-shell' }, [
    el('div', { class: 'auth-card' }, [
      el('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:4px' }, [
        el('img', { src: '/assets/images/logo-vetcore.png', alt: 'VetCore', style: 'width:48px;height:48px;border-radius:11px' }),
        el('h1', {}, 'VetCore'),
      ]),
      el('p', { class: 'muted' }, 'Кабінет власника тварини'),
      el('div', { class: 'field' }, [el('label', {}, 'Телефон'), phone]),
      codeField,
      errBox,
      btn,
      el('p', { class: 'muted', style: 'margin-top:16px;font-size:12px' }, 'Вхід для співробітників — /login'),
    ]),
  ]));
}

// ---------- Кабінет ----------
async function renderClientShell(root, view, param) {
  const nav = [
    ['/client', 'Мої тварини', 'paw'],
    ['/client/appointments', 'Записи', 'calendar'],
    ['/client/invoices', 'Рахунки', 'invoice'],
    ['/client/discount-card', 'Картка', 'card'],
  ];
  const header = el('header', { class: 'header', style: 'padding:0 20px' }, [
    el('div', { style: 'display:flex;align-items:center;gap:10px;font-weight:700' }, [
      el('img', { src: '/assets/images/logo-vetcore.png', style: 'width:32px;height:32px;border-radius:7px' }), 'VetCore',
    ]),
    el('div', { class: 'header__spacer' }),
    el('button', { class: 'btn btn-ghost btn-sm', onClick: () => { clearClientToken(); navigate('/client'); } }, 'Вийти'),
  ]);

  const tabs = el('div', { class: 'tabs', style: 'padding:0 20px;background:var(--c-surface)' },
    nav.map(([path, label, ico]) => el('div', {
      class: `tab ${location.pathname === path ? 'active' : ''}`,
      style: 'display:flex;align-items:center;gap:6px',
      onClick: () => navigate(path),
    }, [icon(ico, { size: 16 }), label])));

  const main = el('main', { class: 'main', style: 'max-width:900px;margin:0 auto' });
  root.append(el('div', { style: 'min-height:100vh;background:var(--c-bg)' }, [header, tabs, main]));

  try {
    if (view === 'pet' && param) await petView(main, param);
    else if (view === 'appointments') await appointmentsView(main);
    else if (view === 'invoices') await invoicesView(main);
    else if (view === 'discount') await discountView(main);
    else await petsView(main);
  } catch (e) {
    if (e?.code === 'UNAUTHORIZED') { navigate('/client'); return; }
    Toast.fromError(e);
  }
}

async function petsView(main) {
  main.append(el('h1', { style: 'font-size:22px;margin-bottom:16px' }, 'Мої тварини'));
  const pets = await ClientApi.pets();
  if (!pets.length) { main.append(el('p', { class: 'muted' }, 'Тварин не знайдено')); return; }
  const grid = el('div', { class: 'dash-2col' });
  pets.forEach((p) => grid.append(el('div', { class: 'card card-pad', style: 'cursor:pointer',
    onClick: () => navigate(`/client/pets/${p.id}`) }, [
    el('div', { style: 'display:flex;gap:12px;align-items:center' }, [
      el('div', { class: 'avatar avatar-lg' }, [icon('paw', { size: 28 })]),
      el('div', {}, [
        el('strong', { style: 'font-size:16px' }, p.name),
        el('div', { class: 'muted', style: 'font-size:13px' }, [p.species, p.breed].filter(Boolean).join(' · ')),
      ]),
    ]),
  ])));
  main.append(grid);
}

async function petView(main, id) {
  const p = await ClientApi.pet(id);
  main.append(
    el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-bottom:12px', onClick: () => navigate('/client') }, [icon('back', { size: 15 }), ' Назад']),
    el('div', { class: 'card card-pad' }, [
      el('h1', { style: 'font-size:22px' }, p.name),
      el('div', { class: 'muted', style: 'margin-bottom:14px' }, `${p.species || ''} ${p.breed ? '· ' + p.breed : ''}`),
      el('dl', { class: 'kv' }, [
        kv('Стать', { male: 'Самець', female: 'Самка', unknown: 'Невідомо' }[p.sex] || '—'),
        kv('Дата народження', fmtDate(p.birth_date)),
        kv('Вага', p.weight != null ? `${Number(p.weight)} кг` : '—'),
        kv('Чіп', p.chip_number),
      ]),
    ]),
    sectionCard('vaccine', 'Вакцинації', p.vaccinations, (v) => `${v.vaccine_name} · ${fmtDate(v.vaccination_date)}${v.next_vaccination_date ? ' (наступна ' + fmtDate(v.next_vaccination_date) + ')' : ''}`, 'Немає записів'),
    sectionCard('stethoscope', 'Рекомендації лікаря', p.appointments.filter((a) => a.recommendations || a.diagnosis),
      (a) => `${fmtDate(a.completed_at)}: ${a.diagnosis || ''}${a.recommendations ? ' — ' + a.recommendations : ''}`, 'Немає рекомендацій'),
  );
}

async function appointmentsView(main) {
  main.append(el('h1', { style: 'font-size:22px;margin-bottom:16px' }, 'Майбутні записи'));
  const items = await ClientApi.appointments();
  if (!items.length) { main.append(el('p', { class: 'muted' }, 'Немає запланованих записів')); return; }
  const card = el('div', { class: 'card card-pad' });
  items.forEach((e) => card.append(el('div', { class: 'list-line' }, [
    el('strong', {}, fmtDateTime(e.start_at)),
    el('div', { class: 'muted', style: 'font-size:13px' }, `${e.title}${e.patient_name ? ' · ' + e.patient_name : ''}`),
  ])));
  main.append(card);
}

async function invoicesView(main) {
  main.append(el('h1', { style: 'font-size:22px;margin-bottom:16px' }, 'Мої рахунки'));
  const items = await ClientApi.invoices();
  if (!items.length) { main.append(el('p', { class: 'muted' }, 'Рахунків немає')); return; }
  const card = el('div', { class: 'card card-pad' });
  items.forEach((i) => card.append(el('div', { class: 'list-line', style: 'display:flex;justify-content:space-between' }, [
    el('div', {}, [el('strong', {}, money(i.total)), el('span', { class: 'muted', style: 'font-size:13px' }, `  ${fmtDate(i.created_at)}`)]),
    Number(i.debt_amount) > 0 ? el('span', { class: 'badge badge-red' }, `борг ${money(i.debt_amount)}`) : el('span', { class: 'badge badge-green' }, 'оплачено'),
  ])));
  main.append(card);
}

async function discountView(main) {
  main.append(el('h1', { style: 'font-size:22px;margin-bottom:16px' }, 'Дисконтна картка'));
  const c = await ClientApi.discountCard();
  if (!c) { main.append(el('p', { class: 'muted' }, 'У вас немає дисконтної картки')); return; }
  main.append(el('div', { class: 'card card-pad', style: 'max-width:360px' }, [
    el('dl', { class: 'kv' }, [
      kv('Номер картки', c.card_number),
      kv('Знижка', `${Number(c.discount_percent)}%`),
      kv('Бонуси', money(c.bonus_balance)),
    ]),
  ]));
}

function sectionCard(iconName, title, items, fmt, emptyText) {
  const card = el('div', { class: 'card card-pad', style: 'margin-top:16px' }, [
    el('h2', { style: 'font-size:16px;margin-bottom:10px;display:flex;align-items:center;gap:8px' }, [
      el('span', { style: 'color:var(--c-primary);display:inline-flex' }, [icon(iconName, { size: 18 })]), title,
    ]),
  ]);
  if (!items || !items.length) card.append(el('p', { class: 'muted' }, emptyText));
  else items.forEach((it) => card.append(el('div', { class: 'list-line' }, fmt(it))));
  return card;
}
function kv(label, value) { return el('div', { style: 'display:contents' }, [el('dt', {}, label), el('dd', {}, value ?? '—')]); }
