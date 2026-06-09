import { el, clear, esc } from '../utils/dom.js';
import { CalendarService, UserService, OwnerService, PatientService, PriceService, AppointmentService } from '../services/index.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { fullName, fmtTime, EVENT_STATUS } from '../utils/format.js';
import { navigate } from '../router.js';

const DAY_START = 8;   // 08:00
const DAY_END = 20;    // 20:00
const SLOT_MIN = 60;   // крок сітки, хв

const SLOT_PX = 48;
const VIEWS = [['day', 'День'], ['week', 'Тиждень'], ['month', 'Місяць'], ['list', 'Список']];

export async function renderCalendarPage(root) {
  const state = { date: new Date(), view: localStorage.getItem('calView') || 'week', doctorId: '', doctors: [], events: [] };
  state.date.setHours(0, 0, 0, 0);

  try { state.doctors = await UserService.doctors(); } catch { state.doctors = []; }

  const toolbar = el('div', { class: 'cal-toolbar' });
  const gridWrap = el('div');
  root.append(
    el('div', { class: 'page-head' }, [el('h1', {}, 'Календар')]),
    el('div', { class: 'calendar' }, [toolbar, gridWrap]),
  );

  function renderToolbar() {
    clear(toolbar);
    const docSelect = el('select', { onChange: (e) => { state.doctorId = e.target.value; load(); } }, [
      el('option', { value: '' }, 'Усі лікарі'),
      ...state.doctors.map((d) => el('option', { value: d.id, selected: d.id === state.doctorId }, fullName(d))),
    ]);
    const viewSwitch = el('div', { class: 'cal-views' }, VIEWS.map(([v, label]) =>
      el('button', { class: `btn btn-sm ${state.view === v ? 'btn-primary' : 'btn-ghost'}`,
        onClick: () => { state.view = v; localStorage.setItem('calView', v); load(); } }, label)));

    toolbar.append(
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => shift(-1) }, '‹'),
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => { state.date = today(); load(); } }, 'Сьогодні'),
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => shift(1) }, '›'),
      el('div', { class: 'cal-title' }, periodTitle()),
      el('div', { class: 'header__spacer', style: 'flex:1' }),
      viewSwitch,
      docSelect,
      can('calendar.manage')
        ? el('button', { class: 'btn btn-primary btn-sm', onClick: () => openEventForm(null, null, load) }, '+ Запис')
        : null,
    );
  }

  function periodTitle() {
    if (state.view === 'day') return state.date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (state.view === 'month') return state.date.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    if (state.view === 'week') {
      const [from, to] = weekRange(state.date);
      return `${from.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return 'Найближчі записи';
  }

  function shift(dir) {
    const d = new Date(state.date);
    if (state.view === 'day') d.setDate(d.getDate() + dir);
    else if (state.view === 'week') d.setDate(d.getDate() + dir * 7);
    else if (state.view === 'month') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    state.date = d; load();
  }

  function rangeFor() {
    const from = new Date(state.date), to = new Date(state.date);
    if (state.view === 'day') { from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999); }
    else if (state.view === 'week') { const [f, t] = weekRange(state.date); return [f, t]; }
    else if (state.view === 'month') {
      from.setDate(1); from.setHours(0, 0, 0, 0);
      to.setMonth(to.getMonth() + 1, 0); to.setHours(23, 59, 59, 999);
    } else { from.setHours(0, 0, 0, 0); to.setDate(to.getDate() + 30); to.setHours(23, 59, 59, 999); }
    return [from, to];
  }

  async function load() {
    renderToolbar();
    clear(gridWrap); gridWrap.append(el('div', { class: 'table-state' }, [el('div', { class: 'spinner' })]));
    const [from, to] = rangeFor();
    try {
      state.events = await CalendarService.events({
        from: from.toISOString(), to: to.toISOString(), doctorId: state.doctorId || undefined,
      });
    } catch (err) { Toast.fromError(err); state.events = []; }
    clear(gridWrap);
    if (state.view === 'day') gridWrap.append(renderTimeGrid([state.date]));
    else if (state.view === 'week') gridWrap.append(renderTimeGrid(weekDays(state.date)));
    else if (state.view === 'month') gridWrap.append(renderMonth());
    else gridWrap.append(renderList());
  }

  // Денний/тижневий: колонки днів із часовою сіткою + drag&drop
  function renderTimeGrid(days) {
    const times = el('div', { class: 'cal-times' }, [el('div', { class: 'cal-time-slot', style: 'height:28px' })]);
    for (let h = DAY_START; h < DAY_END; h++) times.append(el('div', { class: 'cal-time-slot' }, `${String(h).padStart(2, '0')}:00`));

    const cols = days.map((day) => {
      const head = el('div', { class: 'cal-col-head' + (isToday(day) ? ' today' : '') },
        day.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric' }));
      const colBody = el('div', { class: 'cal-day' });
      for (let h = DAY_START; h < DAY_END; h++) {
        const slot = el('div', { class: 'cal-day-slot', dataset: { hour: h, day: day.toISOString() } });
        slot.addEventListener('click', () => {
          if (!can('calendar.manage')) return;
          const start = new Date(day); start.setHours(h, 0, 0, 0);
          openEventForm(null, start, load);
        });
        enableDrop(slot, day, h);
        colBody.append(slot);
      }
      // події дня
      state.events.filter((ev) => sameDay(new Date(ev.start_at), day)).forEach((ev) => {
        colBody.append(eventNode(ev));
      });
      return el('div', { class: 'cal-col' }, [head, colBody]);
    });

    return el('div', { class: 'cal-grid', style: `grid-template-columns:60px repeat(${days.length}, 1fr)` }, [times, ...cols]);
  }

  function eventNode(ev) {
    const s = new Date(ev.start_at), e = new Date(ev.end_at);
    const top = 28 + ((s.getHours() - DAY_START) * 60 + s.getMinutes()) / SLOT_MIN * SLOT_PX;
    const height = Math.max(22, (e - s) / 60000 / SLOT_MIN * SLOT_PX - 2);
    const node = el('div', {
      class: 'cal-event', draggable: can('calendar.manage') ? 'true' : 'false',
      style: `top:${top}px;height:${height}px;${ev.color ? `background:${esc(ev.color)};` : ''}`,
      onClick: (evt) => { evt.stopPropagation(); openEventDetail(ev, load); },
    }, [
      el('div', {}, `${fmtTime(ev.start_at)} ${ev.title}`),
      el('small', {}, ev.patient_name || (ev.owner_first_name ? fullName({ first_name: ev.owner_first_name, last_name: ev.owner_last_name }) : '')),
    ]);
    node.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: ev.id, durMin: (e2(ev)) }));
      node.classList.add('dragging');
    });
    node.addEventListener('dragend', () => node.classList.remove('dragging'));
    return node;
  }
  function e2(ev) { return (new Date(ev.end_at) - new Date(ev.start_at)) / 60000; }

  // drop-зона: перенести подію на новий день/годину
  function enableDrop(slot, day, hour) {
    if (!can('calendar.manage')) return;
    slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drop-hover'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-hover'));
    slot.addEventListener('drop', async (e) => {
      e.preventDefault(); slot.classList.remove('drop-hover');
      let data; try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
      const ev = state.events.find((x) => x.id === data.id);
      if (!ev) return;
      const start = new Date(day); start.setHours(hour, new Date(ev.start_at).getMinutes(), 0, 0);
      const end = new Date(start.getTime() + data.durMin * 60000);
      try {
        await CalendarService.update(ev.id, { startAt: start.toISOString(), endAt: end.toISOString() });
        Toast.success('Перенесено');
        load();
      } catch (err) { Toast.fromError(err); }
    });
  }

  // Місячна сітка
  function renderMonth() {
    const first = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
    const startDow = (first.getDay() + 6) % 7; // пн=0
    const gridStart = new Date(first); gridStart.setDate(1 - startDow);
    const wd = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    const head = el('div', { class: 'cal-month-head' }, wd.map((d) => el('div', {}, d)));
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(gridStart); day.setDate(gridStart.getDate() + i);
      const inMonth = day.getMonth() === state.date.getMonth();
      const dayEvents = state.events.filter((ev) => sameDay(new Date(ev.start_at), day));
      const cell = el('div', { class: `cal-month-cell${inMonth ? '' : ' muted-cell'}${isToday(day) ? ' today' : ''}` }, [
        el('div', { class: 'cal-month-date' }, String(day.getDate())),
        ...dayEvents.slice(0, 4).map((ev) => el('div', { class: 'cal-month-ev',
          style: ev.color ? `background:${esc(ev.color)}` : '',
          onClick: (e) => { e.stopPropagation(); openEventDetail(ev, load); } },
          `${fmtTime(ev.start_at)} ${ev.title}`)),
        dayEvents.length > 4 ? el('div', { class: 'muted', style: 'font-size:11px' }, `+${dayEvents.length - 4}`) : null,
      ]);
      cell.addEventListener('click', () => {
        if (!can('calendar.manage')) return;
        const start = new Date(day); start.setHours(10, 0, 0, 0);
        openEventForm(null, start, load);
      });
      cells.push(cell);
    }
    return el('div', { class: 'cal-month' }, [head, el('div', { class: 'cal-month-grid' }, cells)]);
  }

  // Списковий режим
  function renderList() {
    const sorted = [...state.events].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    if (!sorted.length) return el('div', { class: 'table-state' }, 'Немає записів на період');
    const wrap = el('div', { style: 'padding:8px 0' });
    let lastDay = '';
    sorted.forEach((ev) => {
      const dayKey = new Date(ev.start_at).toDateString();
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        wrap.append(el('div', { class: 'cal-list-day' },
          new Date(ev.start_at).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })));
      }
      const [lbl, c] = EVENT_STATUS[ev.status] || [ev.status, 'badge-gray'];
      wrap.append(el('div', { class: 'cal-list-item', onClick: () => openEventDetail(ev, load) }, [
        el('strong', { style: 'min-width:54px' }, fmtTime(ev.start_at)),
        el('div', { style: 'flex:1' }, [
          el('div', {}, ev.title),
          el('small', { class: 'muted' }, [ev.patient_name, ev.doctor_first_name ? `· ${fullName({ first_name: ev.doctor_first_name, last_name: ev.doctor_last_name })}` : ''].filter(Boolean).join(' ')),
        ]),
        el('span', { class: `badge ${c}` }, lbl),
      ]));
    });
    return wrap;
  }

  load();
}

function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function isToday(d) { return sameDay(d, new Date()); }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function weekRange(date) {
  const from = new Date(date); const dow = (from.getDay() + 6) % 7; from.setDate(from.getDate() - dow); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23, 59, 59, 999);
  return [from, to];
}
function weekDays(date) {
  const [from] = weekRange(date);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(from); d.setDate(from.getDate() + i); return d; });
}

// Деталі події + дії
function openEventDetail(ev, onChange) {
  const [label, cls] = EVENT_STATUS[ev.status] || [ev.status, 'badge-gray'];
  const start = new Date(ev.start_at);
  const end = new Date(ev.end_at);
  const duration = Math.max(0, Math.round((end - start) / 60000));
  const body = el('div', { class: 'event-detail' }, [
    el('div', { class: 'event-detail__summary' }, [
      el('span', { class: `badge ${cls}` }, label),
      el('strong', {}, `${fmtTime(ev.start_at)} – ${fmtTime(ev.end_at)}`),
      el('span', { class: 'muted' }, durationLabel(duration)),
    ]),
    el('dl', { class: 'event-detail__list' }, [
      row('Дата', start.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })),
      row('Тип', eventTypeLabel(ev.type)),
      row('Власник', ev.owner_first_name ? fullName({ first_name: ev.owner_first_name, last_name: ev.owner_last_name }) : '—'),
      row('Пацієнт', ev.patient_name || '—'),
      row('Лікар', ev.doctor_first_name ? fullName({ first_name: ev.doctor_first_name, last_name: ev.doctor_last_name }) : '—'),
      row('Коментар', ev.comment || '—'),
    ]),
    can('calendar.manage') ? el('div', { class: 'form-actions event-detail__actions' }, [
      el('button', { class: 'btn btn-danger btn-sm', onClick: async () => {
        if (await confirmDialog({ title: 'Видалити подію?', danger: true, okText: 'Видалити' })) {
          try { await CalendarService.remove(ev.id); Toast.success('Видалено'); ctrl.close(); onChange(); }
          catch (err) { Toast.fromError(err); }
        }
      } }, 'Видалити'),
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => { ctrl.close(); openEventForm(ev, null, onChange); } }, 'Редагувати'),
    ]) : null,
  ]);
  const ctrl = openModal({ title: ev.title, body });
}

// Форма створення/редагування події
export async function openEventForm(ev, startAt, onSaved) {
  const isEdit = !!ev;
  const [doctors, ownersRes, services] = await Promise.all([
    UserService.doctors().catch(() => []),
    OwnerService.list({ limit: 100 }).catch(() => ({ items: [] })),
    PriceService.list().catch(() => []),
  ]);

  const start = ev ? new Date(ev.start_at) : (startAt || new Date());
  const end = ev ? new Date(ev.end_at) : new Date(start.getTime() + 30 * 60000);
  const durationMinutes = nearestDurationSlot(Math.round((end - start) / 60000));

  const { form } = buildForm([
    { name: 'title', label: 'Назва', required: true, value: ev?.title || 'Прийом', full: true },
    { name: 'serviceId', label: 'Послуга', type: 'select', value: '',
      options: [
        { value: '', label: services.length ? '— не обрано —' : 'Прайс порожній' },
        ...services.map((s) => ({ value: s.id, label: `${s.name} · ${Number(s.price)}₴` })),
      ] },
    { name: 'doctorId', label: 'Лікар', type: 'select', value: ev?.doctor_id || '',
      options: [{ value: '', label: '— не обрано —' }, ...doctors.map((d) => ({ value: d.id, label: fullName(d) }))] },
    { name: 'ownerId', label: 'Власник', type: 'select', value: ev?.owner_id || '', full: true,
      options: [{ value: '', label: '— не обрано —' }, ...ownersRes.items.map((o) => ({ value: o.id, label: `${fullName(o)} · ${o.phone || ''}` }))] },
    { name: 'patientId', label: 'Пацієнт', type: 'select', value: ev?.patient_id || '', full: true,
      options: [{ value: '', label: ev?.owner_id ? 'Завантаження пацієнтів…' : 'Спочатку оберіть власника' }] },
    { name: 'startAt', label: 'Початок', type: 'datetime-local', required: true, value: toLocal(start) },
    { name: 'durationMinutes', label: 'Тривалість', type: 'select', required: true, value: durationMinutes,
      options: durationSlots() },
    { name: 'comment', label: 'Коментар', type: 'textarea', value: ev?.comment, full: true },
  ], {
    submitText: isEdit ? 'Зберегти' : 'Створити',
    onCancel: () => ctrl.close(),
    onSubmit: async (values) => {
      const { serviceId, durationMinutes: selectedDuration, ...eventValues } = values;
      const startDate = new Date(eventValues.startAt);
      const duration = Number(selectedDuration || 30);
      const payload = {
        ...eventValues,
        type: ev?.type || 'appointment',
        startAt: startDate.toISOString(),
        endAt: new Date(startDate.getTime() + duration * 60000).toISOString(),
        ownerId: values.ownerId || null,
        patientId: values.patientId || null,
        doctorId: values.doctorId || null,
      };
      try {
        if (isEdit) {
          await CalendarService.update(ev.id, payload);
        } else {
          const event = await CalendarService.create(payload);
          // Для запису типу «прийом» з власником завжди створюємо прив'язаний
          // appointment (ТЗ §13.1) — інакше запис не зʼявиться у «Прийомах».
          if (payload.ownerId && payload.type === 'appointment') {
            try {
              const appt = await AppointmentService.create({
                ownerId: payload.ownerId,
                patientId: payload.patientId,
                doctorId: payload.doctorId,
                calendarEventId: event.id,
                reason: payload.title || null,
              });
              // Якщо обрано послугу — одразу додаємо її до прийому.
              if (serviceId) {
                const svc = services.find((s) => s.id === serviceId);
                if (svc) await AppointmentService.addService(appt.id, {
                  serviceId: svc.id, name: svc.name, price: Number(svc.price), quantity: 1,
                });
              }
            } catch (e) { Toast.error('Запис створено', 'Але не вдалося створити прийом: ' + (e?.message || '')); }
          }
        }
        Toast.success(isEdit ? 'Збережено' : 'Запис створено');
        ctrl.close();
        onSaved?.();
      } catch (err) { if (err?.fields) throw err; Toast.fromError(err); }
    },
  });

  const ownerSelect = form.querySelector('#f_ownerId');
  const patientSelect = form.querySelector('#f_patientId');
  const loadOwnerPatients = async (ownerId, selectedId = '') => {
    if (!patientSelect) return;
    patientSelect.replaceChildren(el('option', { value: '' }, ownerId ? 'Завантаження пацієнтів…' : 'Спочатку оберіть власника'));
    patientSelect.disabled = true;
    if (!ownerId) return;
    try {
      const res = await PatientService.list({ ownerId, limit: 100 });
      const patients = res.items || [];
      if (!patients.length) {
        patientSelect.replaceChildren(el('option', { value: '' }, 'У власника немає тварин'));
        return;
      }
      const value = selectedId || (patients.length === 1 ? patients[0].id : '');
      patientSelect.replaceChildren(
        el('option', { value: '' }, patients.length === 1 ? '— не обрано —' : 'Оберіть тварину'),
        ...patients.map((p) => el('option', { value: p.id, selected: p.id === value }, [p.name, p.species ? ` · ${p.species}` : '', p.breed ? ` · ${p.breed}` : ''].join(''))),
      );
      patientSelect.value = value;
      patientSelect.disabled = false;
    } catch (e) {
      patientSelect.replaceChildren(el('option', { value: '' }, 'Не вдалося завантажити тварин'));
    }
  };
  ownerSelect?.addEventListener('change', () => loadOwnerPatients(ownerSelect.value));
  if (ownerSelect?.value) loadOwnerPatients(ownerSelect.value, ev?.patient_id || '');

  const ctrl = openModal({ title: isEdit ? 'Редагувати запис' : 'Новий запис', body: form, wide: true });
}

function toLocal(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function durationSlots() {
  const slots = [];
  for (let minutes = 15; minutes <= 180; minutes += 15) {
    slots.push({ value: minutes, label: durationLabel(minutes) });
  }
  return slots;
}

function nearestDurationSlot(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 30;
  const rounded = Math.round(minutes / 15) * 15;
  return Math.min(180, Math.max(15, rounded));
}

function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} хв`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} год ${rest} хв` : `${hours} год`;
}

function eventTypeLabel(type) {
  return ({
    appointment: 'Прийом',
    procedure: 'Процедура',
    vaccination: 'Вакцинація',
    note: 'Нотатка',
    reminder: 'Нагадування',
  })[type] || type || '—';
}

function row(label, value) {
  return el('div', { class: 'event-detail__row' }, [el('dt', {}, label), el('dd', {}, value)]);
}
