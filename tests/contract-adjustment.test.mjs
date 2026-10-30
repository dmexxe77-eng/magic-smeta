import test from 'node:test';
import assert from 'node:assert/strict';
import { contractFields, contractHtml, DEFAULT_CONTRACT_TPL } from '../src/data/contract.js';
import { calculateEstimateTotals } from '../src/utils/estimate-adjustment.js';

const estimate = {
  mats: [{ n: 'Полотно', q: 1, p: 1808118, u: 'м²' }],
  works: [{ n: 'Монтаж', q: 1, p: 2243016.45, u: 'м²' }],
};
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const generate = adjustment => {
  const totals = calculateEstimateTotals(1808118, 2243016.45, adjustment);
  return text(contractHtml(DEFAULT_CONTRACT_TPL, contractFields({}, totals.adjustedTotal), estimate, adjustment));
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
