import { el } from '../utils/dom.js';
import { Api, downloadFile } from '../api.js';
import { openModal } from './modal.js';
import { Toast } from './toast.js';
import { icon } from './icons.js';

// Кнопка експорту CSV
export function exportButton(endpoint, filename, label = 'Експорт CSV') {
  return el('button', { class: 'btn btn-ghost btn-sm', onClick: async () => {
    try { await downloadFile(endpoint, filename); Toast.success('Завантажено', filename); }
    catch (e) { Toast.fromError(e); }
  } }, [icon('download', { size: 15 }), ` ${label}`]);
}

// Кнопка + модал імпорту CSV для сутності (owners|services|drugs)
export function importButton(entity, label, onDone) {
  return el('button', { class: 'btn btn-ghost btn-sm', onClick: () => openImport(entity, label, onDone) }, [icon('upload', { size: 15 }), ' Імпорт']);
}

async function openImport(entity, label, onDone) {
  let sample = '';
  try { sample = (await Api.get(`/import/${entity}/sample`)).sample; } catch { /* ignore */ }

  const fileInput = el('input', { type: 'file', accept: '.csv,text/csv', class: 'import-file-input' });
  const resultBox = el('div', { style: 'margin-top:12px' });
  const btn = el('button', { class: 'btn btn-primary import-submit' }, [
    icon('upload', { size: 17 }),
    'Імпортувати',
  ]);

  btn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) { Toast.error('Оберіть файл'); return; }
    btn.disabled = true; btn.replaceChildren('Імпорт…');
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await Api.upload(`/import/${entity}`, fd);
      resultBox.innerHTML = '';
      resultBox.append(
        el('p', {}, [el('strong', {}, `Імпортовано: ${r.imported} із ${r.total}`)]),
        r.failed ? el('p', { class: 'err' }, `Помилок: ${r.failed}`) : null,
        ...(r.errors || []).map((e) => el('div', { class: 'muted', style: 'font-size:12px' }, `Рядок ${e.row}: ${e.message}`)),
      );
      if (r.imported) { Toast.success('Імпорт завершено', `Додано ${r.imported}`); onDone?.(); }
    } catch (e) { Toast.fromError(e); }
    finally { btn.disabled = false; btn.replaceChildren(icon('upload', { size: 17 }), 'Імпортувати'); }
  });

  const body = el('div', { class: 'import-modal' }, [
    el('p', { class: 'import-hint' }, 'Файл CSV з рядком заголовка. Очікувані колонки:'),
    el('pre', { class: 'import-sample' }, sample || '—'),
    el('div', { class: 'import-file' }, [fileInput]),
    el('div', { class: 'form-actions import-actions' }, [btn]),
    resultBox,
  ]);
  openModal({ title: `Імпорт: ${label}`, body });
}
