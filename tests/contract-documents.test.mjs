import test from 'node:test';
import assert from 'node:assert/strict';
import { contractHtml, acceptanceHtml, companyContractFields, normalizeContractTemplate, DEFAULT_ACT_SECTIONS, CONTRACT_STYLES } from '../src/data/contract.js';
import { DEFAULT_ACT_SECTIONS as PRESERVED_OLD_ACT_SECTIONS } from './fixtures/preserved-documents/src/data/contract.js';
import { createContractDraft, validateContractDraft, contractDraftFields, createContractSnapshot, createActSnapshot, validateActDraft, parseContractMoney } from '../src/data/contract-documents.js';
import { estimatePresetTemplate } from '../src/utils/estimate-template.js';

const est = { mats: [{ n: 'Полотно', q: 12, p: 100, u: 'м²' }], works: [{ n: 'Монтаж', q: 12, p: 150, u: 'м²' }] };
const template = () => normalizeContractTemplate({ head: { company: 'Студия', legal: 'ИП Пример', legalForm: 'ip' } });
const draft = () => ({ ...createContractDraft({ project: { client: 'Анна Пример', address: 'Примерная, 1' }, total: 3000, area: 12, template: template(), today: '2026-11-13' }), number: '13-11/2026-1', startDate: '2026-11-16', endDate: '2026-11-18' });
const plain = html => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('saved decimal-comma percentages keep the chosen prepayment on reopening', () => {
  const tpl = normalizeContractTemplate({ settings: { prepayPercent: '30,5' } });
  assert.equal(tpl.settings.prepayPercent, 30.5);
  const reopened = normalizeContractTemplate(JSON.parse(JSON.stringify(tpl)));
  const value = createContractDraft({ template: reopened, total: 10000 });
  assert.equal(value.prepay, 3050);
});

test('universal drafts retain existing document dates and saved party rather than live project values', () => {
  const saved = { date: '02.10.2026', total: 1700, prepay: 0, client: 'Сохранённый заказчик', address: 'Старый адрес', number: '42' };
  const value = createContractDraft({ saved, project: { client: 'Другой', address: 'Новый' }, total: 3000, template: template(), today: '2026-11-13' });
  assert.equal(value.date, '02.10.2026');
  assert.equal(value.total, 1700);
  assert.equal(value.prepay, 0);
  assert.equal(value.party.client, 'Сохранённый заказчик');
  assert.equal(value.customerType, 'universal');
});

test('current project drafts refresh calculator values while keeping agreed dates and terms', () => {
  const saved = { date: '02.10.2026', total: 1700, area: 10, prepay: 750, client: 'Сохранённый заказчик', address: 'Старый адрес', number: '42' };
  const value = createContractDraft({ saved, project: { client: 'Текущий заказчик', address: 'Новый адрес' }, total: 4500, area: 15, template: template(), refreshFromProject: true });
  assert.equal(value.date, '02.10.2026');
  assert.equal(value.number, '42');
  assert.equal(value.total, 4500);
  assert.equal(value.area, 15);
  assert.equal(value.prepay, 750);
  assert.equal(value.party.client, 'Текущий заказчик');
  assert.equal(value.party.address, 'Новый адрес');
});

test('reopening an incomplete saved draft preserves explicitly empty document fields', () => {
  const saved = { status: 'draft', number: '', date: '', startDate: '', endDate: '', prepay: '' };
  const value = createContractDraft({ saved, total: 4500, area: 15, installDate: '2026-11-19', template: template(), refreshFromProject: true });
  for (const field of ['number', 'date', 'startDate', 'endDate', 'prepay']) assert.equal(value[field], '');
  assert.equal(value.total, 4500);
  assert.equal(value.area, 15);
});

test('unallocated automatic draft numbers refresh after another project uses the suggestion', () => {
  const tpl = template();
  const first = createContractDraft({ template: tpl, today: '2026-11-13' });
  const saved = { ...first, status: 'draft', numberAllocated: false };
  const refreshed = createContractDraft({ saved, template: { ...tpl, numSeq: 2 } });
  assert.notEqual(refreshed.number, first.number);
  assert.match(refreshed.number, /-2$/);
  const manual = createContractDraft({ saved: { ...saved, number: 'МОЙ-7', numberAuto: false }, template: { ...tpl, numSeq: 2 } });
  assert.equal(manual.number, 'МОЙ-7');
});

test('money entry accepts decimal commas and spaces and rejects malformed values', () => {
  assert.equal(parseContractMoney('1 000,50'), 1000.5);
  assert.equal(parseContractMoney('1\u00a0000.50'), 1000.5);
  assert.ok(Number.isNaN(parseContractMoney('100,2,3')));
  assert.ok(Number.isNaN(parseContractMoney('рубли')));
  const value = draft();
  value.prepay = '1000,50';
  assert.deepEqual(validateContractDraft(value), {});
  assert.equal(contractDraftFields(value).предоплата, 1000.5);
  value.prepay = '3000,01';
  assert.match(validateContractDraft(value).prepay, /сумм/);
});

test('formation requires actual dates, valid order and universal customer details', () => {
  const value = draft();
  value.endDate = '';
  assert.ok(validateContractDraft(value).endDate);
  value.endDate = '2026-11-15';
  assert.ok(validateContractDraft(value).endDate);
  value.endDate = '2026-11-31';
  assert.ok(validateContractDraft(value).endDate);
  value.endDate = '2026-11-18';
  value.party.client = 'ООО «Пример»';
  assert.deepEqual(validateContractDraft(value), {}, 'extra company fields remain optional');
});

test('new contract HTML contains both actual dates and safely escaped party details', () => {
  const value = draft();
  value.party.client = '<img src=x onerror=alert(1)>';
  value.party.inn = '1234567890';
  value.party.legalAddress = 'Юридический <адрес>';
  const html = contractHtml(template(), contractDraftFields(value), est);
  assert.match(html, /16\.11\.2026/);
  assert.match(html, /18\.11\.2026/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /1234567890/);
  assert.match(html, /Юридический &lt;адрес&gt;/);
});

test('the brand header uses the company office address while legal requisites retain the legal address', () => {
  const tpl = normalizeContractTemplate({ head: { company: 'Студия', legal: 'ИП Пример', address: 'Юридическая, 1', companyAddress: 'Офисная, 2' } });
  const html = contractHtml(tpl, contractDraftFields(draft()), est);
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  const requisites = html.slice(html.indexOf('<section class="contract-requisites'), html.indexOf('</section>'));
  assert.match(header, /Офисная, 2/);
  assert.doesNotMatch(header, /Юридическая, 1/);
  assert.match(requisites, /Юридическая, 1/);
  assert.doesNotMatch(requisites, /Офисная, 2/);
  assert.equal(companyContractFields(tpl.head).адрес_компании, 'Офисная, 2');
  assert.equal(companyContractFields({ address: 'Старый адрес' }).адрес_компании, 'Старый адрес');
});

test('contracts offer paper signing spaces while every estimate appendix omits signatures', () => {
  for (const type of ['total', 'totalDraw', 'perRoom']) {
    const tpl = template();
    tpl.head.sign = 'data:image/png;base64,U0lHTg==';
    tpl.head.signature = tpl.head.sign;
    tpl.appendices[0].exportOptions.type = type;
    const html = contractHtml(tpl, contractDraftFields(draft()), est);
    assert.doesNotMatch(html, /U0lHTg==|<[^>]+class="estimate-signature/);
    assert.equal((html.match(/data-document-signatures/g) || []).length, 1);
    assert.equal((html.match(/data-manual-signature/g) || []).length, 2);
    assert.doesNotMatch(html.slice(html.indexOf('data-contract-appendix="estimate"')), /data-document-signatures|data-manual-signature|ФИО подписанта/);
  }
});

test('the estimate summary keeps a large monetary value and currency together', () => {
  const estimate = { mats: [{ n: 'Полотно', q: 1, p: 372734.5, u: 'компл.' }], works: [] };
  const html = contractHtml(template(), contractDraftFields(draft()), estimate);
  assert.match(html, /<td[^>]*style="[^"]*white-space:nowrap;[^"]*">372 734,5 ₽<\/td>/);
  assert.equal((html.match(/<tr data-pdf-summary>/g) || []).length, 1);
  assert.doesNotMatch(html, /<tr data-pdf-summary>[^<]*<td[^>]*>Полотно/);
});

test('the single document style retains content and PDF boundaries', () => {
  assert.deepEqual(CONTRACT_STYLES.map(style => style.id), ['magic']);
  assert.deepEqual(CONTRACT_STYLES.map(style => style.label), ['Единое оформление']);
  const contracts = [], acts = [], headers = [];
  const fields = contractDraftFields(draft());
  const act = { number: 'А-9', date: '2026-11-20', completionDate: '2026-11-19', scope: 'Монтаж кухни', acceptance: 'none', total: 3000, paid: 1500 };
  for (const style of CONTRACT_STYLES) {
    assert.ok(style.description && style.layout && style.background && style.ink && style.font);
    const tpl = normalizeContractTemplate({ ...template(), style: style.id });
    assert.equal(normalizeContractTemplate(JSON.parse(JSON.stringify(tpl))).style, style.id);
    const html = contractHtml(tpl, fields, est);
    const actHtml = acceptanceHtml(tpl, fields, act);
    contracts.push(plain(html));
    acts.push(plain(actHtml));
    headers.push(html.match(/<header[\s\S]*?<\/header>/)[0]);
    assert.ok(html.includes(`data-contract-style="${style.id}"`));
    assert.ok(html.includes(`data-contract-layout="${style.layout}"`));
    assert.ok(html.includes(`font-family:${style.font}`));
    assert.ok(actHtml.includes(`data-contract-style="${style.id}"`));
    assert.match(html, /data-contract-appendix="estimate" data-appendix-number="1" data-pdf-break-before/);
    assert.match(html, /white-space:nowrap;">3 000 ₽/);
    assert.match(actHtml, /^<article[^>]+data-pdf-content-end/);
    assert.match(actHtml, /data-pdf-keep-with-previous/);
    assert.doesNotMatch(html, /data-document-kind="acceptance/);
  }
  assert.equal(new Set(contracts).size, 1, 'styling does not modify contract text or financial values');
  assert.equal(new Set(acts).size, 1, 'the same style choices preserve act content');
  assert.equal(new Set(headers).size, 1, 'the candidate uses one consistent document header');
  for (const style of CONTRACT_STYLES) {
    assert.match(contractHtml({ ...template(), style: style.id }, fields, est), /font-size:12px;line-height:1\.4/);
  }
});

test('removed legacy styles fall back to the firm style without changing edited documents', () => {
  for (const style of ['strict', 'compact']) {
    const source = { ...template(), style, preamble: 'Моё вступление', sections: [{ id: 'custom', title: 'Мои условия', text: 'Редактируемый текст' }] };
    const migrated = normalizeContractTemplate(source);
    assert.equal(migrated.style, 'magic');
    assert.deepEqual(migrated.sections, source.sections);
    assert.equal(migrated.preamble, source.preamble);
    assert.match(contractHtml(migrated, contractDraftFields(draft()), est), /data-contract-style="magic"/);
  }
});

test('room and drawing appendices follow the contract style while independent estimate preferences remain intact', () => {
  for (const [style, expected, independent] of [['magic', 'brand', 'modern'], ['accent', 'brand', 'modern']]) {
    for (const type of ['perRoom', 'totalDraw']) {
      const tpl = template();
      tpl.style = style;
      tpl.head.estimateTemplate = estimatePresetTemplate(independent, { showItemPhotos: false });
      tpl.appendices[0].exportOptions.type = type;
      const before = JSON.stringify(tpl.head.estimateTemplate);
      const html = contractHtml(tpl, contractDraftFields(draft()), est, undefined, undefined, { rooms: [{ id: 'r', name: 'Кухня', area: 12, est }] });
      assert.match(html, new RegExp(`<article[^>]+data-estimate-preset="${expected}"`));
      assert.doesNotMatch(html, new RegExp(`<article[^>]+data-estimate-preset="${independent}"`));
      assert.match(html, /data-estimate-grand-total>3\s000 ₽/);
      assert.equal(JSON.stringify(tpl.head.estimateTemplate), before);
    }
  }
});

test('company phone and table quantities remain whole while addresses and names can wrap naturally', () => {
  const phone = '+7 (924) 123-45-40';
  for (const style of CONTRACT_STYLES) {
    const tpl = normalizeContractTemplate({ ...template(), style: style.id, head: { company: 'Компания <А>', companyAddress: 'Владивосток, улица <Русская>, 44', phone } });
    const html = contractHtml(tpl, contractDraftFields(draft()), est);
    const header = html.match(/<header[\s\S]*?<\/header>/)[0];
    assert.match(header, /<span class="contract-brand-detail contract-brand-phone" style="white-space:nowrap">\+7 \(924\) 123-45-40<\/span>/);
    assert.match(header, /Владивосток, улица &lt;Русская&gt;, 44/);
    assert.match(header, /Компания &lt;А&gt;/);
    assert.match(html, /<thead><tr[\s\S]*?<\/tr><\/thead>\s*<tbody>/);
    assert.match(html, /<td[^>]*white-space:nowrap[^>]*>12<\/td>/);
    assert.match(html, /contract-requisites no-split" data-pdf-keep-with-previous/);
  }
});

test('the agreement contains its estimate and custom appendices on following pages with the act kept separate', () => {
  const tpl = template();
  tpl.appendices.unshift({ id: 'extra', kind: 'text', title: 'Технические условия', text: 'Описание' });
  const html = contractHtml(tpl, contractDraftFields(draft()), est);
  const estimateStart = html.indexOf('data-contract-appendix="estimate"');
  const customStart = html.indexOf('data-contract-appendix="text"');
  assert.ok(html.indexOf('<section class="contract-requisites') < estimateStart);
  assert.ok(estimateStart < customStart);
  assert.match(html, /data-contract-appendix="estimate" data-appendix-number="1" data-pdf-break-before/);
  assert.match(html, /data-contract-appendix="text" data-appendix-number="3" data-pdf-break-before/);
  assert.ok(html.lastIndexOf('data-pdf-content-end') > customStart, 'the final content marker includes every appendix');
  assert.match(html, /<div data-contract-packet-end data-pdf-content-end><\/div><\/div>$/);
  assert.match(plain(html), /Смета \(Приложение №1\)/);
  assert.doesNotMatch(html, /Спецификация|data-contract-appendix="act"|data-document-kind="acceptance|Приложение №2 — Акт выполненных работ/);
  tpl.appendices = [];
  const text = plain(contractHtml(tpl, contractDraftFields(draft()), est));
  assert.doesNotMatch(text, /Приложение №1|Приложение №2/);
});

test('the editable preamble preserves custom text, escapes values and can be explicitly removed', () => {
  assert.doesNotMatch(normalizeContractTemplate().preamble, /представительство_заказчика/);
  assert.equal(normalizeContractTemplate({ preamble: '{клиент}{представительство_заказчика} заключает договор' }).preamble, '{клиент} заключает договор');
  const tpl = normalizeContractTemplate({ head: { legal: 'ИП <Пример>' }, preamble: '{исполнитель} заключает договор с {клиент}. <Дополнение>' });
  const value = draft();
  value.party.client = 'Заказчик <А>';
  const html = contractHtml(tpl, contractDraftFields(value), est);
  assert.match(html, /ИП &lt;Пример&gt; заключает договор с Заказчик &lt;А&gt;\. &lt;Дополнение&gt;/);
  assert.doesNotMatch(html, /<Дополнение>/);
  assert.equal(normalizeContractTemplate({ preamble: '' }).preamble, '');
  assert.doesNotMatch(contractHtml({ ...tpl, preamble: '' }, contractDraftFields(value), est), /заключает договор с/);
});

test('the standalone blank act renders edited sections with escaped party values and empty acceptance fields', () => {
  const tpl = template();
  tpl.actSections = [{ id: 'custom-act', title: 'Особые условия <акта>', text: 'Условия для {клиент} по договору {номер_договора}: <проверка>\nРаботы: {работы_акта}\nПриёмка: {результат_приёмки}\nЗамечания: {замечания_акта}\nСрок: {срок_устранения}' }];
  const value = draft();
  value.party.client = 'Заказчик <А>';
  const blank = acceptanceHtml(tpl, contractDraftFields(value), { blank: true });
  assert.match(blank, /Особые условия &lt;акта&gt;/);
  assert.match(blank, /Условия для Заказчик &lt;А&gt; по договору 13-11\/2026-1: &lt;проверка&gt;/);
  assert.match(blank, /Работы: _+\nПриёмка: _+\nЗамечания: _+\n_+\n_+\nСрок: _+/);
  assert.doesNotMatch(blank, /<проверка>|Работы приняты|выполнены работы|18\.11\.2026/);
});

test('three default act sections identify parties, acceptance and actual work cost without repeating payment data', () => {
  const tpl = template();
  assert.deepEqual(tpl.actSections.map(section => section.title), ['Выполненные работы', 'Сдача и приёмка работ', 'Стоимость выполненных работ']);
  assert.match(tpl.actSections[0].text, /Исполнитель: \{исполнитель\}/);
  assert.match(tpl.actSections[0].text, /Заказчик: \{клиент\}/);
  for (const token of ['номер_договора', 'дата_договора', 'адрес', 'работы_акта', 'дата_завершения']) assert.ok(tpl.actSections[0].text.includes('{' + token + '}'));
  assert.match(tpl.actSections[1].text, /Замечания при приёмке \(при наличии\):\n\{замечания_акта\}/);
  assert.match(tpl.actSections[1].text, /Срок устранения замечаний: \{срок_устранения\}/);
  assert.match(tpl.actSections[1].text, /скрытых недостатков/);
  assert.match(tpl.actSections[2].text, /\{сумма_акта\} ₽/);
  const text = tpl.actSections.map(section => section.text).join('\n');
  assert.doesNotMatch(text, /\{сумма\}|\{оплата_акта\}|\{остаток_акта\}|в полном объёме|в срок|подтверждением оплаты/);
  const html = acceptanceHtml(tpl, contractDraftFields(draft()), { total: 2000, paid: 500, scope: 'Гостиная', acceptance: 'none' });
  assert.match(html, /Стоимость выполненных работ по акту: 2\s000 ₽/);
  assert.doesNotMatch(html, /3\s000 ₽|500 ₽|Полученная оплата|Остаток по акту/);
});

test('exact four-section standard acts migrate even after editable save, with older two-section standards still recognized', () => {
  assert.equal(PRESERVED_OLD_ACT_SECTIONS.length, 4);
  for (const actBodyEditable of [true, false]) {
    const old = structuredClone(PRESERVED_OLD_ACT_SECTIONS), before = JSON.stringify(old);
    const migrated = normalizeContractTemplate({ actSections: old, actBodyEditable });
    assert.deepEqual(migrated.actSections, DEFAULT_ACT_SECTIONS);
    assert.equal(JSON.stringify(old), before);
    assert.deepEqual(normalizeContractTemplate(JSON.parse(JSON.stringify(migrated))).actSections, DEFAULT_ACT_SECTIONS);
  }
  const legacyResult = ['По договору № {номер_договора} от {дата_договора} выполнены работы по адресу: {адрес}.\n{работы_акта}', 'Работы по договору № {номер_договора} от {дата_договора} по адресу: {адрес}:\n{работы_акта}'];
  for (const text of legacyResult) {
    const migrated = normalizeContractTemplate({ actBodyEditable: true, actSections: [{ id: 'act-result', title: 'Результат работ', text }, { id: 'act-acceptance', title: 'Приёмка', text: '{результат_приёмки}\n{замечания_акта}\n{срок_устранения}' }] });
    assert.deepEqual(migrated.actSections, DEFAULT_ACT_SECTIONS);
  }
});

test('custom, reordered, deleted, empty and extended act sections remain exactly as saved', () => {
  const old = structuredClone(PRESERVED_OLD_ACT_SECTIONS);
  const variants = [
    old.map((section, index) => index === 0 ? { ...section, text: section.text + '\nНаш текст' } : section),
    [...old].reverse(), old.slice(0, 3), [],
    [{ id: 'custom', title: 'Наши условия', text: 'Свой текст {клиент}' }],
    old.map((section, index) => index === 0 ? { ...section, customNote: 'Сохранить' } : section),
  ];
  for (const actBodyEditable of [true, false]) for (const sections of variants) {
    const before = JSON.stringify(sections);
    const migrated = normalizeContractTemplate({ actSections: sections, actBodyEditable });
    assert.deepEqual(migrated.actSections, sections);
    assert.deepEqual(normalizeContractTemplate(JSON.parse(JSON.stringify(migrated))).actSections, sections);
    assert.equal(JSON.stringify(sections), before);
  }
});

test('both act forms render only edited body sections and do not append hidden text or invent unknown payments', () => {
  const tpl = template();
  tpl.actSections = [{ id: 'body', title: 'Текст <мастерской>', text: 'Наш акт для {клиент}. Завершение: {дата_завершения}\nРаботы: {работы_акта}\nПриёмка: {результат_приёмки}\nСтоимость: {сумма_акта} ₽; получено: {оплата_акта}; остаток: {остаток_акта}' }];
  const fields = contractDraftFields(draft());
  const filled = acceptanceHtml(tpl, fields, { number: 'А-8', date: '2026-11-20', completionDate: '2026-11-19', scope: 'Монтаж кухни', acceptance: 'none', total: '3000,50', paid: '' });
  const blank = acceptanceHtml(tpl, fields, { blank: true });
  for (const html of [filled, blank]) {
    assert.match(html, /Текст &lt;мастерской&gt;/);
    assert.match(html, /Наш акт для Анна Пример/);
    assert.match(html, /получено: _+; остаток: _+/);
    assert.doesNotMatch(html, /Оформление акта не является подтверждением оплаты|Дата фактического завершения работ:|Стоимость работ по акту:/);
    assert.equal((html.match(/Наш акт для/g) || []).length, 1);
  }
  assert.match(filled, /Завершение: 19\.11\.2026/);
  assert.match(filled, /Стоимость: 3 000,5 ₽/);
  assert.match(blank, /Завершение: _+/);
  const explicitZero = acceptanceHtml(tpl, fields, { number: 'А-8', date: '2026-11-20', completionDate: '2026-11-19', scope: 'Монтаж кухни', acceptance: 'none', total: 3000, paid: 0 });
  assert.match(explicitZero, /получено: 0 ₽; остаток: 3 000 ₽/);
});

test('the completed act uses agreement fields but stays separate from the agreement HTML and saved old HTML', () => {
  const tpl = template(), value = draft();
  tpl.actSections[0].text += '\nИсполнитель: {исполнитель}';
  const savedAct = { number: 'А-7', date: '2026-11-20', completionDate: '2026-11-19', acceptance: 'remarks', remarks: 'Исправить <примыкание>', remedyDate: '2026-11-24', scope: 'Монтаж кухни 12 м²', total: '3 000,50', paid: '1500,25', html: 'obsolete-act-html', contract: { html: 'old-contract' }, versions: [{ html: 'old-act' }] };
  const snapshot = createContractSnapshot({ draft: value, template: tpl, est, actDraft: savedAct });
  const standalone = createActSnapshot({ contract: snapshot, act: snapshot.actDraft, template: tpl });
  assert.doesNotMatch(snapshot.html, /data-document-kind="acceptance|Приложение №2 — Акт|Монтаж кухни 12 м²|Исправить &lt;примыкание&gt;|Работы приняты с замечаниями/);
  assert.match(standalone.html, /19\.11\.2026/);
  assert.match(standalone.html, /24\.11\.2026/);
  assert.match(standalone.html, /Работы приняты с замечаниями/);
  assert.match(standalone.html, /Исправить &lt;примыкание&gt;/);
  assert.match(standalone.html, /Исполнитель: ИП Пример/);
  assert.match(standalone.html, /Анна Пример/);
  assert.match(standalone.html, /К договору № 13-11\/2026-1 от 13\.11\.2026/);
  assert.doesNotMatch(snapshot.html, /acceptance-blank|obsolete-act-html|old-contract|old-act/);
  assert.equal(snapshot.actDraft.html, undefined);
  assert.equal(snapshot.actDraft.contract, undefined);
  assert.equal(snapshot.actDraft.versions, undefined);
  savedAct.scope = 'Другая работа';
  assert.equal(snapshot.actDraft.scope, 'Монтаж кухни 12 м²');
  assert.match(standalone.html, /^<article[^>]+data-pdf-content-end/);
  assert.doesNotMatch(standalone.html, /<footer[^>]+data-pdf-content-end/);
  const blank = createContractSnapshot({ draft: value, template: tpl, est });
  assert.equal(blank.html, snapshot.html, 'saved act details do not alter the agreement preview or PDF');
  assert.equal(blank.actDraft, null);
});

test('normalization preserves customised contract and act text without sharing mutable defaults', () => {
  const first = normalizeContractTemplate({ sections: [{ id: 'custom', title: 'Мой пункт', text: 'Мой текст' }], actSections: [{ id: 'custom-act', title: 'Мой акт', text: 'Условия акта' }], settings: { prepayPercent: 35 } });
  assert.equal(first.sections[0].text, 'Мой текст');
  assert.equal(first.actSections[0].text, 'Условия акта');
  assert.equal(first.settings.prepayPercent, 35);
  first.sections[0].text = 'Изменение';
  first.actSections[0].text = 'Изменение';
  assert.notEqual(normalizeContractTemplate().sections[0].text, 'Изменение');
  assert.notEqual(normalizeContractTemplate().actSections[0].text, 'Изменение');
});

test('the standard warranty is ordinary editable text without an invented duration or settings tokens', () => {
  const tpl = template();
  const section = tpl.sections.find(section => section.id === 's6');
  assert.match(section.text, /Исполнитель гарантирует качество монтажных работ/);
  assert.match(section.text, /по условиям изготовителя/);
  assert.doesNotMatch(section.text, /\{гарантия_|\d+\s*(?:лет|мес|год)/);
  const first = contractHtml(tpl, contractDraftFields(draft()), est);
  tpl.settings.warrantyWorksMonths = 99;
  tpl.settings.warrantyMaterials = 'Скрытая настройка';
  assert.equal(contractHtml(tpl, contractDraftFields(draft()), est), first);
});

test('the exact former standard warranty materializes configured values once and retains them on reopening', () => {
  const oldText = '{гарантия_монтажа} Условия гарантии на материалы: {гарантия_материалов}. Порядок обращения по недостаткам и ответственность сторон определяются договором и применимыми требованиями законодательства РФ.';
  const source = template();
  source.sections = source.sections.map(section => section.id === 's6' ? { ...section, text: oldText } : section);
  source.settings.warrantyWorksMonths = 24;
  source.settings.warrantyMaterials = 'Условия изготовителя <плёнки>';
  const migrated = normalizeContractTemplate(source);
  const section = migrated.sections.find(section => section.id === 's6');
  assert.match(section.text, /24 мес\./);
  assert.match(section.text, /Условия изготовителя <плёнки>/);
  assert.doesNotMatch(section.text, /\{гарантия_/);
  migrated.settings.warrantyWorksMonths = 99;
  migrated.settings.warrantyMaterials = 'Другая гарантия';
  const reopened = normalizeContractTemplate(JSON.parse(JSON.stringify(migrated)));
  assert.equal(reopened.sections.find(section => section.id === 's6').text, section.text);
  const html = contractHtml(reopened, contractDraftFields(draft()), est);
  assert.match(html, /24 мес\./);
  assert.match(html, /Условия изготовителя &lt;плёнки&gt;/);
  assert.doesNotMatch(html, /99 мес\.|Другая гарантия|\{гарантия_/);
});

test('warranty migration leaves manually edited contract sections unchanged', () => {
  const sections = [{ id: 's6', title: 'Качество и гарантия', text: 'Гарантия на монтаж — 8 месяцев по согласованию сторон.' }];
  const tpl = normalizeContractTemplate({ sections, settings: { warrantyWorksMonths: 24, warrantyMaterials: 'Другие условия' } });
  assert.deepEqual(tpl.sections, sections);
});

test('legacy custom warranty placeholders retain their rendered values without rewriting the custom text', () => {
  const sections = [{ id: 'custom-warranty', title: 'Условия гарантии мастерской', text: 'Наши условия: {гарантия_монтажа}\nМатериалы: {гарантия_материалов}' }];
  const tpl = normalizeContractTemplate({ sections, settings: { warrantyWorksMonths: 24, warrantyMaterials: 'Условия производителя <А>' } });
  assert.deepEqual(tpl.sections, sections);
  const html = contractHtml(tpl, contractDraftFields(draft()), est);
  assert.match(html, /Наши условия: Дополнительная гарантия на монтажные работы — 24 мес\./);
  assert.match(html, /Материалы: Условия производителя &lt;А&gt;/);
  assert.doesNotMatch(html, /Наши условия: _+|Материалы: _+|\{гарантия_/);
});

test('snapshots freeze independent copies of the template, estimate and document context', () => {
  const tpl = template(), value = draft(), estimate = structuredClone(est);
  tpl.head.sign = 'old-signature';
  tpl.head.signature = 'old-signature';
  const snapshot = createContractSnapshot({ draft: value, template: tpl, est: estimate, documentContext: { project: { name: 'Объект', contract: { html: 'old-contract', versions: [{ html: 'older-contract' }] }, ops: ['history'] }, rooms: [{ id: 1, name: 'Кухня', v: [[0, 0], [3, 0], [3, 4]], est: { mats: [] }, history: ['old-points'] }] } });
  const html = snapshot.html;
  tpl.sections[0].text = 'Новый шаблон';
  estimate.mats[0].p = 999;
  value.party.client = 'Другое имя';
  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.frozen, true);
  assert.equal(snapshot.date, '2026-11-13');
  assert.equal(snapshot.party.client, 'Анна Пример');
  assert.equal(snapshot.est.mats[0].p, 100);
  assert.equal(snapshot.html, html);
  assert.equal(snapshot.template.head.sign, undefined);
  assert.equal(snapshot.template.head.signature, undefined);
  assert.equal(snapshot.documentContext.project.contract, undefined);
  assert.equal(snapshot.documentContext.project.ops, undefined);
  assert.equal(snapshot.documentContext.rooms[0].history, undefined);
  assert.deepEqual(snapshot.documentContext.rooms[0].v, [[0, 0], [3, 0], [3, 4]]);
});

test('act uses the frozen contract reference and keeps remarks distinct from acceptance without remarks', () => {
  const contract = createContractSnapshot({ draft: draft(), template: template(), est });
  const act = { number: 'А-1', date: '2026-11-19', completionDate: '2026-11-18', acceptance: 'remarks', remarks: 'Исправить примыкание', remedyDate: '2026-11-23', scope: 'Монтаж потолков, кухня 12 м²', total: '3000', paid: '' };
  const snapshot = createActSnapshot({ contract, act, template: { head: { company: 'Другая компания' } }, est: { mats: [], works: [] } });
  assert.equal(snapshot.contractNumber, contract.number);
  assert.equal(snapshot.contractDate, contract.date);
  assert.match(snapshot.html, /ИП Пример/);
  assert.doesNotMatch(snapshot.html, /Другая компания|Претензий нет|class="estimate-signature/);
  assert.match(snapshot.html, /Исправить примыкание/);
  assert.match(snapshot.html, /23\.11\.2026/);
  assert.match(snapshot.html, /13\.11\.2026/);
  assert.match(snapshot.html, /Приложение №2 — Акт выполненных работ/);
  assert.equal(snapshot.paid, null, 'unknown receipt is not invented as zero');
});

test('an explicitly supplied current act template overrides captured text and settings while retaining agreement parties', () => {
  const previous = template();
  previous.actSections = [{ id: 'old', title: 'Старый акт', text: 'Старый текст акта' }];
  const contract = createContractSnapshot({ draft: draft(), template: previous, est });
  const current = template();
  current.head.legal = 'Другая компания';
  current.actSections = [{ id: 'current', title: 'Текущий акт', text: 'Актуальный текст для {клиент}; договор № {номер_договора} от {дата_договора}' }];
  current.settings.warrantyWorksMonths = 18;
  const act = { number: 'А-2', date: '2026-11-19', completionDate: '2026-11-18', acceptance: 'none', scope: 'Монтаж потолков', total: 3000, paid: '' };
  const snapshot = createActSnapshot({ contract, act, template: current });
  assert.match(snapshot.html, /Актуальный текст для Анна Пример/);
  assert.doesNotMatch(snapshot.html, /Старый текст акта|Другая компания/);
  assert.match(snapshot.html, /ИП Пример/);
  assert.match(snapshot.html, /договор № 13-11\/2026-1 от 13\.11\.2026/);
  assert.equal(snapshot.template.settings.warrantyWorksMonths, 18);
  assert.equal(snapshot.contractNumber, contract.number);
  assert.equal(snapshot.party.client, contract.party.client);
  const fallback = createActSnapshot({ contract, act });
  assert.match(fallback.html, /Старый текст акта/);
});

test('act validation permits handwritten acceptance and remarks while still rejecting provided invalid deadlines', () => {
  const act = { number: 'А-1', date: '2026-11-19', completionDate: '2026-11-18', scope: 'Монтаж', total: 3000, acceptance: '' };
  assert.deepEqual(validateActDraft(act), {});
  assert.ok(validateActDraft({ ...act, acceptance: 'unknown' }).acceptance);
  act.acceptance = 'remarks';
  assert.deepEqual(validateActDraft(act), {});
  assert.ok(validateActDraft({ ...act, remedyDate: '2026-99-99' }).remedyDate);
  assert.ok(validateActDraft({ ...act, remedyDate: '2026-11-18' }).remedyDate);
  act.remarks = 'Исправить примыкание';
  act.remedyDate = '2026-11-23';
  assert.deepEqual(validateActDraft(act), {});
  assert.doesNotMatch(acceptanceHtml(template(), contractDraftFields(draft()), {}), /Замечаний нет|Претензий нет/);
});


test('acceptance remarks stay writable on site and selected acceptance does not erase typed remarks', () => {
  const tpl = template(), fields = contractDraftFields(draft());
  const blankRemarks = acceptanceHtml(tpl, fields, { scope: 'Гостиная', acceptance: 'none', total: 3000 });
  assert.match(blankRemarks, /Результат работ принят Заказчиком\./);
  assert.match(blankRemarks, /Замечания при приёмке \(при наличии\):\n_+\n_+\n_+\nСрок устранения замечаний: _+/);
  assert.doesNotMatch(blankRemarks, /без замечаний|без заявленных|замечаний нет|не указаны|не указан|не рассчитан/);
  const typed = acceptanceHtml(tpl, fields, { scope: 'Гостиная', acceptance: 'none', remarks: 'Исправить <стык>', remedyDate: '2026-11-24', total: 3000 });
  assert.match(typed, /Исправить &lt;стык&gt;/);
  assert.match(typed, /Срок устранения замечаний: 24\.11\.2026/);
  assert.equal((typed.match(/Срок устранения замечаний:/g) || []).length, 1);
});

test('legacy custom payment tokens retain true zero amounts and unknown values become writing lines', () => {
  const tpl = normalizeContractTemplate({ actBodyEditable: true, actSections: [{ id: 'custom', title: 'Наш акт', text: 'Работы: {работы_акта}\nПриёмка: {результат_приёмки}\nСтоимость: {сумма_акта}; оплата: {оплата_акта}; остаток: {остаток_акта}' }] });
  const fields = { ...contractDraftFields(draft()), сумма: '' };
  const unknown = acceptanceHtml(tpl, fields, { paid: '' });
  assert.match(unknown, /Работы: _+\nПриёмка: _+\nСтоимость: _+; оплата: _+; остаток: _+/);
  assert.doesNotMatch(unknown, /не указан|не рассчитан|не заполнен/);
  const zero = acceptanceHtml(tpl, fields, { total: 0, paid: 0 });
  assert.match(zero, /Стоимость: 0; оплата: 0 ₽; остаток: 0 ₽/);
});
