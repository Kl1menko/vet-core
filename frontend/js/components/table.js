import { el } from '../utils/dom.js';
import { skeletonRows } from './skeleton.js';

/**
 * Таблиця з loading/empty станами (ТЗ §23.14).
 * columns: [{ title, render(row) -> Node|string, width }]
 * options: { onRowClick, loading, emptyText (рядок або Node) }
 */
export function renderTable(columns, rows, options = {}) {
  const { onRowClick, loading = false, emptyText = 'Немає даних' } = options;

  const thead = el('thead', {}, [
    el('tr', {}, columns.map((c) => el('th', c.width ? { style: `width:${c.width}` } : {}, c.title))),
  ]);

  let bodyContent;
  if (loading) {
    // shimmer-плейсхолдер замість спінера
    bodyContent = skeletonRows(columns.length, 6);
  } else if (!rows.length) {
    bodyContent = el('tr', {}, [
      el('td', { colspan: columns.length }, [el('div', { class: 'table-state' }, [emptyText])]),
    ]);
  } else {
    bodyContent = rows.map((row) => {
      const tr = el('tr', onRowClick ? { class: 'clickable' } : {},
        columns.map((c) => {
          const val = c.render ? c.render(row) : (row[c.key] ?? '—');
          // data-label для карткового вигляду на мобільних (ТЗ §18)
          return el('td', c.title ? { dataset: { label: c.title } } : {}, [val ?? '—']);
        }));
      if (onRowClick) {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('.row-actions')) return; // не клікати по кнопках дій
          onRowClick(row);
        });
      }
      return tr;
    });
  }

  const tbody = el('tbody', {}, Array.isArray(bodyContent) ? bodyContent : [bodyContent]);
  return el('div', { class: 'table-wrap' }, [el('table', { class: 'data-table' }, [thead, tbody])]);
}

// Пагінація. meta: { page, totalPages }. onPage(p).
export function renderPagination(meta, onPage) {
  if (!meta || meta.totalPages <= 1) return el('div');
  const { page, totalPages } = meta;
  const buttons = [];
  buttons.push(el('button', { disabled: page <= 1, onClick: () => onPage(page - 1) }, '‹'));
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && p > 2 && p < totalPages - 1 && Math.abs(p - page) > 1) {
      if (p === 3 || p === totalPages - 2) buttons.push(el('span', { class: 'muted' }, '…'));
      continue;
    }
    buttons.push(el('button', { class: p === page ? 'active' : '', onClick: () => onPage(p) }, String(p)));
  }
  buttons.push(el('button', { disabled: page >= totalPages, onClick: () => onPage(page + 1) }, '›'));
  return el('div', { class: 'pagination' }, buttons);
}
