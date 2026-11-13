import test from 'node:test';
import assert from 'node:assert/strict';
import { accountProfile, bankDetailsText, formatProfilePhone, LEGAL_FORMS, mergeAccountProfilePatch, profileFieldPatch, validateProfileField } from '../src/design-bridge/account-profile.js';
import { getCompanyDetails } from '../src/design-bridge/company-profile.js';
import { runtime } from './design-runtime.mjs';

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
