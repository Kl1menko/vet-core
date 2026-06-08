import { el, clear } from '../utils/dom.js';
import { PatientService, AppointmentService, FileService, VaccinationService } from '../services/index.js';
import { Toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { can } from '../permissions.js';
import { fullName, fmtDate, fmtDateTime } from '../utils/format.js';
import { openPatientForm } from './patientsPage.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { icon } from '../components/icons.js';
import { skeletonCard } from '../components/skeleton.js';

export async function renderPatientProfilePage(root, id) {
  root.append(skeletonCard(5));
  let patient;
  try { patient = await PatientService.get(id); }
  catch (err) { Toast.fromError(err); clear(root); root.append(el('p', { class: 'muted' }, 'Пацієнта не знайдено')); return; }

  clear(root);
  const sexLabel = { male: 'Самець', female: 'Самка', unknown: 'Невідомо' }[patient.sex] || '—';

  const tabsBar = el('div', { class: 'tabs' });
  const tabBody = el('div');
  const tabs = {
    'Загальне': () => generalTab(patient),
    'Вакцинації': () => vaccinationsTab(patient),
    'Прийоми': () => appointmentsTab(patient.id),
    'Файли': () => filesTab(patient),
  };
  Object.keys(tabs).forEach((name, i) => {
    const t = el('div', { class: `tab ${i === 0 ? 'active' : ''}`, onClick: () => {
      tabsBar.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      clear(tabBody); Promise.resolve(tabs[name]()).then((node) => tabBody.append(node));
    } }, name);
    tabsBar.append(t);
  });

  root.append(
    el('div', { class: 'page-head' }, [
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => navigate('/patients') }, [icon('back', { size: 15 }), ' Назад']),
      can('patients.edit')
        ? el('button', { class: 'btn btn-primary', onClick: () => openPatientForm(patient, null, () => renderPatientProfilePage(root, id)) }, 'Редагувати')
        : null,
    ]),
    el('div', { class: 'card card-pad' }, [
      el('div', { class: 'profile-head' }, [
        el('div', { class: 'avatar avatar-lg' }, [icon('paw', { size: 30 })]),
        el('div', {}, [
          el('h1', { style: 'font-size:22px' }, patient.name),
          el('div', { class: 'muted' }, `${patient.species || ''} ${patient.breed ? '· ' + patient.breed : ''} · ${sexLabel}`),
        ]),
      ]),
      tabsBar,
      tabBody,
    ]),
  );

  clear(tabBody);
  tabBody.append(generalTab(patient));
}

function generalTab(p) {
  return el('dl', { class: 'kv' }, [
    kv('Власник', el('a', { href: `/owners/${p.owner_id}`, style: 'color:var(--c-primary)',
      onClick: (e) => { e.preventDefault(); navigate(`/owners/${p.owner_id}`); } },
      fullName({ first_name: p.owner_first_name, last_name: p.owner_last_name }))),
    kv('Телефон власника', p.owner_phone),
    kv('Вид', p.species), kv('Порода', p.breed), kv('Окрас', p.color),
    kv('Дата народження', fmtDate(p.birth_date)),
    kv('Вага', p.weight != null ? `${Number(p.weight)} кг` : '—'),
    kv('Чіп', p.chip_number), kv('Паспорт', p.passport_number),
    kv('Стерилізація', p.is_sterilized ? 'Так' : 'Ні'),
    kv('Примітки', p.notes),
  ]);
}

function vaccinationsTab(p) {
  const wrap = el('div', {});
  const list = el('div', {}, [el('div', { class: 'spinner' })]);
  const canEdit = can('patients.edit') || can('appointments.edit');

  if (canEdit) {
    wrap.append(el('div', { class: 'toolbar', style: 'margin-bottom:10px' }, [
      el('button', { class: 'btn btn-primary btn-sm', onClick: () => openVaccinationForm(p, null, loadVacc) },
        [icon('vaccine', { size: 15 }), ' + Вакцинація']),
    ]));
  }
  wrap.append(list);

  async function loadVacc() {
    clear(list); list.append(el('div', { class: 'spinner' }));
    try {
      const rows = await VaccinationService.list({ patientId: p.id });
      clear(list);
      if (!rows.length) { list.append(el('p', { class: 'muted' }, 'Немає записів про вакцинації')); return; }
      rows.forEach((v) => list.append(el('div', { class: 'list-line', style: 'display:flex;gap:12px;align-items:center' }, [
        el('div', { style: 'flex:1' }, [
          el('strong', {}, v.vaccine_name),
          el('div', { class: 'muted', style: 'font-size:13px' }, [
            fmtDate(v.vaccination_date),
            v.next_vaccination_date ? ` · наступна: ${fmtDate(v.next_vaccination_date)}` : '',
            v.manufacturer ? ` · ${v.manufacturer}` : '',
            v.batch_number ? ` · партія ${v.batch_number}` : '',
          ].filter(Boolean).join('')),
        ]),
        canEdit ? el('button', { class: 'btn btn-ghost btn-sm', title: 'Редагувати', onClick: () => openVaccinationForm(p, v, loadVacc) }, [icon('edit', { size: 15 })]) : null,
        canEdit ? el('button', { class: 'btn btn-danger btn-sm', title: 'Видалити', onClick: async () => {
          if (await confirmDialog({ title: 'Видалити вакцинацію?', message: v.vaccine_name, danger: true, okText: 'Видалити' })) {
            try { await VaccinationService.remove(v.id); Toast.success('Видалено'); loadVacc(); } catch (e) { Toast.fromError(e); }
          }
        } }, [icon('trash', { size: 15 })]) : null,
      ])));
    } catch (e) { clear(list); list.append(el('p', { class: 'muted' }, 'Помилка завантаження')); }
  }
  loadVacc();
  return wrap;
}

function openVaccinationForm(patient, vacc, onSaved) {
  const isEdit = !!vacc;
  const { form } = buildForm([
    { name: 'vaccineName', label: 'Назва вакцини', required: true, full: true, value: vacc?.vaccine_name },
    { name: 'vaccinationDate', label: 'Дата вакцинації', type: 'date', required: true,
      value: vacc?.vaccination_date ? String(vacc.vaccination_date).slice(0, 10) : new Date().toISOString().slice(0, 10) },
    { name: 'nextVaccinationDate', label: 'Наступна вакцинація', type: 'date',
      value: vacc?.next_vaccination_date ? String(vacc.next_vaccination_date).slice(0, 10) : '' },
    { name: 'manufacturer', label: 'Виробник', value: vacc?.manufacturer },
    { name: 'batchNumber', label: 'Номер партії', value: vacc?.batch_number },
    { name: 'comment', label: 'Коментар', type: 'textarea', full: true, value: vacc?.comment },
  ], {
    submitText: isEdit ? 'Зберегти' : 'Додати', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      const payload = { ...v, patientId: patient.id, nextVaccinationDate: v.nextVaccinationDate || null };
      try {
        if (isEdit) { await VaccinationService.update(vacc.id, payload); Toast.success('Збережено'); }
        else { await VaccinationService.create(payload); Toast.success('Вакцинацію додано'); }
        ctrl.close(); onSaved?.();
      } catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: isEdit ? 'Редагувати вакцинацію' : 'Нова вакцинація', body: form });
}

async function appointmentsTab(patientId) {
  const wrap = el('div', {}, [el('div', { class: 'spinner' })]);
  try {
    const res = await AppointmentService.list({ patientId, limit: 50 });
    clear(wrap);
    if (!res.items.length) { wrap.append(el('p', { class: 'muted' }, 'Немає прийомів')); return wrap; }
    res.items.forEach((a) => wrap.append(el('div', { class: 'list-line', style: 'cursor:pointer',
      onClick: () => navigate(`/appointments/${a.id}`) }, [
      el('strong', {}, a.diagnosis || a.reason || 'Прийом'),
      el('div', { class: 'muted', style: 'font-size:13px' },
        `${fmtDateTime(a.created_at)} · ${fullName({ first_name: a.doctor_first_name, last_name: a.doctor_last_name })}`),
    ])));
  } catch (err) { clear(wrap); wrap.append(el('p', { class: 'muted' }, 'Помилка завантаження')); }
  return wrap;
}

function filesTab(patient) {
  const wrap = el('div', {});
  const list = el('div', { style: 'margin-top:12px' }, [el('div', { class: 'spinner' })]);

  const fileInput = el('input', { type: 'file', style: 'display:none',
    accept: 'image/*,application/pdf,.doc,.docx' });
  const categorySel = el('select', { style: 'max-width:180px' }, [
    ['analysis', 'Аналіз'], ['xray', 'Рентген/УЗД'], ['document', 'Документ'], ['photo', 'Фото'], ['other', 'Інше'],
  ].map(([v, l]) => el('option', { value: v }, l)));

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('patientId', patient.id);
    fd.append('ownerId', patient.owner_id);
    fd.append('category', categorySel.value);
    try {
      await FileService.upload(fd);
      Toast.success('Файл завантажено');
      loadFiles();
    } catch (e) { Toast.fromError(e); }
    finally { fileInput.value = ''; }
  });

  if (can('patients.edit') || can('appointments.edit')) {
    wrap.append(el('div', { class: 'toolbar', style: 'margin-bottom:8px' }, [
      categorySel,
      el('button', { class: 'btn btn-primary btn-sm', onClick: () => fileInput.click() }, '+ Завантажити файл'),
      fileInput,
    ]));
  }
  wrap.append(list);

  async function loadFiles() {
    clear(list); list.append(el('div', { class: 'spinner' }));
    try {
      const files = await FileService.list({ patientId: patient.id });
      clear(list);
      if (!files.length) { list.append(el('p', { class: 'muted' }, 'Файлів ще немає')); return; }
      files.forEach((f) => {
        const isImg = (f.file_type || '').startsWith('image/');
        list.append(el('div', { class: 'list-line', style: 'display:flex;gap:12px;align-items:center' }, [
          isImg
            ? el('img', { src: f.file_url, alt: f.file_name, style: 'width:48px;height:48px;object-fit:cover;border-radius:6px' })
            : el('div', { style: 'width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:var(--c-bg);border-radius:6px;color:var(--c-text-muted)' }, [icon('file', { size: 22 })]),
          el('div', { style: 'flex:1' }, [
            el('a', { href: f.file_url, target: '_blank', style: 'color:var(--c-primary);font-weight:600' }, f.file_name),
            el('div', { class: 'muted', style: 'font-size:12px' },
              `${catLabel(f.category)} · ${(Number(f.file_size) / 1024).toFixed(0)} КБ · ${fmtDate(f.created_at)}`),
          ]),
          can('patients.edit') ? el('button', { class: 'btn btn-danger btn-sm', title: 'Видалити', onClick: async () => {
            try { await FileService.remove(f.id); Toast.success('Видалено'); loadFiles(); } catch (e) { Toast.fromError(e); }
          } }, [icon('trash', { size: 15 })]) : null,
        ]));
      });
    } catch (e) { clear(list); list.append(el('p', { class: 'muted' }, 'Помилка завантаження')); }
  }
  loadFiles();
  return wrap;
}

function catLabel(c) {
  return ({ analysis: 'Аналіз', xray: 'Рентген/УЗД', document: 'Документ', photo: 'Фото', other: 'Інше' })[c] || c;
}

function kv(label, value) {
  return el('div', { style: 'display:contents' }, [el('dt', {}, label), el('dd', {}, value ?? '—')]);
}
