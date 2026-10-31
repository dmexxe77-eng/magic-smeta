import { adjustmentLabel } from './estimate-adjustment.js';
import { partitionEstimateExport, prepareEstimateExport } from './estimate-export.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => (Number.isFinite(value) ? value : 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const money = value => `${number(value)} ₽`;
const CATEGORIES = [['mats', 'Материалы', 'materialsTotal'], ['works', 'Работы', 'worksTotal'], ['equipment', 'Оборудование', 'equipmentTotal']];
const COLUMNS = [['num', '№'], ['name', 'Наименование'], ['qty', 'Кол-во'], ['unit', 'Ед.'], ['price', 'Цена, ₽'], ['total', 'Сумма, ₽']];
const ring = points => Array.isArray(points) && points.length >= 3 && points.every(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])) ? points : [];
const polygonArea = points => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0)) / 2;

export function roomDrawingHtml(room) {
  const points = ring(room?.v);
  if (!points.length) return '<p class="estimate-empty">Чертёж не добавлен</p>';
  const holes = (Array.isArray(room.holes) ? room.holes : []).map(ring).filter(points => points.length);
  const rings = [points, ...holes];
  const minX = Math.min(...points.map(point => point[0])), minY = Math.min(...points.map(point => point[1]));
  const width = Math.max(0.001, Math.max(...points.map(point => point[0])) - minX);
  const height = Math.max(0.001, Math.max(...points.map(point => point[1])) - minY);
  const scale = Math.min(540 / width, 232 / height);
  const ox = (620 - width * scale) / 2, oy = (312 - height * scale) / 2;
  const transform = point => [ox + (point[0] - minX) * scale, oy + (point[1] - minY) * scale];
  const path = rings.map(points => `M${points.map(point => transform(point).map(value => value.toFixed(2)).join(' ')).join('L')}Z`).join(' ');
  const labels = rings.map(points => points.map((point, index) => {
    const next = points[(index + 1) % points.length], a = transform(point), b = transform(next);
    const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
    return `<text x="${((a[0] + b[0]) / 2).toFixed(2)}" y="${((a[1] + b[1]) / 2 - 7).toFixed(2)}" text-anchor="middle" font-size="10" fill="#475569">${number(length)} м</text>`;
  }).join('')).join('');
  const area = Math.max(0, polygonArea(points) - holes.reduce((sum, hole) => sum + polygonArea(hole), 0));
  const perimeter = rings.reduce((sum, points) => sum + points.reduce((length, point, index) => {
    const next = points[(index + 1) % points.length];
    return length + Math.hypot(next[0] - point[0], next[1] - point[1]);
  }, 0), 0);
  return `<div class="estimate-drawing no-split"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 312" role="img" aria-label="${escape(`Чертёж: ${room.name || 'Помещение'}`)}"><path d="${path}" fill="#e7effd" fill-rule="evenodd" stroke="#1461ee" stroke-width="1.6" stroke-linejoin="round"/>${labels}</svg><p>Площадь ${number(area)} м² · Периметр ${number(perimeter)} м.п.</p></div>`;
}

const CSS = `
.estimate-document{box-sizing:border-box;width:768px;padding:30px;background:#fff;color:#15202e;font:13px/1.45 Arial,sans-serif}
.estimate-document *{box-sizing:border-box}.estimate-document h1,.estimate-document h2,.estimate-document h3,.estimate-document p{margin:0}
.estimate-document .estimate-header{border-bottom:2px solid #15202e;padding-bottom:18px;margin-bottom:20px}
.estimate-document h1{font-size:24px;margin:0 0 6px}.estimate-document .estimate-meta{font-size:12px;color:#647184;margin-top:4px}
.estimate-document h2{font-size:17px;margin:22px 0 10px}.estimate-document h3{font-size:14px;margin:15px 0 8px}
.estimate-document table{width:100%;border-collapse:collapse;table-layout:auto}.estimate-document th{background:#f2f4f8;text-align:left;font-size:11px;font-weight:700;padding:8px}
.estimate-document td{border-bottom:1px solid #e8ebef;padding:9px 8px;vertical-align:top}.estimate-document th.r,.estimate-document td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.estimate-document .estimate-section-total,.estimate-document .estimate-room-total{display:flex;justify-content:space-between;gap:16px;font-weight:700;padding:9px 0;font-variant-numeric:tabular-nums}
.estimate-document .estimate-empty{font-size:12px;color:#647184;padding:8px 0}.estimate-document .estimate-summary{border-top:2px solid #15202e;margin-top:24px;padding-top:12px}
.estimate-document .estimate-summary-row{display:flex;justify-content:space-between;gap:20px;margin:7px 0;font-variant-numeric:tabular-nums}
.estimate-document .estimate-grand{font-size:21px;font-weight:700;margin-top:14px}.estimate-document .estimate-drawing svg{display:block;width:100%;height:auto}
.estimate-document .estimate-drawing p{text-align:center;font-size:11px;color:#647184}.estimate-document .estimate-room{border-top:1px solid #dce1e9;margin-top:24px}
.estimate-document .no-split,.estimate-document tr{break-inside:avoid;page-break-inside:avoid}.estimate-document.compact td{padding:5px 7px;font-size:11px}.estimate-document.compact th{padding:5px 7px}
`;

function sectionHtml(section, label, total, rows, columns) {
  const headings = columns.map(([id, label]) => `<th${['qty', 'price', 'total'].includes(id) ? ' class="r"' : ''}>${label}</th>`).join('');
  const body = rows.map((line, index) => {
    const values = { num: index + 1, name: line.n || line.name || '', qty: line.exportQuantity, unit: line.u || line.unit || '', price: line.exportPrice, total: number(line.exportTotal) };
    return `<tr>${columns.map(([id]) => `<td${['qty', 'price', 'total'].includes(id) ? ' class="r"' : ''}>${escape(values[id])}</td>`).join('')}</tr>`;
  }).join('');
  return `<section data-estimate-section="${section}"><h3 class="no-split">${label}</h3>${rows.length ? `<table><thead><tr>${headings}</tr></thead><tbody>${body}</tbody></table>` : '<p class="estimate-empty">Нет позиций</p>'}<div class="estimate-section-total no-split"><span>Итого ${label.toLocaleLowerCase('ru-RU')}</span><span>${money(total)}</span></div></section>`;
}

export function estimateHtml({ project = {}, est = {}, adjustment, showAdjustment = true, cols, type = 'total', rooms = [] } = {}) {
  const prepared = prepareEstimateExport(est, adjustment, showAdjustment);
  const activeRooms = Array.isArray(rooms) ? rooms.filter(room => room.on !== false) : [];
  let columns = COLUMNS.filter(([id]) => cols?.[id] !== false);
  if (!columns.length) columns = COLUMNS.filter(([id]) => id === 'name');
  const presentCategories = group => CATEGORIES.filter(([key]) => key !== 'equipment' || group.equipment?.length);
  const renderSections = group => presentCategories(group).map(([key, label, total]) => sectionHtml(key, label, group[total], group[key] || [], columns)).join('');
  const byRoom = type === 'rooms' || type === 'room';
  const hasAdjustment = showAdjustment && prepared.totals.percent !== 0;
  let content = '';
  if (byRoom) {
    const groups = partitionEstimateExport(prepared, activeRooms);
    content = groups.map(group => `<section class="estimate-room"><h2 class="no-split">${escape(group.name)}</h2>${renderSections(group)}<div class="estimate-room-total no-split"><span>Итого по помещению${hasAdjustment ? ' без корректировки' : ''}</span><span>${money(group.materialsTotal + group.worksTotal + group.equipmentTotal)}</span></div></section>`).join('');
    if (!groups.length) content = renderSections(prepared);
  } else {
    content = renderSections(prepared);
  }
  const summary = presentCategories(prepared).map(([, label, total]) => `<div class="estimate-summary-row"><span>${label}</span><span>${money(prepared[total])}</span></div>`).join('');
  const correction = hasAdjustment ? `<div class="estimate-summary-row"><span>До ${prepared.totals.percent > 0 ? 'наценки' : 'скидки'}</span><span>${money(prepared.totals.baseTotal)}</span></div><div class="estimate-summary-row" data-estimate-adjustment><span>${escape(adjustmentLabel(adjustment))}</span><span>${prepared.totals.adjustmentAmount > 0 ? '+' : prepared.totals.adjustmentAmount < 0 ? '−' : ''}${money(Math.abs(prepared.totals.adjustmentAmount))}</span></div>` : '';
  const drawings = type === 'draw' ? `<section><h2 class="no-split">Чертежи помещений</h2>${activeRooms.length ? activeRooms.map(room => `<div class="no-split"><h3>${escape(room.name || 'Помещение')}</h3>${roomDrawingHtml(room)}</div>`).join('') : '<p class="estimate-empty">Помещения не добавлены</p>'}</section>` : '';
  return `<article class="estimate-document${type === 'compact' ? ' compact' : ''}"><style>${CSS}</style><header class="estimate-header no-split"><h1>Смета</h1><strong>${escape(project.name || 'Проект')}</strong>${project.client ? `<p class="estimate-meta">Заказчик: ${escape(project.client)}</p>` : ''}${project.address ? `<p class="estimate-meta">Адрес: ${escape(project.address)}</p>` : ''}<p class="estimate-meta">${byRoom ? 'По помещениям' : type === 'draw' ? 'Общая смета и чертежи' : 'Общая смета'} · ${activeRooms.length} пом.</p></header>${content}<footer class="estimate-summary no-split">${summary}${correction}<div class="estimate-summary-row estimate-grand"><span>Итого к оплате</span><span data-estimate-grand-total>${money(prepared.totals.adjustedTotal)}</span></div></footer>${drawings}</article>`;
}
