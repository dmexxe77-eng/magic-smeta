import test from 'node:test';
import assert from 'node:assert/strict';
import { signatureNameFromClient, contractHtml, acceptanceHtml } from '../src/data/contract.js';
import { createContractDraft, contractDraftFields, createContractSnapshot } from '../src/data/contract-documents.js';

test('client names can supply short initials without inventing an organisation representative', () => {
  assert.equal(signatureNameFromClient('  Губарь  Николай Александрович  '), 'Губарь Н.А.');
  assert.equal(signatureNameFromClient('Иванова-Петрова Анна Марковна'), 'Иванова-Петрова А.М.');
  assert.equal(signatureNameFromClient('Губарь Н.А.'), 'Губарь Н.А.');
  assert.equal(signatureNameFromClient('Петров Алексей'), 'Петров А.');
  for (const value of ['', 'Николай', 'ООО Строй Сервис', 'ООО «Строй»', 'ИП Петров Алексей', 'МУП Водоканал', 'ФГУП Ремсервис', 'АНО Центр Содействие', 'ГБУ Центр', '<img src=x>']) assert.equal(signatureNameFromClient(value), '');
  for (const party of [{ companyName: 'Строй Сервис' }, { inn: '1234567890' }, { kpp: '123456789' }]) assert.equal(signatureNameFromClient('Строй Сервис', party), '');
});

test('automatic client initials follow the current name while manual overrides and explicit blanks survive reopening', () => {
  const project = { client: 'Петров Алексей Сергеевич', address: 'Объект' };
  const draft = createContractDraft({ project, total: 12000, today: '2026-11-13' });
  Object.assign(draft, { startDate: '2026-11-20', endDate: '2026-11-21' });
  assert.equal(contractDraftFields(draft).подпись_заказчика, 'Петров А.С.');
  const automatic = createContractSnapshot({ draft });
  const updated = createContractDraft({ saved: automatic, project: { ...project, client: 'Сидоров Иван Петрович' }, refreshFromProject: true, total: 12000 });
  assert.equal(contractDraftFields(updated).подпись_заказчика, 'Сидоров И.П.');
  for (const signerName of ['Представитель П.П.', '']) {
    draft.party.signerName = signerName;
    const saved = createContractSnapshot({ draft });
    const reopened = createContractDraft({ saved, project, refreshFromProject: true, total: 12000 });
    assert.equal(reopened.party.signerName, signerName);
    assert.equal(contractDraftFields(reopened).подпись_заказчика, signerName);
  }
});

test('company and client signature names are escaped, separate from legal names and never create a signature image', () => {
  const head = { company: 'Студия', legal: 'ООО «Студия»', signerName: 'Губарь Н.А. <имя>' };
  const fields = { клиент: 'Полное имя клиента', подпись_заказчика: 'Петров П.П. <клиент>' };
  for (const html of [contractHtml({ head }, fields), acceptanceHtml({ head }, fields)]) {
    const group = html.match(/<section class="contract-signatures[^>]*>([\s\S]*?)<\/section>/)[1];
    assert.match(group, /Губарь Н.А. &lt;имя&gt;/);
    assert.match(group, /Петров П.П. &lt;клиент&gt;/);
    assert.doesNotMatch(group, /<имя>|<клиент>|должность|<img/);
    assert.equal((group.match(/data-manual-signature><\/div>/g) || []).length, 2);
    assert.equal((group.match(/>ФИО<\/span>/g) || []).length, 2);
  }
});
