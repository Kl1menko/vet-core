import { el, clear } from '../utils/dom.js';
import { ReminderService } from '../services/index.js';
import { renderTable } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { fullName, fmtDateTime } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/emptyState.js';

const STATUS = { planned: ['Заплановано', 'badge-blue'], sent: ['Надіслано', 'badge-green'], cancelled: ['Скасовано', 'badge-gray'] };
const CHANNEL = { internal: 'Внутрішнє', sms: 'SMS', email: 'Email', push: 'Push' };

export function renderRemindersPage(root) {
  const state = { status: 'planned', loading: true, items: [] };
  const sel = el('select', { onChange: (e) => { state.status = e.target.value; load(); } }, [
    el('option', { value: 'planned' }, 'Заплановані'),
    el('option', { value: 'sent' }, 'Надіслані'),
    el('option', { value: '' }, 'Усі'),
  ]);
  root.append(el('div', { class: 'page-head' }, [el('h1', {}, 'Нагадування'), el('div', { class: 'toolbar' }, [sel])]));
  const container = el('div'); root.append(container);

  async function load() {
    state.loading = true; render();
    try { state.items = await ReminderService.list({ status: state.status || undefined }); }
    catch (e) { Toast.fromError(e); } finally { state.loading = false; render(); }
  }
  function reload() { load(); }
  function render() {
    clear(container);
    container.append(renderTable([
      { title: 'Коли', render: (r) => fmtDateTime(r.scheduled_at) },
      { title: 'Заголовок', render: (r) => el('strong', {}, r.title || r.type) },
      { title: 'Власник', render: (r) => r.owner_first_name ? fullName({ first_name: r.owner_first_name, last_name: r.owner_last_name }) : '—' },
      { title: 'Пацієнт', render: (r) => r.patient_name || '—' },
      { title: 'Канал', render: (r) => CHANNEL[r.channel] || r.channel },
      { title: 'Статус', render: (r) => { const [l, c] = STATUS[r.status] || [r.status, 'badge-gray']; return el('span', { class: `badge ${c}` }, l); } },
      { title: '', width: '160px', render: (r) => r.status === 'planned' ? el('div', { class: 'row-actions' }, [
        el('button', { class: 'btn btn-ghost btn-sm', onClick: async () => {
          try { await ReminderService.send(r.id); Toast.success('Надіслано'); reload(); } catch (e) { Toast.fromError(e); }
        } }, 'Надіслати'),
        el('button', { class: 'btn btn-ghost btn-sm', title: 'Скасувати', onClick: async () => {
          try { await ReminderService.cancel(r.id); Toast.info('Скасовано'); reload(); } catch (e) { Toast.fromError(e); }
        } }, [icon('close', { size: 15 })]),
      ]) : null },
    ], state.items, { loading: state.loading, emptyText: emptyState({ icon: 'bell', title: 'Немає нагадувань', hint: 'Нагадування створюються автоматично (напр. вакцинації)' }) }));
  }
  load();
}
