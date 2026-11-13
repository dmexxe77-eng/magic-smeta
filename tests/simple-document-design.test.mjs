import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_STYLES, contractHtml, acceptanceHtml, normalizeContractTemplate } from '../src/data/contract.js';
import { ESTIMATE_PRESETS, ESTIMATE_FONTS, estimatePresetTemplate } from '../src/utils/estimate-template.js';
import { estimateHtml } from '../src/utils/estimate-html.js';
import { contractHtml as previousContract, acceptanceHtml as previousAct } from './fixtures/preserved-documents/src/data/contract.js';
import { estimateHtml as previousEstimate } from './fixtures/preserved-documents/src/utils/estimate-html.js';

const est = { mats: [{ n: 'Профиль', q: 12.6, p: 100, u: 'м.п.' }], works: [{ n: 'Монтаж', q: 1, p: 2000, u: 'компл.' }] };
const fields = { номер: '12/26', дата: '2026-11-13', клиент: 'Иванов Алексей Сергеевич', адрес: 'Хабаровск, ул. Примерная, дом 12', телефон: '+7 (999) 123-45-67', сумма: 3260, площадь: 12.6, предоплата: 1630, остаток: 1630, дата_начала: '2026-11-14', срок_монтажа: '2026-11-15' };
const company = { company: 'Студия потолков', legal: 'ИП Пример', inn: '123456789012', companyAddress: 'Офис, 10', address: 'Адрес регистрации, 20', phone: '+7 (999) 000-00-40' };
const plain = html => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('the candidate exposes one calm family for contract, act and estimate', () => {
  assert.deepEqual(CONTRACT_STYLES.map(style => style.id), ['magic']);
  assert.deepEqual(ESTIMATE_PRESETS.map(style => style.id), ['brand']);
  const contract = CONTRACT_STYLES[0], estimate = estimatePresetTemplate('brand');
  assert.equal(contract.background, '#FFFFFF');
  assert.equal(estimate.background, contract.background);
  assert.equal(estimate.sectionColor, contract.accent);
  assert.equal(ESTIMATE_FONTS.find(font => font.id === estimate.font).css, contract.font);
  const html = contractHtml({ head: company }, fields, est);
  assert.match(html, /font-size:12px;line-height:1\.4/);
  assert.match(html, /border-left:4px solid #1461EE;border-radius:6px;padding:14px 16px/);
  assert.doesNotMatch(html, /background:#1A3A5C|border:1px solid #1A3A5C/);
  assert.match(html, /background:#E7EFFD;color:#214D7B/);
  assert.match(html, /margin-bottom:26px/);
  assert.match(html, /<h2 style="font-size:20px;text-align:center;font-weight:800;line-height:1\.25/);
});

test('legacy company descriptions are retained in data but never appear in document headers', () => {
  const companyWithLegacy = { ...company, description: 'ппп LEGACY HEADER' };
  const template = { head: companyWithLegacy };
  const before = JSON.stringify(template);
  for (const html of [contractHtml(template, fields, est), acceptanceHtml(template, fields), estimateHtml({ company: companyWithLegacy, est })]) {
    assert.doesNotMatch(html, /ппп LEGACY HEADER|estimate-company-description/);
  }
  assert.equal(JSON.stringify(template), before);
});

test('edited text, financial values and separate document boundaries match the preserved version', () => {
  const template = { style: 'accent', head: company, actBodyEditable: true, actSections: [{ id: 'custom-act', title: 'Наш акт', text: 'Результат: {работы_акта}. Стоимость: {сумма_акта} ₽.' }], appendices: [{ id: 'estimate', kind: 'estimate', exportOptions: { type: 'total', columnsDefaultsVersion: 1, cols: { num: false, photo: false } } }], preamble: 'Исполнитель {исполнитель} и Заказчик {клиент}.', sections: [{ id: 'custom', title: 'Мои условия', text: 'Стоимость {сумма} ₽. Объект: {адрес}.' }] };
  const before = JSON.stringify(template);
  const act = { number: 'А-12', date: '2026-11-15', scope: 'Монтаж потолка', completionDate: '2026-11-15', acceptance: 'none', total: 3260, paid: 1630 };
  const html = contractHtml(template, fields, est);
  const withoutCompanyHeaders = source => source.replace(/<header class="contract-brand[^>]*>[\s\S]*?<\/header>/g, '').replace(/<section class="contract-signatures[^>]*>[\s\S]*?<\/section>/g, '');
  assert.equal(plain(withoutCompanyHeaders(html)), plain(withoutCompanyHeaders(previousContract(template, fields, est))), 'all editable body text, requisites and financial tables remain identical');
  const actHtml = acceptanceHtml(template, fields, act);
  const sectionCount = normalizeContractTemplate(template).actSections.length;
  const previousParagraphs = [...previousAct(template, fields, act).matchAll(/<p(?: [^>]*)?>([\s\S]*?)<\/p>/g)].map(match => plain(match[1])).slice(-sectionCount);
  const editedParagraphs = [...actHtml.matchAll(/data-act-section="[^"]*"><h3[^>]*>[\s\S]*?<\/h3><p>([\s\S]*?)<\/p>/g)].map(match => plain(match[1]));
  assert.deepEqual(editedParagraphs, previousParagraphs, 'every editable legal and financial paragraph is preserved when the act layout changes');
  assert.match(html, /data-contract-appendix="estimate"[^>]+data-pdf-break-before/);
  assert.match(html, /contract-requisites no-split" data-pdf-keep-with-previous/);
  assert.match(html, /data-pdf-content-end/);
  assert.match(html, /white-space:nowrap;">3\s260 ₽/);
  assert.equal(normalizeContractTemplate(template).style, 'magic');
  assert.equal(JSON.stringify(template), before);
});

test('standalone estimates use the same family without changing stored appearance or column visibility', () => {
  const saved = { formatVersion: 2, background: '#FF0000', font: 'times', showLogo: false, showDetails: false, showItemPhotos: false, stripedRows: true };
  const before = JSON.stringify(saved);
  const input = { company: { ...company, logo: 'data:image/png;base64,AA==', estimateTemplate: saved }, est, cols: { photo: true }, adjustment: { percent: 5, scope: 'works' } };
  const html = estimateHtml(input);
  assert.match(html, /data-estimate-preset="brand"/);
  assert.match(html, /--estimate-font-family:&#39;Manrope&#39;,Arial,sans-serif/);
  assert.match(html, /--estimate-table-bg:#E7EFFD/);
  assert.match(html, /<h1>Коммерческое предложение<\/h1>/);
  assert.doesNotMatch(html, /estimate-company-logo"|data-company-address>|class="estimate-item-photo"/);
  assert.match(html, /--estimate-stripe-bg:#F7F8FA/);
  const withoutHeader = source => source.replace(/<header class="estimate-header no-split">[\s\S]*?<\/header>/, '');
  assert.equal(plain(withoutHeader(html)), plain(withoutHeader(previousEstimate(input))), 'all table rows, quantities, corrections and summary amounts remain identical');
  assert.equal(JSON.stringify(saved), before);
});

test('room and drawing appendices use the single family with non-splitting table rows and totals', () => {
  for (const type of ['perRoom', 'totalDraw']) {
    const template = normalizeContractTemplate({ style: 'accent', head: company });
    template.appendices[0].exportOptions.type = type;
    const html = contractHtml(template, fields, est, undefined, undefined, { rooms: [{ id: 'r', name: 'Гостиная', area: 12.6, est }] });
    assert.match(html, /data-estimate-preset="brand"/);
    assert.doesNotMatch(html, /data-estimate-preset="modern"/);
    assert.match(html, /data-pdf-keep-with-previous/);
    assert.match(html, /data-estimate-grand-total>3\s260 ₽/);
  }
});


test('the framed company header and centered commercial offer keep project details compact and complete', () => {
  const object = 'Хабаровск, ул. Мира, дом 12';
  const html = estimateHtml({ project: { name: object, address: object, client: 'Иванов Алексей Константинович', phone: '+7 (999) 000-00-40' }, company: { ...company, email: 'hello@example.test' }, est, rooms: [{ area: 12.6 }, { area: 8 }, { area: 3 }] });
  const header = html.match(/<header class="estimate-header no-split">([\s\S]*?)<\/header>/)[1];
  assert.match(html, /h1\{font-size:20px;line-height:1\.25;text-align:center/);
  assert.match(html, /border-left:4px solid #1461EE;border-radius:6px;padding:14px 16px/);
  assert.match(html, /\.estimate-company-phone\{white-space:nowrap\}/);
  assert.match(header, /data-estimate-project-name>Хабаровск, ул. Мира, дом 12<\/p>/);
  assert.doesNotMatch(header, /<dl|<dt|data-estimate-project-address>/);
  assert.match(header, /Заказчик: Иванов Алексей Константинович/);
  assert.match(header, /hello@example.test/);
  assert.match(header, /data-estimate-room-count="3">3 помещения/);
  assert.match(header, /data-estimate-area="23.6">23,6 м²/);
  assert.match(header, /data-estimate-type="total">Общая смета/);
});

test('an absent client or repeated address never produces empty project lines or a fake customer', () => {
  for (const project of [{ name: '  Объект на Мира, 12 ', address: 'объект  на Мира, 12', client: '—' }, { address: 'Единственный адрес' }]) {
    const html = estimateHtml({ project, est });
    const card = html.match(/data-estimate-project>(.*?)<\/section>/s)[1];
    assert.doesNotMatch(card, /data-estimate-project-address>|data-estimate-project-customer>|—|<dl/);
    assert.match(card, /data-estimate-project-name>/);
  }
});


test('the act uses a large centered title and structured editable sections without hiding custom wording', () => {
  const template = normalizeContractTemplate({ head: company, actBodyEditable: true, actSections: [
    { id: 'act-result', title: 'Результат для {клиент}', text: 'Мой текст результата: {работы_акта}.' },
    { id: 'custom-acceptance', title: 'Особые условия', text: 'Заказчик проверил: {результат_приёмки}' },
    { id: 'act-costs', title: 'Мои расчёты', text: 'К оплате по акту: {сумма_акта} ₽. Получено: {оплата_акта}.' },
  ] });
  const before = JSON.stringify(template);
  const html = acceptanceHtml(template, fields, { number: 'А-12', date: '2026-11-15', scope: 'Гостиная', acceptance: 'none', total: 3260, paid: 1000 });
  assert.match(html, /<p class="contract-act-kicker">Приложение №2<\/p><h2>АКТ ВЫПОЛНЕННЫХ РАБОТ № А-12<\/h2>/);
  assert.match(html, /\.contract-act-title h2\{font-size:20px;line-height:1\.25;text-align:center/);
  assert.match(html, /<h2>АКТ ВЫПОЛНЕННЫХ РАБОТ № А-12<\/h2>/);
  assert.match(html, /Город: ____________<\/span><span>15\.11\.2026/);
  assert.doesNotMatch(html, /contract-act-meta[^<]*<span>[^<]*Акт №/);
  assert.match(html, /К договору № 12\/26 от 13\.11\.2026/);
  assert.equal((html.match(/data-act-section=/g) || []).length, 3);
  assert.match(html, /<h3[^>]*>Результат для Иванов Алексей Сергеевич<\/h3>/);
  assert.match(html, /<h3[^>]*>Особые условия<\/h3>/);
  assert.doesNotMatch(html, /<h3[^>]*>\d+\./);
  assert.match(html, /Мой текст результата: Гостиная\./);
  assert.match(html, /К оплате по акту: 3\s260 ₽\. Получено: 1\s000 ₽\./);
  assert.match(html, /class="contract-act-section contract-act-costs"/);
  assert.match(html, /contract-requisites no-split" data-pdf-keep-with-previous/);
  assert.doesNotMatch(html, /скрытых недостатков|class="estimate-signature/);
  assert.equal(JSON.stringify(template), before);
});


test('all three documents share the pale branded header with contacts on the left and compact legal identity on the right', () => {
  const details = { ...company, legalForm: 'ip', ogrn: '123456789012345', kpp: '123456789', email: 'hello@example.test', logo: 'data:image/png;base64,AA==' };
  for (const html of [contractHtml({ head: details }, fields, est), acceptanceHtml({ head: details }, fields), estimateHtml({ company: details, est })]) {
    assert.match(html, /background:#EFF5FF/);
    assert.match(html, /border-left:4px solid #1461EE/);
    assert.match(html, /border-left:1px solid #D5E3F5/);
    assert.match(html, /padding-left:16px/);
    assert.match(html, /font-size:9.5px;line-height:1.3/);
    assert.match(html, /hello@example.test/);
    assert.match(html, /ИНН 123456789012/);
    const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/)[1];
    assert.doesNotMatch(header, /ОГРН|КПП|123456789012345/);
    assert.match(html, /font-size:20px;line-height:1.1|font-size:20px;font-weight:800;line-height:1.1/);
    assert.doesNotMatch(html, /border:1px solid #C9D9F0/);
  }
  const contractHeader = contractHtml({ head: details }, fields, est).match(/<header class="contract-brand[^>]*>([\s\S]*?)<\/header>/)[1];
  assert.match(contractHtml({ head: details }, fields, est), /ОГРНИП 123456789012345/);
  assert.match(acceptanceHtml({ head: details }, fields), /КПП 123456789/);
  assert.ok(contractHeader.indexOf('contract-brand-details') < contractHeader.indexOf('ИНН 123456789012'));
  assert.match(contractHeader, /contract-brand-copy[\s\S]*?Офис, 10[\s\S]*?hello@example.test<\/span><\/div><\/div><\/div><div class="contract-brand-legal"/);
  const estimateHeader = estimateHtml({ company: details, est }).match(/data-estimate-company>([\s\S]*?)<\/section>/)[1];
  assert.ok(estimateHeader.indexOf('hello@example.test') < estimateHeader.indexOf('ИНН 123456789012'));
  assert.match(estimateHeader, /Офис, 10/);
  assert.doesNotMatch(estimateHeader, /Адрес регистрации, 20|data-company-legal-address/);
});


test('contracts and both act variants keep signatures blank and insert the configured signer names', () => {
  const saved = { ...company, legal: 'ООО «Компания»', legalForm: 'ooo', signerName: 'Неизвестный представитель', sign: 'data:image/png;base64,U0lHTg==', signature: 'data:image/png;base64,U0lHTg==' };
  const template = normalizeContractTemplate({ head: saved });
  for (const html of [contractHtml(template, fields, est), acceptanceHtml(template, fields, { number: 'А-12' }), acceptanceHtml(template, fields, { blank: true })]) {
    const group = html.match(/<section class="contract-signatures[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(group);
    assert.equal((group.match(/data-signing-party=/g) || []).length, 2);
    assert.equal((group.match(/data-manual-signature><\/div>/g) || []).length, 2);
    assert.equal((group.match(/data-manual-signer-name>/g) || []).length, 2);
    assert.match(group, /data-manual-signer-name>Неизвестный представитель<\/div>/);
    assert.match(group, /data-manual-signer-name>Иванов А.С.<\/div>/);
    assert.equal((group.match(/>Подпись<\/span>/g) || []).length, 2);
    assert.equal((group.match(/>ФИО<\/span>/g) || []).length, 2);
    assert.doesNotMatch(group, /должность|ООО|<img|<input|<button/);
    assert.doesNotMatch(html, /U0lHTg==/);
    assert.ok(html.indexOf('contract-requisites no-split') < html.indexOf('class="contract-signatures no-split"'));
    assert.match(html, /contract-signatures no-split" data-document-signatures data-pdf-keep-with-previous/);
    assert.match(html, /contract-signature-line\{height:24px/);
  }
  assert.doesNotMatch(estimateHtml({ company: saved, est }), /data-document-signatures|data-manual-signature|ФИО подписанта|U0lHTg==/);
});

test('unfilled parties print blank handwriting lines instead of application setup warnings or invented company names', () => {
  const template = normalizeContractTemplate({ head: {} });
  const empty = { ...fields, клиент: '', телефон: '' };
  const contract = contractHtml(template, empty, est);
  const act = acceptanceHtml(template, empty, { blank: true });
  const quote = estimateHtml();
  for (const html of [contract, act, quote]) assert.doesNotMatch(html, /Данные заказчика не заполнены|Данные компании не заполнены|Реквизиты заполняются в настройках компании|Студия натяжных потолков/);
  for (const html of [contract, act]) assert.equal((html.match(/data-empty-requisites/g) || []).length, 2);
  assert.match(quote, /estimate-company-name[^>]*>____________________<\/p>/);
});
