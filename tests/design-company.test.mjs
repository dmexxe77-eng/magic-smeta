import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompanyDetails, getCompanyProfile } from '../src/design-bridge/company-profile.js';
import { DESIGN_CONTRACT_TEMPLATE_KEY, loadDesignContractTemplate, saveDesignContractTemplate } from '../src/design-bridge/contract-template-store.js';
import { runtime } from './design-runtime.mjs';

const storage = entries => ({ getItem: key => entries[key] ?? null, setItem: (key, value) => { entries[key] = value; } });
const data = head => storage({ [DESIGN_CONTRACT_TEMPLATE_KEY]: JSON.stringify({ head }) });
const event = value => ({ target: { value } });
const field = (app, label) => app.profileVals().prSections.flatMap(section => section.rows).find(row => row.label === label);

test('company details reuse entered contract fields without exporting demo defaults', () => {
  const source = data({ company: 'Студия', legal: 'ООО Студия', phone: '+7 999 1112233', inn: '1234567890', address: 'Адрес компании', logo: 'data:image/png;base64,AA==' });
  const details = getCompanyDetails(undefined, source);
  assert.equal(details.company, 'Студия');
  assert.equal(details.phone, '+7 999 1112233');
  assert.equal(details.address, 'Адрес компании');
  assert.equal(details.logo, 'data:image/png;base64,AA==');
  assert.ok(Object.values(getCompanyDetails(undefined, storage({}))).every(value => value === ''));
  assert.equal(getCompanyProfile(undefined, storage({})).name, '');
});

test('explicitly cleared fields and profile document contacts override saved header details', () => {
  const source = data({ company: 'Старое имя', phone: 'Старый телефон', website: 'old.test', address: 'Старый адрес' });
  const profile = { company: '', address: '', contractPhone: '', phone: 'Личный телефон', site: '', email: 'mail@example.test' };
  const details = getCompanyDetails(profile, source);
  assert.equal(details.company, '');
  assert.equal(details.address, '');
  assert.equal(details.phone, '');
  assert.equal(details.website, '');
  assert.equal(details.email, 'mail@example.test');
  assert.equal(getCompanyDetails({ phone: 'Новый телефон' }, source).phone, 'Новый телефон');
});

test('company fallback reads only saved main-app header and never overwrites stored data', () => {
  const entries = { magicapp_v2_4_autosave_v1: JSON.stringify({ contract: { head: { company: 'Основная компания', phone: '555' } } }) };
  const source = storage(entries), before = JSON.stringify(entries);
  assert.equal(getCompanyDetails({}, source).company, 'Основная компания');
  assert.equal(JSON.stringify(entries), before);
  entries[DESIGN_CONTRACT_TEMPLATE_KEY] = JSON.stringify({ head: { company: '' } });
  assert.equal(getCompanyDetails({}, source).company, '');
  assert.equal(getCompanyDetails({}, source).phone, '');
});

test('first design contract save preserves inherited actual main-app company details', () => {
  const entries = { magicapp_v2_4_autosave_v1: JSON.stringify({ contract: { head: { company: 'Основная компания', phone: '555', address: 'Адрес компании' } } }) };
  const source = storage(entries), before = getCompanyDetails({}, source);
  const template = loadDesignContractTemplate(source);
  assert.equal(template.head.company, 'Основная компания');
  saveDesignContractTemplate({ ...template, numSeq: template.numSeq + 1 }, source);
  assert.deepEqual(getCompanyDetails({}, source), before);
});

test('missing, corrupted or inaccessible company storage stays blank and contract loader retains defaults', () => {
  for (const source of [storage({ [DESIGN_CONTRACT_TEMPLATE_KEY]: '{invalid' }), { getItem() { throw new Error('Blocked'); } }]) {
    assert.equal(getCompanyDetails({}, source).company, '');
    assert.equal(loadDesignContractTemplate(source).head.company, '');
  }
  const entries = {}, source = storage(entries);
  saveDesignContractTemplate({ head: { company: 'Сохранено' }, style: 'accent' }, source);
  assert.equal(loadDesignContractTemplate(source).head.company, 'Сохранено');
  assert.equal(loadDesignContractTemplate(source).head.inn, '');
});

test('profile edits persist on reload and untouched company fields continue following saved header', async () => {
  const r = await runtime(), app = r.component;
  r.entries.set(DESIGN_CONTRACT_TEMPLATE_KEY, JSON.stringify({ head: { company: 'Из договора', phone: '111', address: 'Адрес 1' } }));
  app.go('profile');
  assert.equal(field(app, 'Компания').val, 'Из договора');
  field(app, 'Имя').change(event('Пользователь'));
  assert.equal(Object.hasOwn(app.state.profile, 'company'), false);
  field(app, 'Компания').change(event('Моя компания'));
  field(app, 'Телефон для документов').change(event(''));
  assert.equal(app.saveDesign(), true);
  const restored = await runtime({ saved: r.entries.get('zamer.design.v1') });
  restored.entries.set(DESIGN_CONTRACT_TEMPLATE_KEY, JSON.stringify({ head: { company: 'Другое имя', phone: '222', address: 'Адрес 2' } }));
  restored.component.go('profile');
  assert.equal(field(restored.component, 'Компания').val, 'Моя компания');
  assert.equal(field(restored.component, 'Телефон для документов').val, '');
  assert.equal(field(restored.component, 'Адрес компании').val, 'Адрес 2');
});

test('estimate settings open real company fields and export passes entered company details', async () => {
  const r = await runtime(), app = r.component;
  app.go('account');
  app.accountVals().acGroups.flatMap(group => group.items).find(item => item.label === 'Шапка сметы').pick();
  assert.equal(app.state.screen, 'profile');
  field(app, 'Компания').change(event('Экспортная студия'));
  field(app, 'E-mail').change(event('info@example.test'));
  app.openCalc(app.state.projects[0].id);
  app.setState({ sheet: 'export' });
  let received;
  r.ctx.MagicEstimate = { ...r.ctx.MagicEstimate, previewEstimate: async options => { received = options; return { status: 'previewed' }; } };
  await app.runEstimateExport('preview');
  assert.equal(received.company.company, 'Экспортная студия');
  assert.equal(received.company.email, 'info@example.test');
  assert.equal(received.company.legal, '');
});
