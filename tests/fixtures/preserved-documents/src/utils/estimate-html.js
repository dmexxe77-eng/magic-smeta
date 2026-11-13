import { normalizeEstimateTemplate, estimateHeaderInk, estimateTemplateVariables, estimatePresetId } from './estimate-template.js';
import { adjustmentLabel } from './estimate-adjustment.js';
import { partitionEstimateExport, prepareEstimateExport } from './estimate-export.js';
import { ESTIMATE_DRAWING_CSS, roomDrawingHtml } from './estimate-drawing.js';

export { roomDrawingHtml } from './estimate-drawing.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => (Number.isFinite(value) ? value : 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const money = value => `${number(value)} ₽`;
const CATEGORIES = [['mats', 'Материалы', 'materialsTotal'], ['works', 'Работы', 'worksTotal'], ['equipment', 'Оборудование', 'equipmentTotal']];
const COLUMNS = [['num', '№'], ['photo', 'Фото'], ['name', 'Наименование'], ['qty', 'Кол-во'], ['unit', 'Ед.'], ['price', 'Цена, ₽'], ['total', 'Сумма, ₽']];
const ring = points => Array.isArray(points) && points.length >= 3 && points.every(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])) ? points : [];
const polygonArea = points => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0)) / 2;

const CSS = `
.estimate-document{box-sizing:border-box;width:720px;padding:24px;border:1px solid var(--estimate-frame-color,#1A3A5C);background:#fff;color:#1c1c1c;font:12px/1.5 'Liberation Serif','Times New Roman',Georgia,serif}
.estimate-document *{box-sizing:border-box}.estimate-document h1,.estimate-document h2,.estimate-document h3,.estimate-document p{margin:0}
.estimate-document .estimate-header{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:stretch;margin-bottom:22px}
.estimate-document .estimate-project-card,.estimate-document .estimate-company-card{min-width:0;border-radius:7px;padding:16px;overflow-wrap:anywhere}
.estimate-document .estimate-project-card{background:#fff;border:0}
.estimate-document h1{font-size:18px;line-height:1.25;color:var(--estimate-section-color,#1A3A5C);text-align:center;margin:0 0 12px}.estimate-document .estimate-project-caption{font-size:10px;color:#6d7484;margin-bottom:8px}.estimate-document .estimate-project-data{display:grid;grid-template-columns:28% minmax(0,1fr);gap:4px 10px;margin:0;font-size:11px;line-height:1.4}
.estimate-document .estimate-project-data dt{color:#6d7484}.estimate-document .estimate-project-data dd{margin:0;font-weight:700;min-width:0;overflow-wrap:anywhere}
.estimate-document .estimate-company-card{background:#1A3A5C;color:#fff;display:flex;flex-direction:column}
.estimate-document .estimate-company-brand{display:flex;align-items:center;gap:12px;min-width:0}.estimate-document .estimate-company-name{font-size:19px;line-height:1.2;font-weight:700;color:#fff;overflow-wrap:anywhere}
.estimate-document .estimate-company-logo{display:block;width:42px;height:42px;object-fit:contain;flex-shrink:0}.estimate-document .estimate-company-description{font-size:12px;font-weight:700;line-height:1.35;margin-top:6px;white-space:pre-line}
.estimate-document .estimate-company-contact{font-size:10px;line-height:1.45;margin-top:7px;white-space:pre-line}.estimate-document .estimate-company-details{font-size:10px;line-height:1.45;padding-top:9px;margin-top:9px;border-top:1px solid currentColor;white-space:pre-line}.estimate-document .estimate-company-empty{font-size:11px;line-height:1.45;margin-top:10px}
.estimate-document h2{font-size:16px;color:var(--estimate-section-color,#1A3A5C);margin:20px 0 10px}.estimate-document h3{font-size:12px;letter-spacing:.4px;text-transform:uppercase;margin:22px 0 7px}
.estimate-document table{width:100%;border-collapse:collapse;table-layout:auto}.estimate-document th{background:#1A3A5C;color:#fff;text-align:left;font-size:10px;font-weight:700;padding:6px 8px;border:1px solid #cbd3dc}
.estimate-document td{border:1px solid #d9dee5;padding:5px 8px;vertical-align:middle;font-size:11px;overflow-wrap:anywhere}.estimate-document th.r,.estimate-document td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.estimate-document th.estimate-row-number,.estimate-document td.estimate-row-number{width:1%;min-width:30px;white-space:nowrap;overflow-wrap:normal;word-break:normal;font-variant-numeric:tabular-nums}
.estimate-document th.estimate-unit,.estimate-document td.estimate-unit{width:1%;min-width:36px;white-space:nowrap;overflow-wrap:normal;word-break:normal}
.estimate-document .estimate-item-name{display:flex;align-items:center;gap:9px;min-width:0}.estimate-document .estimate-item-photo{display:block;width:38px;height:38px;object-fit:contain;border-radius:5px;flex-shrink:0}.estimate-document .estimate-item-name span{min-width:0}
.estimate-document .estimate-section-total,.estimate-document .estimate-room-total{display:flex;justify-content:flex-end;gap:20px;font-weight:700;padding:8px 10px;font-variant-numeric:tabular-nums;background:#f1f4f7;border-top:1px solid var(--estimate-section-color,#1A3A5C)}
.estimate-document .estimate-section-base,.estimate-document .estimate-section-adjustment{display:flex;justify-content:flex-end;gap:20px;padding:6px 10px;font-variant-numeric:tabular-nums}.estimate-document .estimate-section-base{color:#647184}.estimate-document .estimate-section-adjustment{font-weight:700}.estimate-document .estimate-room-total{margin-top:16px}.estimate-document .estimate-empty{font-size:12px;color:#647184;padding:8px 0}.estimate-document .estimate-summary{border-top:2px solid var(--estimate-section-color,#1A3A5C);margin-top:22px;padding-top:10px}
.estimate-document .estimate-summary-row{display:flex;justify-content:space-between;gap:20px;margin:7px 0;font-variant-numeric:tabular-nums}
.estimate-document .estimate-grand{font-size:18px;color:var(--estimate-section-color,#1A3A5C);font-weight:700;margin-top:12px}.estimate-document .estimate-summary-row>span:last-child,.estimate-document .estimate-section-total>span:last-child,.estimate-document .estimate-room-total>span:last-child{white-space:nowrap}
.estimate-document .estimate-rounding-note{font-size:10px;color:#647184;margin-top:12px}
.estimate-document .estimate-room{margin-top:24px;padding-top:12px}.estimate-document .estimate-room>.estimate-drawing{margin-bottom:22px}
.estimate-document .estimate-drawings{margin-top:32px;padding-top:12px}.estimate-document .estimate-drawings-heading{text-align:center;color:#203e60;margin-bottom:18px}
.estimate-document .estimate-drawings-heading h2{margin:0 0 5px;font-size:18px;letter-spacing:1px;text-transform:uppercase}.estimate-document .estimate-drawings-heading p{font-size:11px;color:#6d7484}
.estimate-document .estimate-drawing-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;align-items:stretch}
.estimate-document [data-pdf-break-before]{break-before:page;page-break-before:always}
.contract-estimate-appendix>.estimate-document{width:100%;padding:12px 0;border:0;margin:0;font-family:inherit}
.estimate-document .no-split,.estimate-document tr{break-inside:avoid;page-break-inside:avoid}.estimate-document thead{display:table-header-group}.estimate-document.compact td{padding:5px 7px;font-size:11px}.estimate-document.compact th{padding:5px 7px}.estimate-document.compact .estimate-item-photo{width:28px;height:28px}
${ESTIMATE_DRAWING_CSS}
`;

const TEMPLATE_CSS = `
.estimate-document[data-estimate-template]{font-family:var(--estimate-font-family);font-size:var(--estimate-font-size)}
.estimate-document[data-estimate-template] .estimate-header{grid-template-columns:var(--estimate-header-columns)}
.estimate-document[data-estimate-template] .estimate-project-card,.estimate-document[data-estimate-template] .estimate-company-card{min-height:var(--estimate-header-height);padding:var(--estimate-header-padding);border-radius:var(--estimate-header-radius)}
.estimate-document[data-estimate-template] .estimate-project-card{background:var(--estimate-project-bg);color:var(--estimate-project-ink);order:var(--estimate-project-order)}
.estimate-document[data-estimate-template] .estimate-project-data dt{color:inherit;opacity:.72}
.estimate-document[data-estimate-template] .estimate-company-card{order:var(--estimate-company-order)}
.estimate-document[data-estimate-template] h1{font-size:calc(var(--estimate-font-size) + 6px)}
.estimate-document[data-estimate-template] .estimate-project-data{font-size:calc(var(--estimate-font-size) - 1px)}
.estimate-document[data-estimate-template] .estimate-company-brand{flex-direction:var(--estimate-brand-direction);align-items:var(--estimate-brand-align)}
.estimate-document[data-estimate-template] .estimate-company-logo{width:var(--estimate-logo-size);height:var(--estimate-logo-size);order:var(--estimate-logo-order);max-width:100%}
.estimate-document[data-estimate-template] .estimate-company-name{font-size:var(--estimate-company-font-size)}
.estimate-document[data-estimate-template] .estimate-company-description{font-size:calc(var(--estimate-font-size) + 2px)}
.estimate-document[data-estimate-template] .estimate-company-details{font-size:calc(var(--estimate-font-size) - 2px)}
.estimate-document[data-estimate-template] h3{color:var(--estimate-section-color);font-size:var(--estimate-font-size)}
.estimate-document[data-estimate-template] th{background:var(--estimate-table-bg);color:var(--estimate-table-ink);font-size:calc(var(--estimate-font-size) - 2px);padding:calc(var(--estimate-row-padding) + 1px) 8px}
.estimate-document[data-estimate-template] td{font-size:calc(var(--estimate-font-size) - 1px);padding:var(--estimate-row-padding) 8px}
.estimate-document[data-estimate-template] tbody tr:nth-child(even){background:var(--estimate-stripe-bg)}
.estimate-document[data-estimate-template] .estimate-company-empty{color:inherit;opacity:.8}
.estimate-document[data-estimate-layout="stacked"] .estimate-project-card{min-height:0;padding:0;border-radius:0}
.estimate-document[data-estimate-layout="stacked"] .estimate-company-card{min-height:var(--estimate-stacked-company-height)}
`;

const FAMILY_CSS = `
.estimate-document[data-estimate-preset]{padding:20px;line-height:1.4}
.estimate-document[data-estimate-preset] .estimate-header{gap:12px;margin-bottom:12px}
.estimate-document[data-estimate-preset] .estimate-company-card{padding:12px 16px}
.estimate-document[data-estimate-preset] .estimate-company-name{font-size:18.5px;line-height:1.2}
.estimate-document[data-estimate-preset] .estimate-company-description{font-size:10px;font-weight:400;line-height:1.35;margin-top:4px}
.estimate-document[data-estimate-preset] .estimate-company-contact{font-size:10px;line-height:1.35;margin-top:4px}
.estimate-document[data-estimate-preset] .estimate-company-details{font-size:10px;line-height:1.35;margin-top:6px;padding-top:6px}
.estimate-document[data-estimate-preset] h1{font-size:16px;line-height:1.35;margin-bottom:10px}
.estimate-document[data-estimate-preset] h3{font-size:12px;line-height:1.4;letter-spacing:0;text-transform:none;margin:14px 0 5px;font-weight:700}
.estimate-document[data-estimate-preset="brand"] .estimate-company-metadata{color:#E1E8F0}
.estimate-document[data-estimate-preset="brand"] th{padding:4px 6px;border:0.5px solid #CCD3DD}
.estimate-document[data-estimate-preset="brand"] td{padding:3px 6px;border:0.5px solid #CCD3DD}
.estimate-document[data-estimate-preset="modern"] .estimate-company-card{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);align-items:center;gap:16px;border-left:4px solid #1461EE;border-radius:0;padding:12px 14px}
.estimate-document[data-estimate-preset="modern"] .estimate-company-card[data-company-details="false"]{grid-template-columns:minmax(0,1fr)}
.estimate-document[data-estimate-preset="modern"] .estimate-company-metadata{color:#55708F;text-align:right;min-width:0}
.estimate-document[data-estimate-preset="modern"] .estimate-company-metadata:empty{display:none}
.estimate-document[data-estimate-preset="modern"] .estimate-company-metadata .estimate-company-contact:first-child{margin-top:0}
.estimate-document[data-estimate-preset="modern"] .estimate-company-details{border-top:0;padding-top:0}
.estimate-document[data-estimate-preset="modern"] h1{font-size:17px;text-align:left;font-weight:750}
.estimate-document[data-estimate-preset="modern"] h3{padding:2px 7px;border-left:3px solid #1461EE;background:#F4F8FF;font-weight:750}
.estimate-document[data-estimate-preset="modern"] th{padding:5px 7px;border:0.5px solid #D9E4F3}
.estimate-document[data-estimate-preset="modern"] td{padding:3px 7px;border:0.5px solid #D9E4F3}
.estimate-document[data-estimate-preset="modern"] .estimate-section-total,.estimate-document[data-estimate-preset="modern"] .estimate-room-total{background:#F4F8FF;border-color:#D9E6FB;color:#164B9D}
`;

function safeImage(value) {
  if (typeof value !== 'string') return '';
  if (/^data:image\/(?:png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value)) return value;
  const directory = ['/design/nom/', '/online/nom/'].find(prefix => value.startsWith(prefix));
  if (!directory) return '';
  try {
    const filename = decodeURIComponent(value.slice(directory.length));
    if (!filename || /[/\\<>\u0000-\u001f?#]/.test(filename) || !/\.(?:png|jpe?g|gif|webp|avif)$/i.test(filename)) return '';
    return `${directory}${encodeURIComponent(filename)}`;
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

function headerHtml(project, company, rooms, type, template) {
  const appearance = normalizeEstimateTemplate(template);
  const ink = estimateHeaderInk(appearance.background);
  const label = { total: 'Общая', compact: 'Компактная', rooms: 'По помещениям', room: 'По помещениям', draw: 'Общая + чертежи' }[type] || 'Общая';
  const projectRows = [['Название', project.name || 'Проект'], ['Заказчик', project.client || '—'], ['Тип сметы', label], ['Помещений', rooms.length], ['Площадь', `${number(projectArea(project, rooms))} м²`]];
  if (project.address) projectRows.push(['Адрес', project.address]);
  if (project.phone) projectRows.push(['Телефон', project.phone]);
  const profile = company && typeof company === 'object' ? company : {};
  const logo = appearance.showLogo ? safeImage(profile.logo) : '';
  const companyAddress = appearance.showDetails ? profile.companyAddress || profile.address : '';
  const contacts = !appearance.showDetails ? [] : [profile.phone && `Тел.: ${profile.phone}`, profile.email, profile.website].filter(Boolean);
  const addressLabel = profile.legalForm === 'ip' ? 'Адрес регистрации' : profile.legalForm === 'self_employed' ? 'Адрес для документов' : 'Юридический адрес';
  const ogrnLabel = profile.legalForm === 'ip' ? 'ОГРНИП' : 'ОГРН / ОГРНИП';
  const details = !appearance.showDetails ? [] : [profile.legal, profile.inn && `ИНН ${profile.inn}`, profile.kpp && `КПП ${profile.kpp}`, profile.ogrn && `${ogrnLabel} ${profile.ogrn}`, profile.address && profile.address !== companyAddress && `${addressLabel}: ${profile.address}`].filter(Boolean);
  const hasCompany = logo || profile.company || profile.description || companyAddress || contacts.length || details.length;
  const metadata = `${companyAddress ? `<p class="estimate-company-contact" data-company-address>${escape(companyAddress)}</p>` : ''}${contacts.length ? `<p class="estimate-company-contact">${contacts.map(escape).join(' · ')}</p>` : ''}${details.length ? `<div class="estimate-company-details">${details.map(escape).join(' · ')}</div>` : ''}${!hasCompany ? '<p class="estimate-company-empty">Данные компании не заполнены</p>' : ''}`;
  const companyCard = `<section class="estimate-company-card" style="background:${appearance.background};color:${ink}" data-company-details="${!!metadata}" data-estimate-company><div class="estimate-company-identity"><div class="estimate-company-brand">${logo ? `<img class="estimate-company-logo" src="${escape(logo)}" alt="Логотип компании"/>` : ''}<p class="estimate-company-name" style="color:${appearance.accent}">${escape(profile.company || 'Компания')}</p></div>${profile.description ? `<p class="estimate-company-description">${escape(profile.description)}</p>` : ''}</div><div class="estimate-company-metadata">${metadata}</div></section>`;
  const projectCard = `<section class="estimate-project-card" data-estimate-project><h1>Смета</h1><p class="estimate-project-caption">Данные проекта</p><dl class="estimate-project-data">${projectRows.map(([key, value]) => `<dt>${key}</dt><dd>${escape(value)}</dd>`).join('')}</dl></section>`;
  return `<header class="estimate-header no-split">${appearance.layout === 'split' ? projectCard + companyCard : companyCard + projectCard}</header>`;
}

function sectionHtml(section, label, total, rows, columns, correction, appearance) {
  const cellClass = id => id === 'num' ? ' class="estimate-row-number"' : id === 'unit' ? ' class="estimate-unit"' : ['qty', 'price', 'total'].includes(id) ? ' class="r"' : '';
  const headings = columns.map(([id, label]) => `<th${cellClass(id)}>${label}</th>`).join('');
  const body = rows.map((line, index) => {
    const values = { num: index + 1, name: line.n || line.name || '', qty: line.exportQuantity, unit: line.u || line.unit || '', price: line.exportPrice, total: number(line.exportTotal) };
    const photo = appearance.showItemPhotos ? safeImage(line.img) : '';
    return `<tr>${columns.map(([id]) => `<td${cellClass(id)}>${id === 'photo' ? (photo ? `<img class="estimate-item-photo" src="${escape(photo)}" alt=""/>` : '—') : id === 'name' && photo && !columns.some(([key]) => key === 'photo') ? `<div class="estimate-item-name"><img class="estimate-item-photo" src="${escape(photo)}" alt=""/><span>${escape(values[id])}</span></div>` : escape(values[id])}</td>`).join('')}</tr>`;
  }).join('');
  const adjustmentRow = correction?.shown ? `<div class="estimate-section-adjustment" data-estimate-adjustment data-estimate-adjustment-scope="${section}"><span>${escape(adjustmentLabel(correction))}</span><span>${correction.amount > 0 ? '+' : correction.amount < 0 ? '−' : ''}${money(Math.abs(correction.amount))}</span></div>` : '';
  const baseRow = correction?.shown ? `<div class="estimate-section-base"><span>Без корректировки</span><span>${money(total)}</span></div>` : '';
  return `<section data-estimate-section="${section}"><h3 class="no-split" data-pdf-keep-with-next>${label}</h3>${rows.length ? `<table><thead><tr>${headings}</tr></thead><tbody>${body}</tbody></table>` : '<p class="estimate-empty">Нет позиций</p>'}<div class="no-split" data-pdf-keep-with-previous>${baseRow}${adjustmentRow}<div class="estimate-section-total"><span>Итого ${label.toLocaleLowerCase('ru-RU')}</span><span>${money(correction?.adjustedTotal ?? total)}</span></div></div></section>`;
}

export function estimateHtml({ project = {}, company = {}, est = {}, adjustment, showAdjustment = true, template, cols, type = 'total', rooms = [] } = {}) {
  const appearance = normalizeEstimateTemplate(template ?? company?.estimateTemplate);
  if (cols?.photo === false) appearance.showItemPhotos = false;
  const grouped = typeof showAdjustment === 'object' && showAdjustment !== null;
  const prepared = prepareEstimateExport(est, adjustment, showAdjustment);
  const activeRooms = Array.isArray(rooms) ? rooms.filter(room => room.on !== false) : [];
  let columns = COLUMNS.filter(([id]) => id === 'photo' ? cols?.photo === true : cols?.[id] !== false);
  if (!columns.length) columns = COLUMNS.filter(([id]) => id === 'name');
  const presentCategories = group => CATEGORIES.filter(([key]) => key !== 'equipment' || group.equipment?.length);
  const renderSections = group => presentCategories(group).map(([key, label, total]) => sectionHtml(key, label, group[total], group[key] || [], columns, grouped ? group.categoryAdjustments?.[key] : null, appearance)).join('');
  const byRoom = type === 'rooms' || type === 'room';
  const hasAdjustment = !grouped && showAdjustment && prepared.totals.hasAdjustment;
  const hasRoundedQuantity = group => CATEGORIES.some(([key]) => (group[key] || []).some(line => line.exportQuantityRounded));
  let quantityRounded = hasRoundedQuantity(prepared);
  let content = '';
  if (byRoom) {
    const groups = partitionEstimateExport(prepared, activeRooms);
    if (groups.length) quantityRounded = groups.some(hasRoundedQuantity);
    content = groups.map((group, index) => `<section class="estimate-room" data-estimate-room="${escape(group.id)}"${index ? ' data-pdf-break-before' : ''}>${group.room ? roomDrawingHtml(group.room) : `<h2 class="no-split">${escape(group.name)}</h2>`}${renderSections(group)}<div class="estimate-room-total no-split" data-pdf-keep-with-previous><span>Итого по помещению${hasAdjustment ? ' без корректировки' : ''}</span><span>${money(grouped ? Object.values(group.categoryAdjustments || {}).reduce((sum, entry) => sum + entry.adjustedTotal, 0) : group.materialsTotal + group.worksTotal + group.equipmentTotal)}</span></div></section>`).join('');
    if (!groups.length) content = renderSections(prepared);
  } else {
    content = renderSections(prepared);
  }
  const summary = presentCategories(prepared).map(([key, label, total]) => `<div class="estimate-summary-row"><span>${label}</span><span>${money(grouped ? prepared.categoryAdjustments[key].adjustedTotal : prepared[total])}</span></div>`).join('');
  const correction = hasAdjustment ? `<div class="estimate-summary-row"><span>Без корректировки</span><span>${money(prepared.totals.baseTotal)}</span></div>` + prepared.totals.adjustments.map(entry => `<div class="estimate-summary-row" data-estimate-adjustment><span>${escape(adjustmentLabel(entry))}</span><span>${entry.amount > 0 ? '+' : entry.amount < 0 ? '−' : ''}${money(Math.abs(entry.amount))}</span></div>`).join('') : '';
  const roundingNote = quantityRounded && columns.some(([id]) => id === 'qty')
    ? '<p class="estimate-rounding-note">Количество округлено до 2 знаков. Суммы рассчитаны по точным значениям.</p>' : '';
  const drawingPairs = [];
  if (type === 'draw') for (let i = 0; i < activeRooms.length; i += 2) {
    drawingPairs.push(`<div class="estimate-drawing-pair no-split"${i + 2 >= activeRooms.length ? ' data-pdf-content-end' : ''}>${activeRooms.slice(i, i + 2).map(room => roomDrawingHtml(room, { compact: true })).join('')}</div>`);
  }
  const drawings = type === 'draw' ? `<section class="estimate-drawings" data-pdf-break-before><div class="estimate-drawings-heading no-split"><h2>Чертежи помещений</h2><p>Контуры потолков по результатам замера · размеры в сантиметрах</p></div>${drawingPairs.length ? drawingPairs.join('') : '<p class="estimate-empty" data-pdf-content-end>Помещения не добавлены</p>'}</section>` : '';
  const preset = estimatePresetId(appearance);
  const appearanceAttributes = ` data-estimate-template data-estimate-layout="${appearance.layout}"${preset ? ` data-estimate-preset="${preset}"` : ''} data-pdf-content-end style="${escape(estimateTemplateVariables(appearance))}"`;
  return `<article class="estimate-document${type === 'compact' ? ' compact' : ''}"${appearanceAttributes}><style>${CSS}${TEMPLATE_CSS}${FAMILY_CSS}</style>${headerHtml(project, company, activeRooms, type, appearance)}${content}<footer class="estimate-summary no-split" data-pdf-content-end data-pdf-keep-with-previous>${summary}${correction}<div class="estimate-summary-row estimate-grand"><span>Итого к оплате</span><span data-estimate-grand-total>${money(prepared.totals.adjustedTotal)}</span></div>${roundingNote}</footer>${drawings}</article>`;
}
