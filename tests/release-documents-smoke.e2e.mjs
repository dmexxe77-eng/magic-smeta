import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

// Compiled runtime only; no /src imports, credentials or server mutations.
const base = process.env.RELEASE_BASE;
assert.ok(base, 'Set RELEASE_BASE to the READY deployment URL');
const origin = new URL(base).origin, output = path.resolve('artifacts/release-smoke');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true, serviceWorkers: 'block' });
const blockedWrites = [], errors = [];
await context.route('**/*', route => {
  const request = route.request();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
    blockedWrites.push({ method: request.method(), url: request.url().split('?')[0] });
    return route.abort('blockedbyclient');
  }
  return route.continue();
});
const page = await context.newPage(); page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
const shell = page.locator('.z-contract-shell');
const button = name => shell.getByRole('button', { name, exact: true });
const results = { origin, commit: process.env.RELEASE_COMMIT || null, compiledHashes: {}, viewports: [] };
async function settle() { await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }); }
async function load() {
  await page.goto(origin + '/design/app.html?screen=app', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__zamer && window.MagicContract?.open && window.MagicContract?.openTemplate && window.MagicDocuments?.openAccountSettings);
  await settle();
  const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(width.document <= width.viewport + 1, 'production mobile page has no horizontal overflow');
  results.viewports.push(width);
}
async function preview(name) {
  await button('Предпросмотр документа').click(); await shell.locator('.cd-pdf-page').first().waitFor(); await settle();
  const article = shell.locator('.cd-pdf-page [data-document-kind]').first();
  const proof = await article.evaluate(element => ({ header: element.querySelector('header').textContent,
    captions: [...element.querySelectorAll('.contract-signature-label')].map(node => node.textContent),
    names: [...element.querySelectorAll('[data-manual-signer-name]')].map(node => node.textContent),
    signatures: [...element.querySelectorAll('[data-manual-signature]')].map(node => node.innerHTML),
    sections: element.querySelectorAll('[data-act-section]').length, text: element.textContent }));
  assert.match(proof.header, /ИНН 123456789012/); assert.doesNotMatch(proof.header, /ОГРН|КПП|123456789012345/);
  assert.deepEqual(proof.captions, ['Подпись', 'ФИО', 'Подпись', 'ФИО']);
  assert.deepEqual(proof.signatures, ['', '']);
  assert.doesNotMatch(proof.text, /не заполнены|не указан[аоы]?|нет позиций|чертёж не добавлен/iu);
  const pages = await shell.locator('.cd-pdf-page').count();
  await shell.locator('.cd-pdf-page').first().screenshot({ path: path.join(output, name + '-preview.png') });
  await button('Закрыть договор').click();
  return { ...proof, pages };
}
try {
  for (const file of ['design/app.html', 'design/contract.js']) {
    const response = await context.request.get(origin + '/' + file); assert.ok(response.ok(), file + ' is published');
    const remote = await response.body(), local = await fs.readFile(path.resolve('public', file));
    assert.equal(createHash('sha256').update(remote).digest('hex'), createHash('sha256').update(local).digest('hex'), file + ' matches the checked local build');
    results.compiledHashes[file] = createHash('sha256').update(remote).digest('hex');
  }
  await load();
  await page.evaluate(() => {
    const company = { company: 'Студия потолков — пример', legalForm: 'ip', legal: 'ИП Иванов Александр Константинович', signerName: 'Иванов А.К.', inn: '123456789012', ogrn: '123456789012345', city: 'Хабаровск', companyAddress: 'г. Хабаровск', address: 'г. Хабаровск', phone: '+7 999 123-45-67' };
    window.__releaseCompany = company;
    let handle; handle = window.MagicContract.openTemplate({ company, templateStore: { load: () => ({ head: company }), save() { throw new Error('Read-only release check must not save templates'); } }, onClose: () => handle.close() });
  });
  await shell.getByRole('heading', { name: 'Шаблон документов', exact: true }).waitFor();
  await shell.getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  assert.equal(await shell.locator('.cd-section-toggle').count(), 3);
  results.template = await preview('production-template-act'); assert.equal(results.template.sections, 3);
  await button('Закрыть договор').click(); await shell.waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const company = window.__releaseCompany, project = { name: 'Проверка опубликованных документов', client: 'Петров Алексей Константинович', address: 'г. Хабаровск, ул. Примерная, д. 12', phone: '+7 999 765-43-21', paid: 0 };
    let handle; handle = window.MagicContract.open({ company, project, total: 85000, area: 42.6, est: { works: [{ n: 'Монтаж потолка', q: 1, p: 85000, u: 'усл' }] }, rooms: [],
      contract: { number: 'ПРИМЕР-01', numberAuto: false, date: '2026-11-13', startDate: '2026-11-20', endDate: '2026-11-21', prepay: 42500, actDraft: { number: 'А-01', date: '2026-11-22', completionDate: '2026-11-21', acceptance: '', remarks: '', remedyDate: '', scope: 'Монтаж потолка согласно договору и смете.', total: 85000 } },
      templateStore: { load: () => ({ head: company }), save() {} }, onSaveContract: value => { window.__releaseSnapshot = value; }, onClose: () => handle.close() });
  });
  const signer = shell.getByLabel('ФИО заказчика для подписи', { exact: true });
  assert.equal(await signer.inputValue(), 'Петров А.К.'); await signer.fill('Петров П.П.');
  results.contract = await preview('production-contract'); assert.equal(results.contract.pages, 2);
  assert.deepEqual(results.contract.names, ['Иванов А.К.', 'Петров П.П.']);
  await shell.getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  assert.equal(await signer.inputValue(), 'Петров П.П.');
  results.act = await preview('production-act'); assert.equal(results.act.pages, 1); assert.equal(results.act.sections, 3);
  assert.deepEqual(results.act.names, ['Иванов А.К.', 'Петров П.П.']);
  const pending = page.waitForEvent('download', { timeout: 45000 }); await button('Скачать PDF').click();
  const downloaded = await pending, target = path.join(output, 'production-act.pdf'); await downloaded.saveAs(target);
  const bytes = await fs.readFile(target); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.equal([...bytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length, 1);
  results.pdf = { path: target, pages: 1, bytes: bytes.length };
  await button('Закрыть договор').click(); await shell.waitFor({ state: 'detached' });
  await page.evaluate(() => window.MagicDocuments.openAccountSettings({ profile: window.__releaseCompany, onChange() { throw new Error('Read-only release check must not save account settings'); } }));
  await page.getByRole('button', { name: 'Изменить ФИО для подписи', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'ФИО для подписи', exact: true });
  assert.equal(await dialog.getByLabel('ФИО для подписи', { exact: true }).inputValue(), 'Иванов А.К.');
  await page.screenshot({ path: path.join(output, 'production-signature-name-setting.png') });
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.getByRole('button', { name: 'Закрыть настройки аккаунта', exact: true }).click();
  await page.setViewportSize({ width: 430, height: 932 }); await load();
  await page.screenshot({ path: path.join(output, 'production-home-430.png') });
  assert.deepEqual(errors, []); results.errors = errors; results.blockedWrites = blockedWrites;
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ origin, commit: results.commit, viewports: results.viewports, compiledBuildMatches: true, templateActSections: 3, manualFio: true, actualPdfPages: 1, blockedWrites }, null, 2));
} catch (error) { await page.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {}); await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ ...results, errors, blockedWrites, message: error.message }, null, 2)); throw error; }
finally { await browser.close(); }
