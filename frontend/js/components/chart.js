// Прості SVG-графіки без залежностей. Колір — currentColor / var(--c-primary).
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/**
 * Стовпчиковий графік. data: [{ label, value }].
 */
export function barChart(data, { height = 180, color = 'var(--c-primary)', format = (v) => v } = {}) {
  const pad = { l: 4, r: 4, t: 10, b: 28 };
  // Фіксована ширина «слота» під стовпчик у px — щоб мало стовпчиків не розтягувалися
  const slot = 56;
  const w = Math.max(slot, data.length * slot) + pad.l + pad.r;
  const max = Math.max(1, ...data.map((d) => Number(d.value)));
  const innerH = height - pad.t - pad.b;
  const bw = (w - pad.l - pad.r) / data.length;
  const barW = Math.min(40, bw * 0.6); // обмежуємо товщину стовпчика

  // preserveAspectRatio за замовч. (meet) — НЕ розтягуємо по горизонталі.
  // Інтринсік-ширина = w; через max-width у .chart лишається адаптивним без спотворення.
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${height}`, width: w, height, class: 'chart' });
  svg.style.maxWidth = '100%';
  data.forEach((d, i) => {
    const v = Number(d.value);
    const bh = (v / max) * innerH;
    const cx = pad.l + i * bw + bw / 2;
    const y = pad.t + innerH - bh;
    const rect = svgEl('rect', { x: cx - barW / 2, y, width: barW, height: Math.max(0, bh), rx: 5, fill: color });
    const tt = svgEl('title'); tt.textContent = `${d.label}: ${format(v)}`; rect.append(tt);
    svg.append(rect);
    // підпис
    const lbl = svgEl('text', { x: cx, y: height - 10, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--c-text-muted)' });
    lbl.textContent = d.label;
    svg.append(lbl);
  });
  return wrap(svg);
}

/**
 * Лінійний графік. data: [{ label, value }].
 */
export function lineChart(data, { height = 180, color = 'var(--c-primary)', format = (v) => v } = {}) {
  const pad = { l: 4, r: 4, t: 12, b: 28 };
  const slot = 56;
  const w = Math.max(slot * 2, data.length * slot) + pad.l + pad.r;
  const max = Math.max(1, ...data.map((d) => Number(d.value)));
  const innerH = height - pad.t - pad.b;
  const stepX = data.length > 1 ? (w - pad.l - pad.r) / (data.length - 1) : 0;
  const pts = data.map((d, i) => {
    const x = data.length > 1 ? pad.l + i * stepX : w / 2;
    const y = pad.t + innerH - (Number(d.value) / max) * innerH;
    return [x, y];
  });

  // meet (за замовч.) — кола й товщина лінії не спотворюються
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${height}`, width: w, height, class: 'chart' });
  svg.style.maxWidth = '100%';
  // площа під лінією
  if (pts.length) {
    const area = `M${pts[0][0]},${pad.t + innerH} ` + pts.map((p) => `L${p[0]},${p[1]}`).join(' ')
      + ` L${pts[pts.length - 1][0]},${pad.t + innerH} Z`;
    svg.append(svgEl('path', { d: area, fill: color, 'fill-opacity': '0.12' }));
    svg.append(svgEl('path', { d: 'M' + pts.map((p) => `${p[0]},${p[1]}`).join(' L'), fill: 'none', stroke: color, 'stroke-width': 2 }));
  }
  pts.forEach((p, i) => {
    const c = svgEl('circle', { cx: p[0], cy: p[1], r: 3, fill: color });
    const tt = svgEl('title'); tt.textContent = `${data[i].label}: ${format(Number(data[i].value))}`; c.append(tt);
    svg.append(c);
    if (i % Math.ceil(data.length / 8 || 1) === 0) {
      const lbl = svgEl('text', { x: p[0], y: height - 10, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--c-text-muted)' });
      lbl.textContent = data[i].label;
      svg.append(lbl);
    }
  });
  return wrap(svg);
}

function wrap(svg) {
  const d = document.createElement('div');
  d.className = 'chart-wrap';
  d.append(svg);
  return d;
}
