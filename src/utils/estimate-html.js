import { adjustmentLabel } from './estimate-adjustment.js';
import { partitionEstimateExport, prepareEstimateExport } from './estimate-export.js';
import { ESTIMATE_DRAWING_CSS, roomDrawingHtml } from './estimate-drawing.js';

export { roomDrawingHtml } from './estimate-drawing.js';

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

const CSS = `
.estimate-document{box-sizing:border-box;width:768px;padding:40px;background:#fff;color:#202532;font:12px/1.45 Arial,sans-serif}
.estimate-document *{box-sizing:border-box}.estimate-document h1,.estimate-document h2,.estimate-document h3,.estimate-document p{margin:0}
.estimate-document .estimate-header{display:grid;grid-template-columns:minmax(0,1.48fr) minmax(0,1fr);gap:14px;align-items:stretch;margin-bottom:40px}
.estimate-document .estimate-project-card,.estimate-document .estimate-company-card{min-width:0;min-height:156px;border-radius:14px;padding:16px;overflow-wrap:anywhere}
.estimate-document .estimate-project-card{background:#f8f8fd;border:1px solid #e4e6fb}
.estimate-document h1{font-size:18px;line-height:1.2;margin:0 0 12px}.estimate-document .estimate-project-data{display:grid;grid-template-columns:38% minmax(0,1fr);gap:4px 10px;margin:0;font-size:11px;line-height:1.4}
.estimate-document .estimate-project-data dt{color:#6d7484}.estimate-document .estimate-project-data dd{margin:0;font-weight:700;min-width:0}
.estimate-document .estimate-company-card{background:#121a2a;color:#fff;display:flex;flex-direction:column}
.estimate-document .estimate-company-brand{display:flex;align-items:center;gap:10px;min-width:0}.estimate-document .estimate-company-name{font-size:19px;line-height:1.2;font-weight:700;color:#9586ff;overflow-wrap:anywhere}
.estimate-document .estimate-company-logo{display:block;width:42px;height:42px;object-fit:contain;flex-shrink:0}.estimate-document .estimate-company-description{font-size:14px;font-weight:700;line-height:1.3;margin-top:5px;white-space:pre-line}
.estimate-document .estimate-company-details{font-size:10px;line-height:1.45;padding-top:26px;margin-top:auto;white-space:pre-line}.estimate-document .estimate-company-details p+p{margin-top:3px}.estimate-document .estimate-company-empty{font-size:11px;line-height:1.45;color:#d5d9e4;margin-top:12px}
.estimate-document h2{font-size:17px;margin:22px 0 10px}.estimate-document h3{font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:28px 0 8px}
.estimate-document table{width:100%;border-collapse:collapse;table-layout:auto}.estimate-document th{background:#202532;color:#fff;text-align:left;font-size:10px;font-weight:700;padding:9px 8px}
.estimate-document td{border-bottom:1px solid #eceef3;padding:8px;vertical-align:middle;font-size:11px;overflow-wrap:anywhere}.estimate-document th.r,.estimate-document td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.estimate-document th.estimate-row-number,.estimate-document td.estimate-row-number{width:1%;min-width:30px;white-space:nowrap;overflow-wrap:normal;word-break:normal;font-variant-numeric:tabular-nums}
.estimate-document th.estimate-unit,.estimate-document td.estimate-unit{width:1%;min-width:36px;white-space:nowrap;overflow-wrap:normal;word-break:normal}
.estimate-document .estimate-item-name{display:flex;align-items:center;gap:9px;min-width:0}.estimate-document .estimate-item-photo{display:block;width:38px;height:38px;object-fit:contain;border-radius:5px;flex-shrink:0}.estimate-document .estimate-item-name span{min-width:0}
.estimate-document .estimate-section-total,.estimate-document .estimate-room-total{display:flex;justify-content:flex-end;gap:20px;font-weight:700;padding:9px 10px;font-variant-numeric:tabular-nums;background:#f7f8fc;border-top:1px solid #202532}
.estimate-document .estimate-room-total{margin-top:16px}.estimate-document .estimate-empty{font-size:12px;color:#647184;padding:8px 0}.estimate-document .estimate-summary{border-top:2px solid #202532;margin-top:28px;padding-top:12px}
.estimate-document .estimate-summary-row{display:flex;justify-content:space-between;gap:20px;margin:7px 0;font-variant-numeric:tabular-nums}
.estimate-document .estimate-grand{font-size:21px;font-weight:700;margin-top:14px}
.estimate-document .estimate-rounding-note{font-size:10px;color:#647184;margin-top:12px}
.estimate-document .estimate-room{margin-top:24px;padding-top:12px}.estimate-document .estimate-room>.estimate-drawing{margin-bottom:22px}
.estimate-document .estimate-drawings{margin-top:32px;padding-top:12px}.estimate-document .estimate-drawings-heading{text-align:center;color:#203e60;margin-bottom:18px}
.estimate-document .estimate-drawings-heading h2{margin:0 0 5px;font-size:18px;letter-spacing:1px;text-transform:uppercase}.estimate-document .estimate-drawings-heading p{font-size:11px;color:#6d7484}
.estimate-document .estimate-drawing-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;align-items:stretch}
.estimate-document [data-pdf-break-before]{break-before:page;page-break-before:always}
.estimate-document .no-split,.estimate-document tr{break-inside:avoid;page-break-inside:avoid}.estimate-document thead{display:table-header-group}.estimate-document.compact td{padding:5px 7px;font-size:11px}.estimate-document.compact th{padding:5px 7px}.estimate-document.compact .estimate-item-photo{width:28px;height:28px}
${ESTIMATE_DRAWING_CSS}
`;

function safeImage(value) {
  if (typeof value !== 'string') return '';
  if (/^data:image\/(?:png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value)) return value;
  if (!value.startsWith('/design/nom/')) return '';
  try {
    const filename = decodeURIComponent(value.slice('/design/nom/'.length));
    if (!filename || /[/\\<>\u0000-\u001f?#]/.test(filename) || !/\.(?:png|jpe?g|gif|webp|avif)$/i.test(filename)) return '';
    return `/design/nom/${encodeURIComponent(filename)}`;
  } catch { return ''; }
}

function projectArea(project, rooms) {
  const measured = rooms.filter(room => ring(room.v).length || Number.isFinite(room.area));
  if (!measured.length) return Number.isFinite(project.area) ? Math.max(0, project.area) : 0;
  return measured.reduce((sum, room) => {
    const points = ring(room.v);
    if (!points.length) return sum + Math.max(0, room.area);
    const holes = (Array.isArray(room.holes) ? room.holes : []).map(ring).filter(points => points.length);
    return sum + Math.max(0, polygonArea(points) - holes.reduce((area, hole) => area + polygonArea(hole), 0));
  }, 0);
}

function headerHtml(project, company, rooms, type) {
  const label = { total: 'Общая', compact: 'Компактная', rooms: 'По помещениям', room: 'По помещениям', draw: 'Общая + чертежи' }[type] || 'Общая';
  const projectRows = [['Название', project.name || 'Проект'], ['Заказчик', project.client || '—'], ['Тип сметы', label], ['Помещений', rooms.length], ['Площадь', `${number(projectArea(project, rooms))} м²`]];
  if (project.address) projectRows.push(['Адрес', project.address]);
  if (project.phone) projectRows.push(['Телефон', project.phone]);
  const profile = company && typeof company === 'object' ? company : {};
  const logo = safeImage(profile.logo);
  const details = [profile.legal, profile.inn && `ИНН ${profile.inn}`, profile.ogrn && `ОГРН / ОГРНИП ${profile.ogrn}`, profile.address, profile.phone && `Тел.: ${profile.phone}`, profile.email, profile.website].filter(Boolean);
  const hasCompany = logo || profile.company || profile.description || details.length;
  return `<header class="estimate-header no-split"><section class="estimate-project-card" data-estimate-project><h1>Данные проекта</h1><dl class="estimate-project-data">${projectRows.map(([key, value]) => `<dt>${key}</dt><dd>${escape(value)}</dd>`).join('')}</dl></section><section class="estimate-company-card" data-estimate-company><div class="estimate-company-brand">${logo ? `<img class="estimate-company-logo" src="${escape(logo)}" alt="Логотип компании"/>` : ''}<p class="estimate-company-name">${escape(profile.company || 'Компания')}</p></div>${profile.description ? `<p class="estimate-company-description">${escape(profile.description)}</p>` : ''}${details.length ? `<div class="estimate-company-details">${details.map(value => `<p>${escape(value)}</p>`).join('')}</div>` : ''}${!hasCompany ? '<p class="estimate-company-empty">Данные компании не заполнены</p>' : ''}</section></header>`;
}

function sectionHtml(section, label, total, rows, columns) {
  const cellClass = id => id === 'num' ? ' class="estimate-row-number"' : id === 'unit' ? ' class="estimate-unit"' : ['qty', 'price', 'total'].includes(id) ? ' class="r"' : '';
  const headings = columns.map(([id, label]) => `<th${cellClass(id)}>${label}</th>`).join('');
  const body = rows.map((line, index) => {
    const values = { num: index + 1, name: line.n || line.name || '', qty: line.exportQuantity, unit: line.u || line.unit || '', price: line.exportPrice, total: number(line.exportTotal) };
    const photo = safeImage(line.img);
    return `<tr>${columns.map(([id]) => `<td${cellClass(id)}>${id === 'name' && photo ? `<div class="estimate-item-name"><img class="estimate-item-photo" src="${escape(photo)}" alt=""/><span>${escape(values[id])}</span></div>` : escape(values[id])}</td>`).join('')}</tr>`;
  }).join('');
  return `<section data-estimate-section="${section}"><h3 class="no-split" data-pdf-keep-with-next>${label}</h3>${rows.length ? `<table><thead><tr>${headings}</tr></thead><tbody>${body}</tbody></table>` : '<p class="estimate-empty">Нет позиций</p>'}<div class="estimate-section-total no-split"><span>Итого ${label.toLocaleLowerCase('ru-RU')}</span><span>${money(total)}</span></div></section>`;
}

export function estimateHtml({ project = {}, company = {}, est = {}, adjustment, showAdjustment = true, cols, type = 'total', rooms = [] } = {}) {
  const prepared = prepareEstimateExport(est, adjustment, showAdjustment);
  const activeRooms = Array.isArray(rooms) ? rooms.filter(room => room.on !== false) : [];
  let columns = COLUMNS.filter(([id]) => cols?.[id] !== false);
  if (!columns.length) columns = COLUMNS.filter(([id]) => id === 'name');
  const presentCategories = group => CATEGORIES.filter(([key]) => key !== 'equipment' || group.equipment?.length);
  const renderSections = group => presentCategories(group).map(([key, label, total]) => sectionHtml(key, label, group[total], group[key] || [], columns)).join('');
  const byRoom = type === 'rooms' || type === 'room';
  const hasAdjustment = showAdjustment && prepared.totals.percent !== 0;
  const hasRoundedQuantity = group => CATEGORIES.some(([key]) => (group[key] || []).some(line => line.exportQuantityRounded));
  let quantityRounded = hasRoundedQuantity(prepared);
  let content = '';
  if (byRoom) {
    const groups = partitionEstimateExport(prepared, activeRooms);
    if (groups.length) quantityRounded = groups.some(hasRoundedQuantity);
    content = groups.map((group, index) => `<section class="estimate-room" data-estimate-room="${escape(group.id)}"${index ? ' data-pdf-break-before' : ''}>${group.room ? roomDrawingHtml(group.room) : `<h2 class="no-split">${escape(group.name)}</h2>`}${renderSections(group)}<div class="estimate-room-total no-split"><span>Итого по помещению${hasAdjustment ? ' без корректировки' : ''}</span><span>${money(group.materialsTotal + group.worksTotal + group.equipmentTotal)}</span></div></section>`).join('');
    if (!groups.length) content = renderSections(prepared);
  } else {
    content = renderSections(prepared);
  }
  const summary = presentCategories(prepared).map(([, label, total]) => `<div class="estimate-summary-row"><span>${label}</span><span>${money(prepared[total])}</span></div>`).join('');
  const correction = hasAdjustment ? `<div class="estimate-summary-row"><span>До ${prepared.totals.percent > 0 ? 'наценки' : 'скидки'}</span><span>${money(prepared.totals.baseTotal)}</span></div><div class="estimate-summary-row" data-estimate-adjustment><span>${escape(adjustmentLabel(adjustment))}</span><span>${prepared.totals.adjustmentAmount > 0 ? '+' : prepared.totals.adjustmentAmount < 0 ? '−' : ''}${money(Math.abs(prepared.totals.adjustmentAmount))}</span></div>` : '';
  const roundingNote = quantityRounded && columns.some(([id]) => id === 'qty')
    ? '<p class="estimate-rounding-note">Количество округлено до 2 знаков. Суммы рассчитаны по точным значениям.</p>' : '';
  const drawingPairs = [];
  if (type === 'draw') for (let i = 0; i < activeRooms.length; i += 2) {
    drawingPairs.push(`<div class="estimate-drawing-pair no-split"${i + 2 >= activeRooms.length ? ' data-pdf-content-end' : ''}>${activeRooms.slice(i, i + 2).map(room => roomDrawingHtml(room, { compact: true })).join('')}</div>`);
  }
  const drawings = type === 'draw' ? `<section class="estimate-drawings" data-pdf-break-before><div class="estimate-drawings-heading no-split"><h2>Чертежи помещений</h2><p>Контуры потолков по результатам замера · размеры в сантиметрах</p></div>${drawingPairs.length ? drawingPairs.join('') : '<p class="estimate-empty" data-pdf-content-end>Помещения не добавлены</p>'}</section>` : '';
  return `<article class="estimate-document${type === 'compact' ? ' compact' : ''}"><style>${CSS}</style>${headerHtml(project, company, activeRooms, type)}${content}<footer class="estimate-summary no-split" data-pdf-content-end>${summary}${correction}<div class="estimate-summary-row estimate-grand"><span>Итого к оплате</span><span data-estimate-grand-total>${money(prepared.totals.adjustedTotal)}</span></div>${roundingNote}</footer>${drawings}</article>`;
}
