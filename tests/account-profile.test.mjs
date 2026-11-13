import test from 'node:test';
import assert from 'node:assert/strict';
import { accountProfile, bankDetailsText, formatProfilePhone, LEGAL_FORMS, mergeAccountProfilePatch, profileFieldPatch, validateProfileField } from '../src/design-bridge/account-profile.js';
import { getCompanyDetails } from '../src/design-bridge/company-profile.js';
import { runtime } from './design-runtime.mjs';
import { estimatePresetTemplate } from '../src/utils/estimate-template.js';

test('native form options show only their requisite fields without erasing hidden data', () => {
  const initial = { legalForm: 'ООО', legal: 'Мастер', inn: '123', kpp: '456', ogrn: '789', address: 'Адрес' };
  const ip = mergeAccountProfilePatch(initial, { legalForm: 'ip' });
  const self = mergeAccountProfilePatch(ip, { legalForm: 'self_employed' });
  assert.equal(LEGAL_FORMS.find(f => f.id === 'ip').showKpp, false);
  assert.equal(LEGAL_FORMS.find(f => f.id === 'self_employed').showOgrn, false);
  assert.equal(self.kpp, initial.kpp);
  assert.equal(self.ogrn, initial.ogrn);
  assert.equal(accountProfile(initial).legalForm, 'ooo');
  assert.equal(getCompanyDetails(ip).legal, 'ИП Мастер');
  assert.equal(getCompanyDetails({ ...ip, legal: 'ИП Мастер' }).legal, 'ИП Мастер');
  assert.deepEqual(LEGAL_FORMS.map(form => form.id), ['ip', 'ooo', 'self_employed']);
  assert.equal(accountProfile({ legalForm: 'АО', legal: 'АО «Ранее»' }).legalForm, 'ao');
  assert.equal(mergeAccountProfilePatch({ legalForm: 'ao' }, { city: 'Город' }).legalForm, 'ao');
  assert.throws(() => mergeAccountProfilePatch({}, { legalForm: 'ao' }), /форму/);
  assert.equal(getCompanyDetails(ip).kpp, '');
  assert.equal(getCompanyDetails(self).kpp, '');
  assert.equal(getCompanyDetails(self).ogrn, '');
  assert.equal(getCompanyDetails({ ...self, legalForm: 'ooo' }).kpp, initial.kpp);
});

test('requisite validation follows the selected form and optional fields may remain empty', () => {
  assert.equal(validateProfileField('inn', '1234567890', { legalForm: 'ooo' }), null);
  assert.ok(validateProfileField('inn', '123456789012', { legalForm: 'ooo' }));
  assert.equal(validateProfileField('inn', '123456789012', { legalForm: 'ip' }), null);
  assert.ok(validateProfileField('inn', '1234567890', { legalForm: 'self_employed' }));
  assert.equal(validateProfileField('ogrn', '1234567890123', { legalForm: 'ooo' }), null);
  assert.ok(validateProfileField('ogrn', '1234567890123', { legalForm: 'ip' }));
  assert.equal(validateProfileField('ogrn', '123456789012345', { legalForm: 'ip' }), null);
  assert.ok(validateProfileField('kpp', '123'));
  for (const key of ['inn', 'kpp', 'ogrn', 'bankAccount', 'bankBik', 'bankCorrAccount']) assert.equal(validateProfileField(key, '', { legalForm: 'self_employed' }), null);
  assert.equal(validateProfileField('bankAccount', '40817810000000000001'), null);
  assert.ok(validateProfileField('bankAccount', '1234'));
  assert.ok(validateProfileField('bankBik', '123'));
  assert.throws(() => profileFieldPatch('inn', '1234567890', { legalForm: 'ip' }), /12/);
});

test('changing form keeps original requisites but excludes incompatible identifiers from documents', () => {
  const company = { legalForm: 'ooo', inn: '1234567890', ogrn: '1234567890123', kpp: '123456789' };
  const ip = mergeAccountProfilePatch(company, { legalForm: 'ip' });
  assert.equal(ip.inn, company.inn);
  assert.equal(ip.ogrn, company.ogrn);
  assert.ok(validateProfileField('inn', ip.inn, ip));
  assert.ok(validateProfileField('ogrn', ip.ogrn, ip));
  assert.equal(getCompanyDetails(ip).inn, '');
  assert.equal(getCompanyDetails(ip).ogrn, '');
  const restoredCompany = mergeAccountProfilePatch(ip, { legalForm: 'ooo' });
  assert.equal(getCompanyDetails(restoredCompany).inn, company.inn);
  assert.equal(getCompanyDetails(restoredCompany).ogrn, company.ogrn);
  const corrected = { ...ip, ...profileFieldPatch('inn', '123456789012', ip), ...profileFieldPatch('ogrn', '123456789012345', ip) };
  assert.equal(getCompanyDetails(corrected).inn, '123456789012');
  assert.equal(getCompanyDetails(corrected).ogrn, '123456789012345');
});

test('self-employed payment details accept a personal account without calling it a settlement account', () => {
  const parts = { legalForm: 'self_employed', bankAccount: '40817810000000000001', bankBik: '040813608' };
  assert.match(bankDetailsText(parts), /^Счёт /);
  assert.doesNotMatch(getCompanyDetails(parts).bank, /Р\/с/);
  assert.equal(getCompanyDetails({ legalForm: 'self_employed' }).bank, '');
});

test('company header address and legal address stay independent after profile save and reload', () => {
  const initial = { legalForm: 'ooo', address: 'Юридический адрес, дом 1' };
  const saved = mergeAccountProfilePatch(initial, profileFieldPatch('companyAddress', ' Офис компании, дом 2 '));
  const reopened = accountProfile(JSON.parse(JSON.stringify(saved)));
  const details = getCompanyDetails(reopened);
  assert.equal(reopened.address, initial.address);
  assert.equal(details.address, initial.address);
  assert.equal(details.companyAddress, 'Офис компании, дом 2');
  const clearedOffice = mergeAccountProfilePatch(reopened, profileFieldPatch('companyAddress', ''));
  assert.equal(getCompanyDetails(clearedOffice).companyAddress, '');
  assert.equal(getCompanyDetails(clearedOffice).address, initial.address);
  assert.equal(getCompanyDetails(initial).companyAddress, '', 'the legal address is not copied into the header address');
});

test('bank parts update document details and explicitly clearing them removes stale bank text', () => {
  const initial = { bank: 'Старый банк' };
  assert.equal(accountProfile(accountProfile(initial)).bank, initial.bank);
  assert.equal(getCompanyDetails(accountProfile(initial)).bank, initial.bank);
  const parts = { bankAccount: '123', bankBik: '456', bankName: 'Новый банк', bankCorrAccount: '789' };
  const next = mergeAccountProfilePatch(initial, parts);
  assert.equal(getCompanyDetails(next).bank, bankDetailsText(parts));
  assert.match(next.bank, /Р\/с 123\nБИК 456\nНовый банк\nК\/с 789/);
  const empty = mergeAccountProfilePatch(next, Object.fromEntries(Object.keys(parts).map(key => [key, ''])));
  assert.equal(getCompanyDetails(empty).bank, '');
});

test('field validation and normalization match the native phone, email and VAT editors', () => {
  assert.equal(formatProfilePhone('89141234567'), '+7 (914) 123-45-67');
  assert.equal(formatProfilePhone('9141234567'), '+7 (914) 123-45-67');
  assert.equal(formatProfilePhone('+7 (914'), '+7 (914');
  assert.equal(validateProfileField('phone', '+7'), 'Укажите корректный номер телефона');
  assert.equal(validateProfileField('contractPhone', '+7'), null);
  assert.deepEqual(profileFieldPatch('contractPhone', '+7'), { contractPhone: '' });
  assert.deepEqual(profileFieldPatch('email', ' INFO@EXAMPLE.COM '), { email: 'info@example.com' });
  assert.deepEqual(profileFieldPatch('vatRate', '7,5'), { vatRate: '7,5' });
  assert.ok(validateProfileField('vatRate', '101'));
  assert.ok(validateProfileField('vatRate', ''));
  assert.deepEqual(profileFieldPatch('legalAddress', ' Город '), { address: 'Город' });
});

test('account persistence admits profile fields only and never stores credentials or role changes', () => {
  const next = mergeAccountProfilePatch({ role: 'USER' }, { name: 'Мастер', role: 'ADMIN', currentPassword: 'secret', newPassword: 'secret', vat: true });
  assert.equal(next.name, 'Мастер');
  assert.equal(next.role, 'USER');
  assert.equal(next.vatRate, '20');
  assert.equal(next.currentPassword, undefined);
  assert.equal(next.newPassword, undefined);
  assert.throws(() => mergeAccountProfilePatch({}, { legalForm: 'Неизвестная форма' }));
  assert.equal(mergeAccountProfilePatch({ vat: true, vatRate: 0 }, { city: 'Город' }).vatRate, 0);
});

test('estimate appearance is an allowed normalized profile setting and survives save and reopen', () => {
  const template = estimatePresetTemplate('modern');
  const current = { company: 'Студия', sign: 'legacy-sign', address: 'Юр. адрес', companyAddress: 'Офис' };
  const saved = mergeAccountProfilePatch(current, { estimateTemplate: { ...template, fontSize: 999, injected: 'url(x)' } });
  assert.equal(saved.estimateTemplate.fontSize, 16);
  assert.equal(saved.estimateTemplate.injected, undefined);
  for (const key of Object.keys(current)) assert.equal(saved[key], current[key]);
  const restored = accountProfile(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(getCompanyDetails(restored).estimateTemplate, saved.estimateTemplate);
  for (const invalid of [null, false, 'modern', []]) assert.throws(() => mergeAccountProfilePatch(current, { estimateTemplate: invalid }), /оформление/);
});

test('saved account fields survive reload and failed storage leaves the prior profile intact', async () => {
  const r = await runtime();
  r.component.saveAccountProfile({ name: 'Новый мастер', legalForm: 'ip', legal: 'Иванов', signerName: 'Иванов И.И.' });
  const restored = await runtime({ saved: r.entries.get('zamer.design.v1') });
  assert.equal(restored.component.state.profile.name, 'Новый мастер');
  assert.equal(restored.ctx.MagicEstimate.getCompanyDetails(restored.component.state.profile).legal, 'ИП Иванов');
  const failed = await runtime({ storageError: true });
  assert.throws(() => failed.component.saveAccountProfile({ name: 'Не сохранено' }), /Не удалось сохранить/);
  assert.equal(failed.component.state.profile.name, undefined);
});

test('company settings return to the document editor with the newly saved requisites', async () => {
  const r = await runtime(), app = r.component;
  let template, settings, header;
  r.ctx.MagicContract = { openTemplate: options => { template = options; return { close() {} }; } };
  r.ctx.MagicDocuments = {
    openAccountSettings: options => { settings = options; return { close() {} }; },
    openEstimateHeader: options => { header = options; return { close() {} }; },
  };
  app.openContractTpl();
  template.onEditCompany();
  settings.onChange({ legalForm: 'ip', legal: 'Петров П.П.', company: 'Новая студия' });
  settings.onClose();
  assert.equal(template.company.company, 'Новая студия');
  assert.equal(template.company.legal, 'ИП Петров П.П.');
  app.openEstimateHeader();
  header.onEditCompany();
  settings.onChange({ signerName: 'Петров П.П.' });
  settings.onClose();
  assert.equal(header.company.signerName, 'Петров П.П.');
});

test('signature names stay independent from full legal names for every company form', () => {
  const fullName = 'Губарь Николай Александрович';
  const emptyStorage = { getItem: () => null };
  for (const legalForm of ['ooo', 'ip', 'self_employed']) {
    const initial = { legalForm, legal: legalForm === 'ooo' ? 'ООО «Мастерская»' : fullName };
    const entered = profileFieldPatch('signerName', ' Губарь Н.А. ', initial);
    assert.deepEqual(entered, { signerName: 'Губарь Н.А.' });
    const saved = mergeAccountProfilePatch(initial, entered);
    const reopened = accountProfile(JSON.parse(JSON.stringify(saved)));
    assert.equal(reopened.signerName, 'Губарь Н.А.');
    assert.equal(reopened.legal, initial.legal);
    assert.equal(getCompanyDetails(reopened, emptyStorage).signerName, 'Губарь Н.А.');
    assert.equal(initial.signerName, undefined);
  }
});

test('the shared account save persists signerName for document export and supports clearing an inherited signer', async () => {
  const r = await runtime(), app = r.component;
  app.saveAccountProfile({ legalForm: 'ip', legal: 'Губарь Николай Александрович' });
  app.saveAccountProfile(profileFieldPatch('signerName', 'Губарь Н.А.', app.state.profile));
  const restored = await runtime({ saved: r.entries.get('zamer.design.v1') });
  assert.equal(restored.component.state.profile.signerName, 'Губарь Н.А.');
  assert.equal(restored.component.state.profile.legal, 'Губарь Николай Александрович');
  assert.equal(restored.ctx.MagicEstimate.getCompanyDetails(restored.component.state.profile).signerName, 'Губарь Н.А.');
  const cleared = mergeAccountProfilePatch(restored.component.state.profile, profileFieldPatch('signerName', ''));
  const oldHeader = { getItem: key => key === 'zamer.contractTpl' ? JSON.stringify({ head: { signerName: 'Старый подписант' } }) : null };
  assert.equal(getCompanyDetails(cleared, oldHeader).signerName, '');
  assert.equal(cleared.legal, 'Губарь Николай Александрович');
});
