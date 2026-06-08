import { el } from '../utils/dom.js';

// Прямокутник-плейсхолдер. w/h — будь-яка CSS-довжина.
export function skel(w = '100%', h = '12px', extra = '') {
  return el('span', { class: 'skeleton', style: `width:${w};height:${h};${extra}` });
}

// Рядки таблиці-плейсхолдера: rows × cols.
export function skeletonRows(cols, rows = 6) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const tds = [];
    for (let c = 0; c < cols; c++) {
      const w = c === 0 ? '70%' : `${40 + ((r + c) % 4) * 12}%`;
      tds.push(el('td', {}, [skel(w, '12px')]));
    }
    out.push(el('tr', { class: 'skel-row' }, tds));
  }
  return out;
}

// Картка-плейсхолдер (для блоків дашборду / списків).
export function skeletonCard(lines = 3) {
  const rows = [];
  for (let i = 0; i < lines; i++) rows.push(skel(`${90 - i * 15}%`, '12px', 'margin:10px 0'));
  return el('div', { class: 'card card-pad' }, rows);
}

// Набір skeleton-stat карток для дашборду.
export function skeletonStats(n = 5) {
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push(el('div', { class: 'stat' }, [skel('50%', '12px'), skel('60%', '30px', 'margin-top:6px')]));
  }
  return items;
}
