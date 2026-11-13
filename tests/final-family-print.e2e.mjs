import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Focused, isolated print check. Run only after the candidate's desktop build.
const output = path.resolve('artifacts/final-fio');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(12000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const shell = page.locator('.z-contract-shell');
const button = name => shell.getByRole('button', { name, exact: true });
const results = {};
const warnings = /не заполнены|не указан[аоы]?|нет позиций|чертёж не добавлен/iu;
async function fonts() { await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }); }
async function actualPdf(action, name, expectedPages) {
  const pending = page.waitForEvent('download', { timeout: 45000 }); await action();
  const download = await pending, target = path.join(output, `final-fio-${name}.pdf`); await download.saveAs(target);
  const bytes = await fs.readFile(target); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const count = [...bytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.equal(count, expectedPages, `${name}: exported PDF matches physical preview`);
  return { path: target, pages: count, bytes: bytes.length };
}
async function inspect(article, titleSelector) {
  return article.evaluate((element, titleSelector) => {
    const header = element.querySelector('.estimate-company-card') || element.querySelector('header'), title = element.querySelector(titleSelector);
    const hs = getComputedStyle(header), ts = getComputedStyle(title);
    const legal = header.querySelector('.contract-brand-legal,.estimate-company-details');
    const brand = header.querySelector('.contract-brand-name,.estimate-company-name');
    const contacts = [...header.querySelectorAll('.contract-brand-address,.contract-brand-phone,.contract-brand-email,[data-company-address],.estimate-company-phone,.estimate-company-email')];
    return { width: element.offsetWidth, height: element.offsetHeight, text: element.textContent,
      font: getComputedStyle(element).fontFamily, title: title.textContent, titleSize: ts.fontSize, titleAlign: ts.textAlign,
      signatures: element.querySelectorAll('[data-document-signatures]').length,
      signingLines: [...element.querySelectorAll('[data-manual-signature]')].map(line => ({ text: line.textContent, children: line.children.length })),
      signerNames: [...element.querySelectorAll('[data-manual-signer-name]')].map(line => line.textContent),
      signingCaptions: [...element.querySelectorAll('.contract-signature-label')].map(line => line.textContent),
      contactColumns: legal ? contacts.map(contact => contact.getBoundingClientRect().left < legal.getBoundingClientRect().left) : [],
      brandLines: Math.round(brand.offsetHeight / parseFloat(getComputedStyle(brand).lineHeight)),
      logoLoaded: !!header.querySelector('img')?.naturalWidth,
      header: { text: header.textContent, background: hs.backgroundColor, borderLeft: hs.borderLeft, borderBottom: hs.borderBottom, padding: hs.padding, radius: hs.borderRadius } };
  }, titleSelector);
}
function bandHeader(proof) {
  assert.ok(['rgb(239, 245, 255)', 'rgb(241, 246, 254)'].includes(proof.header.background), 'shared company header uses the pale blue band');
  assert.match(proof.header.borderLeft, /^4px solid rgb\(20, 97, 238\)$/);
  assert.match(proof.header.borderBottom, /^0px /);
  assert.match(proof.header.text, /ИП Иванов Александр Константинович/);
  assert.match(proof.header.text, /123456789012/);
  assert.doesNotMatch(proof.header.text, /ОГРН|КПП|123456789012345/i);
  assert.match(proof.header.text, /Производственная/);
  assert.equal(proof.contactColumns.length, 3); assert.ok(proof.contactColumns.every(Boolean), 'office, phone and email stay to the left of legal identity');
  assert.equal(proof.brandLines, 2); assert.equal(proof.logoLoaded, true);
}
function paperSigning(proof) {
  assert.equal(proof.signatures, 1);
  assert.deepEqual(proof.signingLines, Array.from({ length: 2 }, () => ({ text: '', children: 0 })));
  assert.deepEqual(proof.signerNames, ['Иванов А.К.', 'Петров П.П.']);
  assert.deepEqual(proof.signingCaptions, ['Подпись', 'ФИО', 'Подпись', 'ФИО']);
}
async function documentPreview(name, expectedPages) {
  assert.equal(await shell.locator('.cd-header').getByRole('button', { name: 'Предпросмотр документа', exact: true }).count(), 0);
  assert.equal(await shell.locator('.cd-footer').getByRole('button').count(), 2);
  await button('Предпросмотр документа').click();
  const pages = shell.locator('.cd-pdf-page'); await pages.first().waitFor(); await fonts();
  const article = pages.first().locator('[data-document-kind]').first();
  const proof = await inspect(article, 'h2');
  const count = await pages.count(); results[name + 'Geometry'] = { width: proof.width, height: proof.height, pages: count };
  console.log(`${name}: ${proof.width}×${proof.height}px, ${count} preview pages`);
  assert.equal(count, expectedPages, `${name}: ${proof.width}×${proof.height}px article, expected physical page count`);
  assert.match(proof.font, /Manrope/); assert.equal(proof.titleSize, '20px'); assert.equal(proof.titleAlign, 'center');
  assert.doesNotMatch(proof.text, /ппп|\{[а-яё_]+\}/iu);
  assert.doesNotMatch(proof.text, warnings); paperSigning(proof);
  await pages.first().screenshot({ path: path.join(output, `final-fio-${name}-preview.png`) });
  await button('Закрыть договор').click();
  return { ...proof, previewPages: expectedPages };
}
try {
  await page.goto('http://127.0.0.1:5174/design/app.html?screen=app', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.MagicContract?.open && window.MagicEstimate?.previewEstimate);
  await page.evaluate(async () => {
    const { DEFAULT_CONTRACT_TPL, DEFAULT_CONTRACT_ESTIMATE_OPTIONS } = await import('/src/data/contract.js');
    const company = { company: 'Студия потолков QA', legalForm: 'ip', legal: 'ИП Иванов Александр Константинович', inn: '123456789012', ogrn: '123456789012345', companyAddress: 'г. Хабаровск, ул. Производственная, дом 10, офис 25', address: 'г. Хабаровск, ул. Регистрационная, дом 22, квартира 105', phone: '+7 999 000-00-00', email: 'info@example.test', description: 'ппп', bank: 'Банк QA, БИК 040000001, р/с 40802810000000000001, к/с 30101810000000000001' };
    const logo = document.createElement('canvas'); logo.width = logo.height = 96;
    const paint = logo.getContext('2d'); paint.fillStyle = '#1461EE'; paint.fillRect(0, 0, 96, 96);
    paint.strokeStyle = '#FFFFFF'; paint.lineWidth = 6; paint.beginPath(); paint.moveTo(20, 64); paint.lineTo(20, 35); paint.lineTo(48, 20); paint.lineTo(76, 35); paint.lineTo(76, 64); paint.moveTo(32, 64); paint.lineTo(64, 64); paint.stroke();
    company.logo = logo.toDataURL('image/png'); company.company = 'Студия натяжных потолков «Высота и свет»'; company.signerName = 'Иванов А.К.';
    let template = structuredClone(DEFAULT_CONTRACT_TPL); template.head = company;
    template.appendices = [{ id: 'estimate', kind: 'estimate', exportOptions: structuredClone(DEFAULT_CONTRACT_ESTIMATE_OPTIONS) }];
    template.actSections = template.actSections.map((section, i) => ({ ...section, text: section.text + `\nКонтрольная формулировка QA ${i + 1}.` }));
    const project = { id: 'final-family-only', name: 'Гостиная — пример документов', client: 'Петров Алексей Константинович', phone: '+7 999 111-22-33', address: 'г. Хабаровск, ул. Тестовая, дом 15, квартира 101', inn: '123456789012', legalAddress: 'г. Хабаровск, ул. Длинная Тестовая, дом 15, квартира 101', paid: 30000 };
    const est = { mats: [{ n: 'Полотно и профиль', q: 42.6, p: 1500, u: 'м²' }], works: [{ n: 'Монтаж потолка', q: 1, p: 21100, u: 'усл' }] };
    const rooms = [{ name: 'Гостиная', area: 42.6 }];
    const contract = { status: 'draft', number: 'QA-FINAL', numberAuto: false, numberAllocated: false, date: '2026-11-13', startDate: '2026-11-20', endDate: '2026-11-21', prepay: 42500, actDraft: { number: 'А-QA-FINAL', date: '2026-11-22', completionDate: '2026-11-21', acceptance: '', remarks: '', remedyDate: '', scope: 'Монтаж потолков в гостиной', total: 85000, paid: 30000 } };
    window.__finalQuote = { project, company, est, rooms, type: 'total', ...structuredClone(DEFAULT_CONTRACT_ESTIMATE_OPTIONS) };
    window.__finalTemplate = structuredClone(template);
    window.__finalOpen = () => { let handle; handle = window.MagicContract.open({ project, company, total: 85000, area: 42.6, est, rooms, contract: window.__finalSnapshot || contract,
      templateStore: { load: () => template, save: value => { template = value; return true; } },
      onSaveContract: value => { window.__finalSnapshot = structuredClone(value); }, onProjectPatch() {}, onClose: () => handle.close() }); };
    window.__finalOpen();
  });
  await shell.waitFor();
  assert.equal(await shell.getByLabel('ФИО заказчика для подписи', { exact: true }).inputValue(), 'Петров А.К.');
  await shell.getByLabel('ФИО заказчика для подписи', { exact: true }).fill('Петров П.П.');
  results.contract = await documentPreview('contract', 2);
  bandHeader(results.contract);
  assert.ok(results.contract.height <= 277 / 190 * results.contract.width, `seven clauses and full requisites fit one A4: ${results.contract.height}px`);
  assert.match(results.contract.text, /123456789012345/); assert.match(results.contract.text, /Регистрационная/);
  results.contract.pdf = await actualPdf(() => button('Скачать PDF').click(), 'contract', 2);
  assert.equal(await page.evaluate(() => window.__finalSnapshot.total), 85000);
  assert.doesNotMatch(await page.evaluate(() => window.__finalSnapshot.html), /data-document-kind="acceptance"/);
  await shell.getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  assert.equal(await shell.getByLabel('ФИО заказчика для подписи', { exact: true }).inputValue(), 'Петров П.П.');
  results.actBlank = await documentPreview('act-blank', 1);
  assert.match(results.actBlank.text, /_{30,}\s+_{30,}\s+_{30,}/);
  results.actBlank.pdf = await actualPdf(() => button('Скачать PDF').click(), 'act-blank', 1);
  await button('Есть замечания').click();
  await shell.getByLabel('Замечания и недостатки', { exact: true }).fill('Устранить следы монтажа у входа.');
  await shell.getByLabel('Устранить до', { exact: true }).fill('2026-11-25');
  results.act = await documentPreview('act', 1);
  assert.equal(results.act.title, 'АКТ ВЫПОЛНЕННЫХ РАБОТ № А-QA-FINAL');
  for (let i = 1; i <= 3; i++) assert.match(results.act.text, new RegExp(`Контрольная формулировка QA ${i}\\.`));
  assert.match(results.act.text, /Устранить следы монтажа у входа\./);
  assert.doesNotMatch(results.act.text, /Полученная оплата|Остаток по акту/);
  assert.deepEqual(results.act.header, results.contract.header);
  results.act.pdf = await actualPdf(() => button('Скачать PDF').click(), 'act', 1);
  await button('Закрыть договор').click(); await shell.waitFor({ state: 'detached' });
  await page.evaluate(() => window.__finalOpen()); await shell.waitFor();
  for (const tab of ['Договор', 'Акт выполненных работ']) {
    await shell.getByRole('tab', { name: tab, exact: true }).click();
    assert.equal(await shell.getByLabel('ФИО заказчика для подписи', { exact: true }).inputValue(), 'Петров П.П.', 'manual signature name survives reopening both tabs');
  }
  await button('Закрыть договор').click(); await shell.waitFor({ state: 'detached' });
  await page.evaluate(() => window.MagicEstimate.previewEstimate(window.__finalQuote));
  const quote = page.getByRole('dialog', { name: 'Предпросмотр сметы', exact: true }), pages = quote.locator('.z-estimate-pdf-page');
  await pages.first().waitFor(); await fonts(); assert.equal(await pages.count(), 1);
  const article = pages.first().locator('.estimate-document').first(); results.quote = await inspect(article, 'h1');
  bandHeader(results.quote);
  assert.equal(results.quote.title, 'Коммерческое предложение'); assert.equal(results.quote.titleSize, '20px'); assert.equal(results.quote.titleAlign, 'center');
  assert.doesNotMatch(results.quote.text, /ппп/); assert.equal(await article.locator('[data-estimate-project] dl').count(), 0);
  assert.doesNotMatch(results.quote.text, warnings); assert.equal(results.quote.signatures, 0);
  for (const part of ['name', 'address', 'customer', 'metrics']) assert.equal(await article.locator(`[data-estimate-project-${part}]`).count(), 1);
  const colors = await article.locator('th').first().evaluate(element => ({ bg: getComputedStyle(element).backgroundColor, ink: getComputedStyle(element).color }));
  assert.deepEqual(colors, { bg: 'rgb(231, 239, 253)', ink: 'rgb(33, 77, 123)' }); results.quote.table = colors;
  await pages.first().screenshot({ path: path.join(output, 'final-fio-quote-preview.png') });
  results.quote.pdf = await actualPdf(() => page.evaluate(() => window.MagicEstimate.downloadEstimate(window.__finalQuote)), 'quote', 1);
  results.emptyPrint = await page.evaluate(async () => {
    const { acceptanceHtml, contractHtml, contractFields, DEFAULT_CONTRACT_TPL } = await import('/src/data/contract.js');
    const { estimateHtml } = await import('/src/utils/estimate-html.js');
    const doc = html => new DOMParser().parseFromString(html, 'text/html');
    const blank = doc(acceptanceHtml(DEFAULT_CONTRACT_TPL, contractFields({}, 0), { blank: true }));
    const zero = doc(acceptanceHtml(DEFAULT_CONTRACT_TPL, contractFields({}, 0), { total: 0 }));
    const estimate = doc(estimateHtml({ est: {}, rooms: [{ name: 'Пустая комната', area: 0 }], type: 'draw' }));
    const perRoom = doc(estimateHtml({ est: {}, rooms: [{ name: 'Пустая комната', area: 0 }], type: 'rooms' }));
    const contract = doc(contractHtml(DEFAULT_CONTRACT_TPL, contractFields({}, 0), {}));
    return { blank: blank.body.textContent, zero: zero.body.textContent, estimate: estimate.body.textContent,
      actSections: blank.querySelectorAll('[data-act-section]').length,
      signingGroups: blank.querySelectorAll('[data-document-signatures]').length,
      estimateSigningGroups: estimate.querySelectorAll('[data-document-signatures]').length,
      emptyRows: estimate.querySelectorAll('[data-estimate-blank-row]').length,
      invalidDrawing: estimate.querySelectorAll('svg,.estimate-drawings').length, perRoom: perRoom.body.textContent,
      contractEstimateRows: contract.querySelectorAll('[data-contract-appendix="estimate"] tbody tr:not([data-pdf-summary])').length,
      contractEstimate: contract.querySelector('[data-contract-appendix="estimate"]')?.textContent };
  });
  for (const kind of ['blank', 'zero', 'estimate']) assert.doesNotMatch(results.emptyPrint[kind], warnings);
  assert.equal(results.emptyPrint.actSections, 3); assert.equal(results.emptyPrint.signingGroups, 1);
  assert.match(results.emptyPrint.blank, /_{30,}\s+_{30,}\s+_{30,}/);
  assert.match(results.emptyPrint.zero, /Стоимость выполненных работ по акту: 0 ₽/);
  assert.ok(results.emptyPrint.emptyRows > 0); assert.equal(results.emptyPrint.estimateSigningGroups, 0);
  assert.equal(results.emptyPrint.invalidDrawing, 0); assert.match(results.emptyPrint.perRoom, /Пустая комната/);
  assert.ok(results.emptyPrint.contractEstimateRows > 0); assert.doesNotMatch(results.emptyPrint.contractEstimate, /будет подставлена/);
  assert.match(results.emptyPrint.contractEstimate, /Итого[\s\S]*0 ₽/);
  assert.deepEqual(errors, []);
  await quote.getByRole('button', { name: 'Закрыть предпросмотр сметы', exact: true }).click();
  async function account() {
    await page.evaluate(() => window.__zamer.go('dash'));
    await page.getByRole('button', { name: 'Аккаунт', exact: true }).click();
    await page.getByRole('button', { name: 'Настройки аккаунта', exact: true }).click();
    await page.locator('.z-account-settings').waitFor();
  }
  await account(); await page.getByRole('button', { name: 'Изменить ФИО для подписи', exact: true }).click();
  const signerDialog = page.getByRole('dialog', { name: 'ФИО для подписи', exact: true });
  await signerDialog.getByLabel('ФИО для подписи', { exact: true }).fill('Иванов А.К.');
  await signerDialog.getByRole('button', { name: 'Сохранить', exact: true }).click(); await signerDialog.waitFor({ state: 'hidden' });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__zamer?.state?.profile?.signerName === 'Иванов А.К.');
  await account(); await page.getByRole('button', { name: 'Изменить ФИО для подписи', exact: true }).click();
  assert.equal(await signerDialog.getByLabel('ФИО для подписи', { exact: true }).inputValue(), 'Иванов А.К.');
  await page.screenshot({ path: path.join(output, 'final-fio-account-setting.png') });
  results.signerName = { auto: 'Петров А.К.', manualPersisted: 'Петров П.П.', companySettingPersisted: 'Иванов А.К.' };
  await fs.writeFile(path.join(output, 'final-fio-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ contract: { height: results.contract.height, width: results.contract.width, pages: 2 }, actPages: 1, quotePages: 1, output }, null, 2));
} catch (error) { await page.screenshot({ path: path.join(output, 'final-fio-failure.png'), timeout: 5000 }).catch(() => {}); await fs.writeFile(path.join(output, 'final-fio-partial.json'), JSON.stringify({ ...results, failure: error.message }, null, 2)); throw error; }
finally { await browser.close(); }
