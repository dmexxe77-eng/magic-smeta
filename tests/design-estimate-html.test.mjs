import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateHtml, roomDrawingHtml } from '../src/utils/estimate-html.js';

const est = {
  mats: [{ k: 'canvas', n: 'Полотно', q: 2, p: 100, u: 'м²' }],
  works: [{ k: 'install', n: 'Монтаж', q: 3, p: 50, u: 'м²' }],
  equipment: [{ k: 'driver', n: 'Блок питания', q: 1, p: 75, u: 'шт' }],
};
const clean = html => html.replace(/\u00a0/g, ' ');

test('estimate export has materials, works and equipment sections with one grand total', () => {
  const html = clean(estimateHtml({ project: { name: 'Дом' }, est, adjustment: { percent: 10, scope: 'works' } }));
  for (const section of ['mats', 'works', 'equipment']) assert.ok(html.includes(`data-estimate-section="${section}"`));
  assert.match(html, /Наценка на работы \+10%/);
  assert.match(html, /data-estimate-grand-total>440 ₽/);
  assert.match(html, />Блок питания</);
});

test('hidden adjustment changes targeted prices and preserves the displayed final amount', () => {
  const html = clean(estimateHtml({ est, adjustment: { percent: 10, scope: 'equipment' }, showAdjustment: false }));
  assert.doesNotMatch(html, /Наценка|Скидка|корректиров|data-estimate-adjustment/);
  assert.match(html, />82,5</);
  assert.match(html, /data-estimate-grand-total>432,5 ₽/);
  assert.match(html, />100</);
  assert.match(html, />50</);
});

test('export escapes project, customer and line text without executable markup', () => {
  const html = estimateHtml({ project: { name: '<img src=x onerror=alert(1)>', client: '"<script>x</script>', address: '& адрес' }, est: { mats: [{ n: '<svg onload=x>', u: '"<b>', q: 1, p: 1 }] } });
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
  assert.ok(html.includes('&lt;svg onload=x&gt;'));
  assert.doesNotMatch(html, /<img|<script|<svg onload/);
});

test('selected export columns apply to every section and all-off remains readable', () => {
  const html = estimateHtml({ est, cols: { price: false, qty: false, num: false, unit: false } });
  assert.doesNotMatch(html, /<th[^>]*>Цена|<th[^>]*>Кол-во|<th[^>]*>№|<th[^>]*>Ед\./);
  assert.equal((html.match(/<th>Наименование<\/th>/g) || []).length, 3);
  const minimal = estimateHtml({ est, cols: { price: false, qty: false, num: false, unit: false, name: false, total: false } });
  assert.match(minimal, /<th>Наименование<\/th>/);
});

test('row numbers and units use compact non-wrapping columns in every export layout', () => {
  const rows = Array.from({ length: 18 }, (_, i) => ({ k: `item-${i}`, n: `Длинное название материала ${i}`, q: 3.5, p: 1000, u: 'м.п.' }));
  for (const type of ['total', 'compact', 'rooms']) {
    const html = estimateHtml({ est: { mats: rows }, type });
    assert.match(html, /<th class="estimate-row-number">№<\/th>/);
    assert.match(html, /<td class="estimate-row-number">18<\/td>/);
    assert.match(html, /td\.estimate-row-number\{width:1%;min-width:30px;white-space:nowrap;overflow-wrap:normal;word-break:normal/);
    assert.match(html, /<th class="estimate-unit">Ед\.<\/th>/);
    assert.match(html, /<td class="estimate-unit">м\.п\.<\/td>/);
    assert.match(html, /td\.estimate-unit\{width:1%;min-width:36px;white-space:nowrap;overflow-wrap:normal;word-break:normal/);
    assert.match(html, /<td class="r">3,5<\/td>/);
  }
  const hidden = estimateHtml({ est: { mats: rows }, cols: { num: false, unit: false } });
  assert.doesNotMatch(hidden, /<(?:td|th) class="estimate-(?:row-number|unit)"/);
});

test('room export preserves globally edited quantities and one shared markup total', () => {
  const edited = { ...est, works: [{ ...est.works[0], q: 10 }] };
  const rooms = [{ id: 'a', name: 'Первая', est }, { id: 'b', name: 'Вторая', est }];
  const html = clean(estimateHtml({ est: edited, rooms, type: 'rooms', adjustment: { percent: 10, scope: 'works' }, showAdjustment: false }));
  assert.match(html, /Первая/);
  assert.match(html, /Вторая/);
  assert.match(html, /data-estimate-grand-total>825 ₽/);
  assert.equal((html.match(/data-estimate-grand-total/g) || []).length, 1);
  assert.equal((html.match(/>412,5 ₽<\/span>/g) || []).length, 2);
  assert.doesNotMatch(html, /Наценка|корректиров/);
});

test('draw option exports actual room contours, holes, measurements and room titles', () => {
  const room = { name: 'Кухня <1>', v: [[0, 0], [4, 0], [4, 3], [0, 3]], holes: [[[1, 1], [2, 1], [2, 2], [1, 2]]] };
  const drawing = roomDrawingHtml(room);
  assert.match(drawing, /<svg/);
  assert.match(drawing, /fill-rule="evenodd"/);
  assert.match(drawing, /11 м²/);
  assert.match(drawing, /P = 18 м/);
  assert.match(drawing, />400<\/text>/);
  const html = estimateHtml({ est, type: 'draw', rooms: [room] });
  assert.match(html, /Чертежи помещений/);
  assert.match(html, /Кухня &lt;1&gt;/);
  assert.doesNotMatch(estimateHtml({ est, type: 'total', rooms: [room] }), /<svg/);
});

test('rounded quantities explain exact sums only when the quantity column is visible', () => {
  const options = {
    est: { works: [{ k: 'protection', n: 'Защита стен', q: 136.79, p: 365 }] },
    rooms: [
      { id: 'a', est: { works: [{ k: 'protection', q: 41.19 }] } },
      { id: 'b', est: { works: [{ k: 'protection', q: 95.61 }] } },
    ],
    type: 'rooms',
  };
  const html = clean(estimateHtml(options));
  assert.match(html, />41,19<\/td>/);
  assert.match(html, /Суммы рассчитаны по точным значениям/);
  assert.match(html, /data-estimate-grand-total>49 928,35 ₽/);
  assert.doesNotMatch(html, /41,186989/);
  assert.doesNotMatch(estimateHtml({ ...options, cols: { qty: false } }), /Суммы рассчитаны по точным значениям/);
  const tailOnly = estimateHtml({ est: { mats: [{ q: 35.900000000000006, p: 620 }] } });
  assert.match(tailOnly, />35,9<\/td>/);
  assert.doesNotMatch(tailOnly, /Суммы рассчитаны по точным значениям/);
});

test('drawing appendix pairs active room plans on a new PDF page without changing totals', () => {
  const rooms = Array.from({ length: 5 }, (_, index) => ({ id: index, name: `План ${index}`, v: [[0, 0], [4, 0], [4, 3], [0, 3]], est }));
  const options = { est, rooms: [...rooms, { ...rooms[0], name: 'Отключённое', on: false }], adjustment: { percent: 10, scope: 'works' }, showAdjustment: false };
  const html = estimateHtml({ ...options, type: 'draw' });
  assert.match(html, /<section class="estimate-drawings" data-pdf-break-before>/);
  assert.equal((html.match(/class="estimate-drawing-pair no-split"/g) || []).length, 3);
  assert.equal((html.match(/class="estimate-drawing-pair no-split" data-pdf-content-end/g) || []).length, 1);
  assert.equal((html.match(/aria-label="Чертёж: План/g) || []).length, 5);
  assert.doesNotMatch(html, /Отключённое/);
  assert.match(html, /размеры в сантиметрах/);
  assert.equal(html.match(/data-estimate-grand-total>([^<]+)/)[1], estimateHtml({ ...options, type: 'total' }).match(/data-estimate-grand-total>([^<]+)/)[1]);
});

test('each room calculation includes its own plan before the table, with no plan for common rows', () => {
  const rooms = [
    { id: 'wide', name: 'Одинаковое имя', v: [[0, 0], [4, 0], [4, 3], [0, 3]], est },
    { id: 'narrow', name: 'Одинаковое имя', v: [[0, 0], [2, 0], [2, 1], [0, 1]], est },
  ];
  const options = { est: { ...est, mats: [...est.mats, { k: 'common', n: 'Общая доставка', q: 1, p: 10 }] }, rooms };
  for (const type of ['rooms', 'room']) {
    const html = estimateHtml({ ...options, type });
    const wide = html.slice(html.indexOf('data-estimate-room="wide"'), html.indexOf('data-estimate-room="narrow"'));
    const narrow = html.slice(html.indexOf('data-estimate-room="narrow"'), html.indexOf('data-estimate-room="unassigned"'));
    const common = html.slice(html.indexOf('data-estimate-room="unassigned"'));
    assert.match(wide, /12 м²/);
    assert.match(narrow, /2 м²/);
    assert.ok(wide.indexOf('<svg') < wide.indexOf('<table'));
    assert.ok(narrow.indexOf('<svg') < narrow.indexOf('<table'));
    assert.match(html, /data-estimate-room="narrow" data-pdf-break-before/);
    assert.match(common, /Общие позиции/);
    assert.doesNotMatch(common, /<svg/);
    assert.equal((html.match(/data-estimate-grand-total/g) || []).length, 1);
    assert.match(html, /<footer class="estimate-summary no-split" data-pdf-content-end>/);
    assert.doesNotMatch(html, /class="estimate-drawings"/);
  }
});

test('empty equipment is omitted from sections and summary while material and work sections remain', () => {
  const html = estimateHtml({ est: { ...est, equipment: [] } });
  assert.doesNotMatch(html, /Оборудование|оборудование|data-estimate-section="equipment"/);
  assert.match(html, /data-estimate-section="mats"/);
  assert.match(html, /data-estimate-section="works"/);
  const empty = estimateHtml();
  assert.doesNotMatch(empty, /Оборудование|оборудование/);
});

test('zero-price equipment remains visible because its position exists', () => {
  const html = estimateHtml({ est: { ...est, equipment: [{ k: 'driver', n: 'Блок питания', q: 1, p: 0, u: 'шт' }] } });
  assert.match(html, /data-estimate-section="equipment"/);
  assert.match(html, />Блок питания</);
  assert.match(html, /<span>Оборудование<\/span><span>0 ₽<\/span>/);
});

test('room export hides equipment only in rooms where there are no equipment positions', () => {
  const rooms = [
    { id: 'a', name: 'С оборудованием', est },
    { id: 'b', name: 'Без оборудования', est: { ...est, equipment: [] } },
  ];
  const html = estimateHtml({ est, rooms, type: 'rooms' });
  assert.equal((html.match(/data-estimate-section="equipment"/g) || []).length, 1);
  assert.equal((html.match(/<span>Оборудование<\/span>/g) || []).length, 1);
  const noEquipment = estimateHtml({ est: { ...est, equipment: [] }, rooms, type: 'rooms' });
  assert.doesNotMatch(noEquipment, /data-estimate-section="equipment"|<span>Оборудование<\/span>/);
});

test('default template places actual project details on the left and company details on the right', () => {
  const company = {
    company: 'Студия Север', description: 'Потолки и освещение', legal: 'ИП Петров Пётр Петрович',
    inn: '123456789012', ogrn: '123456789012345', address: 'Хабаровск, ул. Мира, 7',
    phone: '+7 900 123-45-67', email: 'hello@example.test', website: 'studio.example.test',
  };
  const rooms = [{ name: 'Кухня', v: [[0, 0], [4, 0], [4, 3], [0, 3]], holes: [[[1, 1], [2, 1], [2, 2], [1, 2]]] }, { name: 'Отключённая', on: false, area: 100 }];
  const html = estimateHtml({ project: { name: 'Квартира', client: 'Иван', address: 'Объект на Ленина, 3', phone: '9001112222' }, company, rooms, est });
  const projectCard = html.match(/data-estimate-project>(.*?)<\/section>/s)?.[1];
  const companyCard = html.match(/data-estimate-company>(.*?)<\/section>/s)?.[1];
  assert.ok(projectCard && companyCard);
  assert.ok(html.indexOf('data-estimate-project') < html.indexOf('data-estimate-company'));
  for (const value of ['Данные проекта', 'Квартира', 'Иван', 'Объект на Ленина, 3', '9001112222']) assert.ok(projectCard.includes(value));
  assert.match(projectCard, /<dt>Тип сметы<\/dt><dd>Общая<\/dd>/);
  assert.match(projectCard, /<dt>Помещений<\/dt><dd>1<\/dd>/);
  assert.match(projectCard, /<dt>Площадь<\/dt><dd>11 м²<\/dd>/);
  for (const value of Object.values(company)) assert.ok(companyCard.includes(value));
  assert.doesNotMatch(companyCard, /Объект на Ленина/);
  assert.doesNotMatch(projectCard, /hello@example/);
});

test('header safely handles empty and long company details without inventing contacts', () => {
  const empty = estimateHtml({ company: null });
  const companyCard = empty.match(/data-estimate-company>(.*?)<\/section>/s)?.[1];
  assert.match(companyCard, /Данные компании не заполнены/);
  assert.doesNotMatch(companyCard, /Magic|Хабаровск|Тел\.:|@|ИНН/);
  const longName = 'Очень длинное название компании '.repeat(12);
  const html = estimateHtml({ company: { company: longName, description: '<script>alert(1)</script>', address: 'Переулок "Северный" & улица', phone: '<img src=x onerror=alert(1)>' } });
  assert.ok(html.includes(longName));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Переулок &quot;Северный&quot; &amp; улица'));
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /overflow-wrap:anywhere/);
});

test('header area uses room measurements or explicit project fallback and reflects export type', () => {
  const html = estimateHtml({ project: { area: 99 }, rooms: [{ area: 6.5 }, { area: 2.25 }], type: 'rooms' });
  assert.match(html, /<dt>Площадь<\/dt><dd>8,75 м²<\/dd>/);
  assert.match(html, /<dt>Тип сметы<\/dt><dd>По помещениям<\/dd>/);
  const fallback = estimateHtml({ project: { area: 99 }, type: 'draw' });
  assert.match(fallback, /<dt>Площадь<\/dt><dd>99 м²<\/dd>/);
  assert.match(fallback, /<dt>Тип сметы<\/dt><dd>Общая \+ чертежи<\/dd>/);
});

test('row photos and logos accept only encoded local catalogue images or raster data', () => {
  const logo = 'data:image/png;base64,iVBORw0KGgo=';
  const local = `/design/nom/${encodeURIComponent('Белое полотно.jpg')}`;
  const html = estimateHtml({ company: { company: 'Север', logo }, est: { mats: [{ n: 'Полотно', q: 1, p: 10, img: local }] } });
  assert.ok(html.includes(`class="estimate-company-logo" src="${logo}"`));
  assert.ok(html.includes(`class="estimate-item-photo" src="${local}"`));
  for (const img of ['https://external.example/photo.jpg', '//external.example/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', '/design/nom/..%2Fprivate.png', '/design/nom/a.svg', '/design/nom/a.png?track=1']) {
    const rejected = estimateHtml({ company: { logo: img }, est: { mats: [{ n: 'Полотно', q: 1, p: 10, img }] } });
    assert.doesNotMatch(rejected, /<img/);
  }
});
