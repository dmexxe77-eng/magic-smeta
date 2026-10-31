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
  assert.match(drawing, /Площадь 11 м² · Периметр 18 м.п./);
  assert.match(drawing, /4 м<\/text>/);
  const html = estimateHtml({ est, type: 'draw', rooms: [room] });
  assert.match(html, /Чертежи помещений/);
  assert.match(html, /Кухня &lt;1&gt;/);
  assert.doesNotMatch(estimateHtml({ est, type: 'total', rooms: [room] }), /<svg/);
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
