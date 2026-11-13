import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContractTemplate, contractHtml, contractFields, DEFAULT_CONTRACT_ESTIMATE_OPTIONS } from '../src/data/contract.js';

const est = { mats: [{ n: 'Полотно', q: 2, p: 500, u: 'м²' }], works: [] };
const plain = html => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('old templates retain one editable estimate appendix and independent defaults', () => {
  const first = normalizeContractTemplate({ head: { company: 'Студия' } });
  assert.equal(first.appendices[0].kind, 'estimate');
  assert.ok(Object.values(first.appendices[0].exportOptions.cols).every(Boolean));
  assert.equal(first.appendices[0].exportOptions.columnsDefaultsVersion, 1);
  first.sections[0].text = 'Изменение';
  first.appendices[0].exportOptions.cols.price = false;
  const next = normalizeContractTemplate();
  assert.notEqual(next.sections[0].text, 'Изменение');
  assert.equal(next.appendices[0].exportOptions.cols.price, true);
  assert.deepEqual(normalizeContractTemplate({ estOn: false }).appendices, []);
});

test('old automatic column exclusions migrate once and later manual changes remain saved', () => {
  const template = { appendices: [{ id: 'estimate', kind: 'estimate', exportOptions: { type: 'total', cols: { num: false, photo: false } } }] };
  const migrated = normalizeContractTemplate(template);
  assert.ok(Object.values(migrated.appendices[0].exportOptions.cols).every(Boolean));
  migrated.appendices[0].exportOptions.cols.photo = false;
  const reopened = normalizeContractTemplate(JSON.parse(JSON.stringify(migrated)));
  assert.equal(reopened.appendices[0].exportOptions.cols.photo, false);
  assert.equal(reopened.appendices[0].exportOptions.cols.num, true);
  assert.equal(template.appendices[0].exportOptions.cols.photo, false);
});

test('text appendices substitute values after the estimate while the separate act reserves its number', () => {
  const tpl = normalizeContractTemplate({ head: { company: 'Студия <A>' }, sections: [], appendices: [
    { id: 'text', kind: 'text', title: 'Акт для {клиент}', text: '{компания}\nПринимает {клиент}' },
    { id: 'estimate', kind: 'estimate', exportOptions: DEFAULT_CONTRACT_ESTIMATE_OPTIONS },
  ] });
  const html = contractHtml(tpl, contractFields({ client: 'Иван' }, 1000), est);
  assert.match(html, /Акт для Иван/);
  assert.match(html, /Студия &lt;A&gt;\nПринимает Иван/);
  assert.ok(html.indexOf('Приложение №1 — Смета') < html.indexOf('Приложение №3 — Акт для Иван'));
  assert.doesNotMatch(html, /Приложение №2 — Акт|data-document-kind="acceptance/);
  assert.doesNotMatch(html, /Студия <A>/);
  assert.equal(normalizeContractTemplate({ appendices: [...tpl.appendices, tpl.appendices[1]] }).appendices.length, 2);
});

test('removing estimate appendix removes its rows and chosen columns affect export', () => {
  const noAppendices = normalizeContractTemplate({ sections: [], appendices: [] });
  assert.doesNotMatch(plain(contractHtml(noAppendices, {}, est)), /Полотно/);
  const tpl = normalizeContractTemplate({ sections: [], appendices: [{ id: 'estimate', kind: 'estimate', exportOptions: {
    type: 'total', columnsDefaultsVersion: 1, cols: { num: false, photo: false, name: true, qty: true, unit: true, price: false, total: true },
  } }] });
  const html = contractHtml(tpl, {}, est);
  assert.doesNotMatch(html, />Цена<\/th>/);
  assert.match(plain(html), /Полотно 2 м² 1 000/);
});

test('estimate appendix uses room context for per-room and drawing exports', () => {
  const room = { id: 'kitchen', name: 'Кухня', v: [[0, 0], [4, 0], [4, 3], [0, 3]], holes: [], est };
  const make = type => normalizeContractTemplate({ sections: [], appendices: [{ id: 'estimate', kind: 'estimate', exportOptions: { type } }] });
  const perRoom = contractHtml(make('perRoom'), {}, est, undefined, undefined, { rooms: [room] });
  assert.match(perRoom, /data-estimate-room="kitchen"/);
  assert.match(perRoom, /Кухня/);
  const drawing = contractHtml(make('totalDraw'), {}, est, undefined, undefined, { rooms: [room] });
  assert.match(drawing, /Чертежи помещений/);
  assert.match(drawing, /Кухня/);
});

test('all contract appendix layouts honor mixed per-category correction visibility', () => {
  const estimate = { mats: [{ n: 'Материал', q: 1, p: 100, u: 'шт' }], works: [{ n: 'Монтаж', q: 1, p: 200, u: 'шт' }], equipment: [{ n: 'Контроллер', q: 1, p: 50, u: 'шт' }] };
  const adjustment = { scope: 'all', rates: { mats: 10, works: 20, equipment: -10 } };
  const room = { id: 'room', name: 'Комната', est: estimate };
  for (const type of ['total', 'totalDraw', 'perRoom']) {
    const tpl = normalizeContractTemplate({ sections: [], appendices: [{ id: 'estimate', kind: 'estimate', exportOptions: { type, columnsDefaultsVersion: 1, cols: { num: false, photo: false } } }] });
    const shown = plain(contractHtml(tpl, {}, estimate, adjustment, { showAdjustmentByScope: { mats: false, works: true, equipment: false } }, { rooms: [room] }));
    assert.match(shown, /Материал 1 шт 110 110/, type);
    assert.match(shown, /Контроллер 1 шт 45 45/, type);
    assert.match(shown, /Наценка на работы \+20%/, type);
    assert.doesNotMatch(shown, /Наценка на материалы|Скидка на оборудование/, type);
    assert.match(shown, /395 ₽/, type);
    const hidden = plain(contractHtml(tpl, {}, estimate, adjustment, { showAdjustmentByScope: { mats: false, works: false, equipment: false } }, { rooms: [room] }));
    assert.match(hidden, /Монтаж 1 шт 240 240/, type);
    assert.doesNotMatch(hidden, /Наценка|Скидка|Без корректировки/, type);
    assert.match(hidden, /395 ₽/, type);
  }
});
