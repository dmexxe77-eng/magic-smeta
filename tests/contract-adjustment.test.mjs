import test from 'node:test';
import assert from 'node:assert/strict';
import { contractFields, contractHtml, DEFAULT_CONTRACT_TPL } from '../src/data/contract.js';
import { calculateEstimateTotals } from '../src/utils/estimate-adjustment.js';

const estimate = {
  mats: [{ n: 'Полотно', q: 1, p: 1808118, u: 'м²' }],
  works: [{ n: 'Монтаж', q: 1, p: 2243016.45, u: 'м²' }],
};

test('equipment appears in the contract specification and shares its adjusted total', () => {
  const est = { mats: [{ n: 'Полотно', q: 1, p: 100, u: 'м²' }], works: [], equipment: [{ n: 'Контроллер', q: 2, p: 250, u: 'шт' }] };
  const adjustment = { percent: 10, scope: 'equipment' };
  const actual = text(contractHtml(DEFAULT_CONTRACT_TPL, contractFields({}, 650), est, adjustment, { showAdjustment: false }));
  assert.match(actual, /Контроллер 2 шт 275 550/);
  assert.match(actual, /Итого: 650 ₽/);
  assert.doesNotMatch(actual, /наценк|скидк/i);
});
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const generate = (adjustment, exportOptions) => {
  const totals = calculateEstimateTotals(1808118, 2243016.45, adjustment);
  return text(contractHtml(DEFAULT_CONTRACT_TPL, contractFields({}, totals.adjustedTotal), estimate, adjustment, exportOptions));
};

test('the contract body and appendix show the same payable amount for a works markup', () => {
  const actual = generate({ percent: 10, scope: 'works' });
  assert.match(actual, /Общая стоимость работ по договору составляет 4 275 436,1 ₽/);
  assert.match(actual, /Без наценки: 4 051 134,45 ₽/);
  assert.match(actual, /Наценка на работы \+10%: \+224 301,65 ₽/);
  assert.match(actual, /Итого к оплате: 4 275 436,1 ₽/);
});

test('the appendix respects materials-only and whole-estimate adjustments', () => {
  const materials = generate({ percent: 10, scope: 'mats' });
  assert.match(materials, /Наценка на материалы \+10%: \+180 811,8 ₽/);
  assert.match(materials, /Итого к оплате: 4 231 946,25 ₽/);
  const all = generate({ percent: 10, scope: 'all' });
  assert.match(all, /Наценка на всю смету \+10%: \+405 113,45 ₽/);
  assert.match(all, /Итого к оплате: 4 456 247,9 ₽/);
});

test('the appendix keeps base prices unchanged and discounts explicit', () => {
  const before = structuredClone(estimate);
  const actual = generate({ percent: -10, scope: 'works' });
  assert.match(actual, /Без скидки: 4 051 134,45 ₽/);
  assert.match(actual, /Скидка на работы −10%: −224 301,65 ₽/);
  assert.match(actual, /Итого к оплате: 3 826 832,8 ₽/);
  assert.match(actual, /Полотно 1 м² 1 808 118 1 808 118/);
  assert.match(actual, /Монтаж 1 м² 2 243 016,45 2 243 016,45/);
  assert.deepEqual(estimate, before);
});

test('legacy contracts without adjustments retain a single base total', () => {
  const actual = generate(undefined);
  assert.match(actual, /Итого: 4 051 134,45 ₽/);
  assert.doesNotMatch(actual, /Без наценки|Без скидки|Наценка на|Скидка на/);
});

test('hidden contract markup is included in selected line prices without disclosure', () => {
  const actual = generate({ percent: 10, scope: 'works' }, { showAdjustment: false });
  assert.match(actual, /Полотно 1 м² 1 808 118 1 808 118/);
  assert.match(actual, /Монтаж 1 м² 2 467 318,1 2 467 318,1/);
  assert.match(actual, /Итого: 4 275 436,1 ₽/);
  assert.doesNotMatch(actual, /наценк|скидк|Без корректировки/i);
});

test('hidden contract markup also respects material and whole-estimate scopes', () => {
  const mats = generate({ percent: 10, scope: 'mats' }, { showAdjustment: false });
  assert.match(mats, /Полотно 1 м² 1 988 929,8 1 988 929,8/);
  assert.match(mats, /Монтаж 1 м² 2 243 016,45 2 243 016,45/);
  assert.match(mats, /Итого: 4 231 946,25 ₽/);
  const all = generate({ percent: 10, scope: 'all' }, { showAdjustment: false });
  assert.match(all, /Полотно 1 м² 1 988 929,8 1 988 929,8/);
  assert.match(all, /Монтаж 1 м² 2 467 318,1 2 467 318,1/);
  assert.match(all, /Итого: 4 456 247,9 ₽/);
  assert.doesNotMatch(mats + all, /наценк|скидк|Без корректировки/i);
});

test('hidden discounts lower client prices and preserve the payable contract amount', () => {
  const actual = generate({ percent: -10, scope: 'works' }, { showAdjustment: false });
  assert.match(actual, /Монтаж 1 м² 2 018 714,8 2 018 714,8/);
  assert.match(actual, /Итого: 3 826 832,8 ₽/);
  assert.doesNotMatch(actual, /наценк|скидк|Без корректировки/i);
});

test('the contract formats quantity to two decimals while retaining its adjusted price and total', () => {
  const actual = text(contractHtml(DEFAULT_CONTRACT_TPL, contractFields({}, 109.89),
    { mats: [], works: [{ n: 'Монтаж', q: 0.333, p: 300, u: 'м²' }] },
    { percent: 10, scope: 'works' }, { showAdjustment: false }));
  assert.match(actual, /Монтаж 0,33 м² 330 109,89/);
  assert.match(actual, /Итого: 109,89 ₽/);
});
