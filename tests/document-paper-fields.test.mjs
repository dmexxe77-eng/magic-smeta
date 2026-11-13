import test from 'node:test';
import assert from 'node:assert/strict';
import { contractHtml, acceptanceHtml, normalizeContractTemplate, companyContractFields } from '../src/data/contract.js';

test('an empty contract appendix is a writable table with a real zero total', () => {
  const html = contractHtml(normalizeContractTemplate(), {}, {});
  assert.doesNotMatch(html, /Смета проекта будет подставлена|не заполнены|заполняются в настройках/);
  assert.match(html, /data-estimate-blank-row/);
  assert.match(html, /Итого:<\/td><td[^>]*>0 ₽/);
  assert.equal(companyContractFields().исполнитель, '');
  assert.doesNotMatch(acceptanceHtml({}, {}, { blank: true }), /Исполнитель: Исполнитель/);
});

test('user-authored clauses are not removed by the blank-field fallback changes', () => {
  const tpl = normalizeContractTemplate({ sections: [{ id: 'custom', title: 'Условие', text: 'Данные заказчика не заполнены: согласовать на объекте.' }] });
  assert.match(contractHtml(tpl, {}, {}), /Данные заказчика не заполнены: согласовать на объекте\./);
});
