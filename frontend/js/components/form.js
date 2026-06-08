import { el } from '../utils/dom.js';

/**
 * Будівник форм з валідацією (ТЗ §23.13, §23.8 inline).
 * fields: [{ name, label, type, required, options, value, full, min, placeholder }]
 *   type: text|email|tel|number|date|datetime-local|textarea|select|checkbox
 * onSubmit(values) — може кинути { fields: {name:msg} } для серверних помилок.
 */
export function buildForm(fields, { onSubmit, submitText = 'Зберегти', onCancel } = {}) {
  const inputs = {};
  const errorNodes = {};

  const fieldNodes = fields.map((f) => {
    const id = `f_${f.name}`;
    let input;
    if (f.type === 'textarea') {
      input = el('textarea', { id, placeholder: f.placeholder || '' });
      if (f.value != null) input.value = f.value;
    } else if (f.type === 'select') {
      input = el('select', { id }, (f.options || []).map((o) =>
        el('option', { value: o.value, selected: String(o.value) === String(f.value ?? '') }, o.label)));
    } else if (f.type === 'checkbox') {
      input = el('input', { id, type: 'checkbox' });
      input.checked = !!f.value;
    } else {
      input = el('input', { id, type: f.type || 'text', placeholder: f.placeholder || '' });
      if (f.value != null) input.value = f.value;
      if (f.min != null) input.min = f.min;
      if (f.max != null) input.max = f.max;
      if (f.step != null) input.step = f.step;
    }
    inputs[f.name] = { input, def: f };

    const errNode = el('div', { class: 'err' });
    errorNodes[f.name] = errNode;

    return el('div', { class: `field ${f.full ? 'full' : ''}` }, [
      f.type === 'checkbox'
        ? el('label', { for: id, style: 'display:flex;gap:8px;align-items:center' }, [input, f.label])
        : el('label', { for: id }, f.label + (f.required ? ' *' : '')),
      f.type === 'checkbox' ? null : input,
      errNode,
    ]);
  });

  function getValues() {
    const out = {};
    for (const [name, { input, def }] of Object.entries(inputs)) {
      if (def.type === 'checkbox') out[name] = input.checked;
      else if (def.type === 'number') out[name] = input.value === '' ? null : Number(input.value);
      else out[name] = input.value.trim?.() ?? input.value;
    }
    return out;
  }

  function clearErrors() {
    for (const name of Object.keys(errorNodes)) {
      errorNodes[name].textContent = '';
      errorNodes[name].parentElement.classList.remove('has-error');
    }
  }

  function setError(name, msg) {
    if (errorNodes[name]) {
      errorNodes[name].textContent = msg;
      errorNodes[name].parentElement.classList.add('has-error');
    }
  }

  function validateLocal(values) {
    let okFlag = true;
    for (const f of fields) {
      const v = values[f.name];
      const empty = v == null || v === '';
      if (f.required && empty) {
        setError(f.name, "Обов'язкове поле");
        okFlag = false;
        continue;
      }
      if (!empty && f.type === 'number') {
        if (f.min != null && Number(v) < f.min) { setError(f.name, `Мінімум ${f.min}`); okFlag = false; }
        else if (f.max != null && Number(v) > f.max) { setError(f.name, `Максимум ${f.max}`); okFlag = false; }
      }
    }
    return okFlag;
  }

  const submitBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, submitText);

  const form = el('form', { class: 'form-grid' }, [
    ...fieldNodes,
    el('div', { class: 'form-actions full' }, [
      onCancel ? el('button', { class: 'btn btn-ghost', type: 'button', onClick: onCancel }, 'Скасувати') : null,
      submitBtn,
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const values = getValues();
    if (!validateLocal(values)) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження…';
    try {
      await onSubmit(values);
    } catch (err) {
      if (err?.fields) {
        for (const [name, msg] of Object.entries(err.fields)) setError(name, msg);
      } else {
        throw err; // прокидаємо вище для Toast
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitText;
    }
  });

  return { form, getValues, setError, clearErrors };
}
