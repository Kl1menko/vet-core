import { el, clear } from '../utils/dom.js';
import { OwnerService } from '../services/index.js';
import { Toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { can } from '../permissions.js';
import { fullName, money, initials } from '../utils/format.js';
import { openOwnerForm } from './ownersPage.js';
import { openPatientForm } from './patientsPage.js';
import { icon } from '../components/icons.js';
import { skeletonCard } from '../components/skeleton.js';

export async function renderOwnerProfilePage(root, id) {
  root.append(skeletonCard(5));
  let owner;
  try { owner = await OwnerService.get(id); }
  catch (err) { Toast.fromError(err); clear(root); root.append(el('p', { class: 'muted' }, 'Власника не знайдено')); return; }

  clear(root);
  root.append(
    el('div', { class: 'page-head' }, [
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => navigate('/owners') }, [icon('back', { size: 15 }), ' Назад']),
      can('owners.edit')
        ? el('button', { class: 'btn btn-primary', onClick: () => openOwnerForm(owner, () => renderOwnerProfilePage(root, id)) }, 'Редагувати')
        : null,
    ]),
    el('div', { class: 'card card-pad' }, [
      el('div', { class: 'profile-head' }, [
        el('div', { class: 'avatar avatar-lg' }, initials(owner)),
        el('div', {}, [
          el('h1', { style: 'font-size:22px' }, fullName(owner)),
          el('div', { class: 'muted' }, owner.phone || ''),
        ]),
      ]),
      el('dl', { class: 'kv' }, [
        kv('Телефон', owner.phone),
        kv('Додатковий', owner.secondary_phone),
        kv('Email', owner.email),
        kv('Адреса', owner.address),
        kv('Знижка', `${Number(owner.discount_percent || 0)}%`),
        kv('Баланс', money(owner.balance)),
        kv('Коментар', owner.comment),
      ]),
    ]),
    petsBlock(owner, root, id),
  );
}

function petsBlock(owner, root, id) {
  const block = el('div', { class: 'card card-pad', style: 'margin-top:16px' });
  block.append(el('div', { class: 'page-head', style: 'margin-bottom:12px' }, [
    el('h2', { style: 'font-size:18px' }, 'Тварини'),
    can('patients.create')
      ? el('button', { class: 'btn btn-ghost btn-sm', onClick: () =>
          openPatientForm(null, { id: owner.id, label: fullName(owner) }, () => renderOwnerProfilePage(root, id)) }, '+ Тварина')
      : null,
  ]));
  if (!owner.animals?.length) {
    block.append(el('p', { class: 'muted' }, 'Немає тварин'));
  } else {
    owner.animals.forEach((p) => block.append(el('div', {
      class: 'list-line', style: 'cursor:pointer', onClick: () => navigate(`/patients/${p.id}`),
    }, [
      el('strong', {}, p.name),
      el('span', { class: 'muted' }, ` · ${[p.species, p.breed].filter(Boolean).join(' ') || ''}`),
    ])));
  }
  return block;
}

function kv(label, value) {
  return el('div', { style: 'display:contents' }, [el('dt', {}, label), el('dd', {}, value || '—')]);
}
