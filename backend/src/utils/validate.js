import { ApiError } from './ApiError.js';

/**
 * Легкий валідатор без залежностей.
 * schema: { field: { required, type, min, max, enum, email, custom } }
 * Повертає очищений об'єкт лише з описаних полів. Кидає ApiError.validation.
 */
export function validate(data, schema) {
  const fields = {};
  const out = {};
  data = data || {};

  for (const [key, rule] of Object.entries(schema)) {
    let value = data[key];
    const present = value !== undefined && value !== null && value !== '';

    if (!present) {
      if (rule.required) fields[key] = "Обов'язкове поле";
      else if (rule.default !== undefined) out[key] = rule.default;
      continue;
    }

    if (rule.type === 'number') {
      const n = Number(value);
      if (Number.isNaN(n)) { fields[key] = 'Має бути числом'; continue; }
      value = n;
    } else if (rule.type === 'boolean') {
      value = value === true || value === 'true' || value === 1 || value === '1';
    } else if (rule.type === 'string' || !rule.type) {
      value = String(value).trim();
    }

    if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      fields[key] = 'Невірний email'; continue;
    }
    if (rule.min !== undefined) {
      const len = typeof value === 'number' ? value : value.length;
      if (len < rule.min) { fields[key] = `Мінімум ${rule.min}`; continue; }
    }
    if (rule.max !== undefined) {
      const len = typeof value === 'number' ? value : value.length;
      if (len > rule.max) { fields[key] = `Максимум ${rule.max}`; continue; }
    }
    if (rule.enum && !rule.enum.includes(value)) {
      fields[key] = `Допустимі значення: ${rule.enum.join(', ')}`; continue;
    }
    if (rule.custom) {
      const msg = rule.custom(value, data);
      if (msg) { fields[key] = msg; continue; }
    }

    out[key] = value;
  }

  if (Object.keys(fields).length) {
    throw ApiError.validation('Помилка валідації', fields);
  }
  return out;
}
