import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateHeaderCompany, estimateHeaderPreview, persistEstimateHeaderPatch } from '../src/design-bridge/estimate-header-model.js';
import { estimatePresetTemplate } from '../src/utils/estimate-template.js';
import { getCompanyDetails } from '../src/design-bridge/company-profile.js';
import { DESIGN_CONTRACT_TEMPLATE_KEY, contractTemplateAccess } from '../src/design-bridge/contract-template-store.js';
import { estimateHtml } from '../src/utils/estimate-html.js';

test('a host saves the header once and asynchronous profile failures never write a second store', async () => {
  let finish, storeWrites = 0, resolved = false, received;
  const access = { load: () => ({ head: {} }), save: () => { storeWrites++; } };
  const patch = { estimateTemplate: estimatePresetTemplate('modern') };
  const pending = persistEstimateHeaderPatch({ access, onCompanyChange: value => { received = value; return new Promise(resolve => { finish = resolve; }); } }, patch).then(() => { resolved = true; });
  await Promise.resolve();
  assert.equal(resolved, false);
  assert.equal(received, patch);
  assert.equal(storeWrites, 0);
  finish(true); await pending;
  assert.equal(resolved, true);
  await assert.rejects(persistEstimateHeaderPatch({ access, onCompanyChange: async () => { throw new Error('Места недостаточно'); } }, patch), /Места/);
  await assert.rejects(persistEstimateHeaderPatch({ access, onCompanyChange: async () => false }, patch), /Не удалось сохранить/);
  assert.equal(storeWrites, 0);
});

test('standalone SDK saves appearance under head and company export reuses it', async () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const access = contractTemplateAccess({ load: () => JSON.parse(storage.getItem(DESIGN_CONTRACT_TEMPLATE_KEY)), save: value => storage.setItem(DESIGN_CONTRACT_TEMPLATE_KEY, JSON.stringify(value)) });
  const appearance = estimatePresetTemplate('brand');
  await persistEstimateHeaderPatch({ access }, { estimateTemplate: appearance });
  assert.deepEqual(getCompanyDetails({}, storage).estimateTemplate, appearance);
  assert.deepEqual(estimateHeaderCompany({}, access).estimateTemplate, appearance);
  const company = estimateHeaderCompany({ estimateTemplate: estimatePresetTemplate('modern') }, access);
  assert.equal(company.estimateTemplate.background, '#FFFFFF');
});

test('sample preview uses the chosen company appearance without changing saved company data', () => {
  const company = { company: 'Студия', companyAddress: 'Офис', sign: 'legacy-image', estimateTemplate: estimatePresetTemplate('modern') };
  const before = JSON.stringify(company), preview = estimateHeaderPreview(company);
  const html = estimateHtml(preview);
  assert.match(html, /Пример сметы/);
  assert.match(html, /data-estimate-room-count="1">1 помещение/);
  assert.match(html, /data-estimate-area="42.6">42,6 м²/);
  assert.match(html, /data-estimate-grand-total>85\s000 ₽/);
  assert.match(html, /--estimate-table-bg:#E7EFFD/);
  assert.doesNotMatch(html, /legacy-image|Подпись исполнителя/);
  assert.equal(JSON.stringify(company), before);
});
