/** Серіалізація/парсинг CSV без залежностей. */

function escapeCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** rows: масив об'єктів; columns: [{ key, title }]. Повертає CSV-рядок із BOM (для Excel). */
export function toCSV(rows, columns) {
  const header = columns.map((c) => escapeCell(c.title)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.format ? c.format(r[c.key], r) : r[c.key])).join(',')).join('\n');
  return '﻿' + header + '\n' + body + '\n';
}

/** Простий парсер CSV (підтримує лапки, коми, переноси всередині лапок). */
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch === '\r') { /* ignore */ }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { headers, records };
}
