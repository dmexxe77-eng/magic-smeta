import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const originalOrigin = 'http://127.0.0.1:5173';
const candidateOrigin = 'http://127.0.0.1:5174';
const keys = ['zamer.design.v1', 'zamer.contractTpl'];
const output = path.resolve('artifacts/document-simplification');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
await context.tracing.start({ screenshots: true, snapshots: true });
const checkpointWaiters = [];
await context.exposeBinding('__qaSeedCheckpoint', ({ page }, data) => {
  const waiter = checkpointWaiters.shift(); if (waiter) { clearTimeout(waiter.timer); waiter.resolve({ page, ...data }); }
});
function checkpoint() {
  return new Promise((resolve, reject) => {
    const item = { resolve, timer: setTimeout(() => reject(new Error('Seed navigation checkpoint did not arrive')), 15000) };
    checkpointWaiters.push(item);
  });
}
await context.addInitScript(({ originalOrigin, candidateOrigin, keys }) => {
  if (location.origin === originalOrigin) {
    window.__holdComparison = true;
    window.addEventListener('message', event => {
      if (window.__holdComparison && event.source !== window && event.origin === candidateOrigin && event.data?.type === 'zamer:comparison-ready') {
        event.stopImmediatePropagation(); window.__heldReady = { source: event.source, origin: event.origin, data: event.data };
      }
    }, true);
  }
  if (location.origin === candidateOrigin && location.pathname === '/design/index.html') {
    window.__qaSeedCheckpoint({ values: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), allKeys: Object.keys(localStorage).sort() });
  }
}, { originalOrigin, candidateOrigin, keys });
const original = await context.newPage();
let candidate;
const errors = [];
for (const page of [original]) page.on('pageerror', error => errors.push(error.message));
const raw = page => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), keys);
const root = page => page.locator('.z-contract-shell');
const docButton = (page, name) => root(page).getByRole('button', { name, exact: true });
async function ready(page, origin) {
  await page.goto(origin + '/design/app.html?screen=app', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__zamer && window.MagicContract && window.MagicEstimate && window.MagicDocuments, null, { timeout: 30000 });
}
async function fonts(page) { await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }); }
async function menu(page) {
  await page.evaluate(() => window.__zamer.go('dash'));
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  return page.getByRole('dialog', { name: 'Главное меню', exact: true });
}
async function openText(page) {
  await (await menu(page)).getByRole('button', { name: 'Шаблон документов', exact: true }).click();
  await root(page).waitFor();
}
async function closeDocument(page) { await docButton(page, 'Закрыть договор').click(); await root(page).waitFor({ state: 'detached' }); }
async function cleanArticle(article) {
  const proof = await article.evaluate(element => ({
    font: getComputedStyle(element).fontFamily, border: getComputedStyle(element).borderTopWidth,
    header: getComputedStyle(element.querySelector('header')).backgroundColor,
    table: element.querySelector('th') ? getComputedStyle(element.querySelector('th')).backgroundColor : null,
    text: element.textContent,
  }));
  assert.match(proof.font, /Manrope/); assert.equal(proof.border, '0px');
  assert.ok(['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'].includes(proof.header), 'print header stays white');
  if (proof.table) assert.equal(proof.table, 'rgb(241, 243, 245)');
  assert.doesNotMatch(await article.innerHTML(), /class=["'][^"']*signature|Подпись исполнителя|\{[а-яё_]+\}/iu);
  return proof;
}
async function documentPreview(page, filename) {
  await docButton(page, 'Предпросмотр документа').click();
  const pages = root(page).locator('.cd-pdf-page'); await pages.first().waitFor(); await fonts(page);
  const proof = await cleanArticle(pages.first().locator('[data-document-kind]').first());
  const count = await pages.count();
  await page.screenshot({ path: path.join(output, filename) });
  await docButton(page, 'Закрыть договор').click();
  return { count, proof };
}
async function downloaded(page, action, filename, pages) {
  const waiting = page.waitForEvent('download', { timeout: 45000 }); await action();
  const download = await waiting; const target = path.join(output, filename); await download.saveAs(target);
  const bytes = await fs.readFile(target); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const count = [...bytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.equal(count, pages, 'actual PDF matches physical preview pages');
  return { target, count, bytes: bytes.length };
}

try {
  await ready(original, originalOrigin);
  await original.evaluate(() => {
    const app = window.__zamer;
    const source = app.state.projects.find(project => /Дзержинского/.test(project.name));
    if (!source) throw new Error('Original bundled demo project is missing');
    const project = { ...structuredClone(source), name: 'Сравнение документов QA', client: 'Клиент QA', phone: '+7 999 111-22-33', address: 'Тестовый адрес QA', notes: '', contract: null };
    const company = { name: 'Тестовый мастер', company: 'Компания сравнения QA', legalForm: 'ip', legal: 'Иванов Алексей Тестовый', inn: '123456789012', ogrn: '123456789012345', address: 'Юридический адрес QA', companyAddress: 'Офис QA', phone: '+7 999 000-00-00', logo: '' };
    app.setState({ projects: [project], profile: company, screen: 'dash', curId: project.id, sheet: null }, () => app.saveDesign());
    localStorage.setItem('zamer.contractTpl', JSON.stringify({ head: company, style: 'accent', numSeq: 11, settings: { prepayPercent: 35 }, appendices: [{ id: 'estimate', kind: 'estimate', exportOptions: { type: 'total', cols: { num: true, photo: false, name: true, qty: true, unit: true, price: true, total: true } } }] }));
    localStorage.setItem('qa.not-for-comparison', 'source-only');
  });
  await original.waitForFunction(() => window.__zamer.state.projects.length === 1);
  const originalMoney = await original.evaluate(() => window.__zamer.pSum(window.__zamer.state.projects[0]));
  const originalMenu = await menu(original);
  assert.equal(await originalMenu.getByRole('button', { name: 'Шапка сметы', exact: true }).count(), 1);
  await originalMenu.getByRole('button', { name: 'Шаблон договора', exact: true }).click();
  await root(original).waitFor(); assert.equal(await root(original).locator('.cd-style-option').count(), 2);
  await closeDocument(original);
  await original.goto(originalOrigin + '/compare-documents/index.html', { waitUntil: 'domcontentloaded' });
  const sourceBefore = await raw(original);
  await original.setViewportSize({ width: 1100, height: 850 });
  await original.screenshot({ path: path.join(output, 'comparison-hub.png') });
  const copied = checkpoint(); const popup = original.waitForEvent('popup');
  await original.getByRole('button', { name: 'Открыть упрощённый', exact: true }).click(); candidate = await popup;
  candidate.setDefaultTimeout(10000); candidate.on('pageerror', error => errors.push(error.message));
  await original.waitForFunction(() => !!window.__heldReady);
  await candidate.waitForLoadState('domcontentloaded');
  const fake = { 'zamer.design.v1': JSON.stringify({ version: 1, projects: [] }), 'zamer.contractTpl': JSON.stringify({ head: { company: 'FORGED' } }) };
  await candidate.evaluate(seed => {
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://attacker.invalid', source: window.opener, data: { type: 'zamer:comparison-seed', seed } }));
    window.dispatchEvent(new MessageEvent('message', { origin: 'http://127.0.0.1:5173', source: window, data: { type: 'zamer:comparison-seed', seed } }));
  }, fake);
  assert.deepEqual(await raw(candidate), Object.fromEntries(keys.map(key => [key, null])), 'forged origin/source cannot seed the candidate');
  await original.evaluate(() => {
    window.dispatchEvent(new MessageEvent('message', { origin: 'http://127.0.0.1:5174', source: window, data: { type: 'zamer:comparison-ready' } }));
  });
  assert.ok(candidate.url().endsWith('/compare-documents/seed.html'));
  await original.evaluate(() => { const event = window.__heldReady; window.__holdComparison = false; window.dispatchEvent(new MessageEvent('message', event)); });
  const initial = await copied;
  assert.deepEqual(initial.values, sourceBefore, 'first seed copies both source values byte for byte');
  assert.deepEqual(initial.allKeys, [...keys].sort(), 'only the two mobile keys are transferred');
  await candidate.waitForURL(candidateOrigin + '/design/index.html?screen=app&previewDevice=iphone-pro-max');
  assert.equal(await candidate.evaluate(() => window.opener), null);
  await ready(candidate, candidateOrigin);
  assert.equal(await candidate.evaluate(() => localStorage.getItem('qa.not-for-comparison')), null);
  assert.equal(await candidate.evaluate(() => window.__zamer.pSum(window.__zamer.state.projects[0])), originalMoney, 'copy does not change money');
  if (process.env.SIMPLIFICATION_ISOLATION_ONLY === '1') {
    await candidate.evaluate(() => window.__zamer.go('account'));
    await candidate.getByRole('button', { name: 'Настройки аккаунта', exact: true }).click();
    const settings = candidate.locator('.z-account-settings'); await settings.waitFor();
    await settings.getByRole('button', { name: 'Изменить Компания', exact: true }).click();
    const company = settings.getByRole('dialog', { name: 'Компания', exact: true });
    await company.getByLabel('Компания', { exact: true }).fill('Изменено только в упрощённом QA');
    await company.getByRole('button', { name: 'Сохранить', exact: true }).click(); await company.waitFor({ state: 'hidden' });
    await settings.getByRole('button', { name: 'Готово', exact: true }).click();
    await ready(candidate, candidateOrigin);
    assert.equal(await candidate.evaluate(() => window.__zamer.state.profile.company), 'Изменено только в упрощённом QA');
    const edited = await raw(candidate);
    assert.deepEqual(await raw(original), sourceBefore);
    console.log('Source bytes unchanged after candidate profile edit and reload.');
    await original.evaluate(() => { window.__holdComparison = false; });
    const popup = original.waitForEvent('popup');
    await original.getByRole('button', { name: 'Открыть упрощённый', exact: true }).click();
    const second = await popup; await second.waitForURL(/\/design\/index\.html/, { waitUntil: 'domcontentloaded' });
    const result = await raw(second);
    for (const key of keys) assert.deepEqual(JSON.parse(result[key]), JSON.parse(edited[key]), 'second comparison preserves edited candidate storage');
    assert.deepEqual(await raw(original), sourceBefore);
    await fs.writeFile(path.join(output, 'isolation-results.json'), JSON.stringify({ sourceKeysByteUnchanged: true, onlyTwoKeysTransferred: true, fakeOriginSourceIgnored: true, candidateProfileEditPersists: true, secondOpenKeepsCandidate: true }, null, 2));
    console.log('Second opening preserves candidate edits; isolation smoke passed.');
    await second.close();
    await context.tracing.stop({ path: path.join(output, 'isolation-trace.zip') });
    await browser.close(); process.exit(0);
  }

  const candidateMenu = await menu(candidate);
  assert.equal(await candidateMenu.getByRole('button', { name: 'Шаблон документов', exact: true }).count(), 1);
  for (const name of ['Шапка сметы', 'Шаблон договора']) assert.equal(await candidateMenu.getByRole('button', { name, exact: true }).count(), 0);
  await candidate.screenshot({ path: path.join(output, 'candidate-menu.png') });
  await candidateMenu.getByRole('button', { name: 'Шаблон документов', exact: true }).click();
  await root(candidate).waitFor();
  assert.equal(await root(candidate).locator('.cd-style-options').count(), 0);
  for (const name of ['Компания', 'Оформление']) assert.equal(await root(candidate).getByRole('heading', { name, exact: true }).count(), 0);
  assert.equal(await root(candidate).locator('details.cd-template-extra').count(), 0);
  assert.equal(await root(candidate).getByRole('heading', { name: 'Приложения', exact: true }).count(), 1);
  assert.equal(await root(candidate).getByLabel('Предоплата, %', { exact: true }).count(), 0);
  await candidate.screenshot({ path: path.join(output, 'candidate-text-editor.png') });
  await root(candidate).locator('.cd-section-toggle').filter({ hasText: 'Предмет договора' }).click();
  const text = root(candidate).getByLabel('Текст раздела 1', { exact: true });
  await text.fill('ПРОВЕРКА SIMPLE. ' + await text.inputValue() + ' Заказчик: ');
  await docButton(candidate, 'Вставить поле').click(); await docButton(candidate, 'Вставить {клиент}').click();
  assert.ok((await text.inputValue()).endsWith('{клиент}'));
  await root(candidate).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  await root(candidate).locator('.cd-section-toggle').first().click();
  const actText = root(candidate).getByLabel('Текст раздела 1', { exact: true });
  await actText.fill('ПРОВЕРКА АКТА SIMPLE. ' + await actText.inputValue());
  await docButton(candidate, 'Сохранить').click(); await root(candidate).waitFor({ state: 'detached' });
  await ready(candidate, candidateOrigin); await openText(candidate);
  assert.equal(await root(candidate).locator('details.cd-template-extra').count(), 0);
  await root(candidate).locator('.cd-section-toggle').filter({ hasText: 'Предмет договора' }).click();
  assert.match(await root(candidate).getByLabel('Текст раздела 1', { exact: true }).inputValue(), /ПРОВЕРКА SIMPLE/);
  const savedTemplate = await candidate.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')));
  assert.equal(savedTemplate.settings.prepayPercent, 35, 'hidden default remains compatible; project prepayment is edited in the project');
  assert.equal(savedTemplate.appendices[0].exportOptions.type, 'total'); assert.equal(savedTemplate.appendices[0].exportOptions.cols.photo, false);
  await closeDocument(candidate);

  await candidate.evaluate(() => window.__zamer.go('account'));
  await candidate.getByRole('button', { name: 'Настройки аккаунта', exact: true }).click();
  const settings = candidate.locator('.z-account-settings'); await settings.waitFor();
  await settings.getByRole('heading', { name: 'Компания и контакты', exact: true }).waitFor();
  assert.equal(await settings.getByRole('button', { name: 'Логотип компании', exact: true }).count(), 1);
  await settings.getByRole('button', { name: 'Логотип компании', exact: true }).click();
  const logoDialog = settings.getByRole('dialog', { name: 'Логотип компании', exact: true });
  const png = await candidate.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 48; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#24364B'; ctx.fillRect(0, 0, 96, 48); ctx.fillStyle = 'white'; ctx.font = 'bold 24px Arial'; ctx.fillText('QA', 12, 31); return canvas.toDataURL('image/png').split(',')[1]; });
  const upload = async () => { const chooser = candidate.waitForEvent('filechooser'); await logoDialog.getByRole('button', { name: 'Загрузить логотип', exact: true }).click(); await (await chooser).setFiles({ name: 'qa.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await candidate.waitForFunction(() => window.__zamer.state.profile.logo?.startsWith('data:image/')); };
  await upload(); await logoDialog.getByRole('button', { name: 'Удалить логотип', exact: true }).click();
  await candidate.waitForFunction(() => window.__zamer.state.profile.logo === ''); await upload();
  const logo = await candidate.evaluate(() => window.__zamer.state.profile.logo);
  await logoDialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await settings.getByRole('button', { name: 'Готово', exact: true }).click(); await ready(candidate, candidateOrigin);
  assert.equal(await candidate.evaluate(() => window.__zamer.state.profile.logo), logo);

  await candidate.evaluate(() => { const app = window.__zamer; app.openCalc(app.state.projects[0].id); });
  await candidate.getByRole('button', { name: 'Полотно', exact: true }).click();
  const quantity = candidate.getByLabel('Общее количество Полотно 1', { exact: true });
  const value = Number((await quantity.inputValue()).replace(',', '.'));
  await quantity.fill(String(value + 1).replace('.', ',')); await quantity.press('Tab');
  const currentTotal = await candidate.evaluate(() => window.__zamer.pSum(window.__zamer.cur()));
  assert.notEqual(currentTotal, originalMoney, 'calculator change is applied before export');
  await candidate.evaluate(() => window.__zamer.go('project'));
  await candidate.getByLabel('Клиент', { exact: true }).fill('Клиент упрощённого QA'); await candidate.getByLabel('Клиент', { exact: true }).press('Tab');
  await candidate.screenshot({ path: path.join(output, 'candidate-project-current.png') });
  await candidate.evaluate(() => window.__zamer.openContract()); await root(candidate).waitFor();
  await root(candidate).getByLabel('Начало работ', { exact: true }).fill('2026-11-20'); await root(candidate).getByLabel('Окончание работ', { exact: true }).fill('2026-11-21');
  const contractPreview = await documentPreview(candidate, 'candidate-contract-preview.png'); assert.equal(contractPreview.count, 2);
  assert.match(contractPreview.proof.text, /ПРОВЕРКА SIMPLE/); assert.match(contractPreview.proof.text, /Клиент упрощённого QA/);
  const contractPdf = await downloaded(candidate, () => docButton(candidate, 'Скачать PDF').click(), 'candidate-contract.pdf', contractPreview.count);
  assert.equal(await candidate.evaluate(() => window.__zamer.cur().contract.total), currentTotal);
  await root(candidate).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  await root(candidate).getByLabel('Дата акта', { exact: true }).fill('2026-11-22'); await root(candidate).getByLabel('Работы завершены', { exact: true }).fill('2026-11-21');
  await docButton(candidate, 'Без замечаний').click();
  const actPreview = await documentPreview(candidate, 'candidate-act-preview.png'); assert.match(actPreview.proof.text, /ПРОВЕРКА АКТА SIMPLE/);
  assert.equal(Number((await root(candidate).getByLabel('Стоимость по акту, ₽', { exact: true }).inputValue()).replace(',', '.')), currentTotal);
  await docButton(candidate, 'Закрыть договор').click();
  await root(candidate).getByRole('dialog', { name: 'Сохранить изменения?', exact: true }).getByRole('button', { name: 'Закрыть без сохранения', exact: true }).click();
  await root(candidate).waitFor({ state: 'detached' });
  await candidate.evaluate(() => window.__zamer.openEstimateEditor());
  const editor = candidate.locator('.z-mobile-estimate'); await editor.waitFor();
  const photo = editor.getByRole('group', { name: 'Столбцы сметы' }).getByRole('button', { name: 'Фото', exact: true }); if (await photo.getAttribute('aria-pressed') === 'true') await photo.click();
  await editor.getByRole('button', { name: 'Предпросмотр', exact: true }).click();
  const estimate = candidate.getByRole('dialog', { name: 'Предпросмотр сметы', exact: true }); await estimate.locator('.z-estimate-pdf-page').first().waitFor(); await fonts(candidate);
  await cleanArticle(estimate.locator('.estimate-document').first());
  const estimatePages = await estimate.locator('.z-estimate-pdf-page').count();
  const estimateAmount = await estimate.locator('[data-estimate-grand-total]').first().textContent();
  assert.equal(Number(estimateAmount.replace(/[\s₽]/g, '').replace(',', '.')), currentTotal);
  await candidate.screenshot({ path: path.join(output, 'candidate-estimate-preview.png') });
  console.log('Closing estimate preview.');
  await estimate.getByRole('button', { name: 'Закрыть предпросмотр сметы', exact: true }).click();
  console.log('Closing estimate editor.');
  await editor.getByRole('button', { name: 'Закрыть редактор сметы', exact: true }).click();
  const candidateBeforeReopen = await raw(candidate);
  assert.deepEqual(await raw(original), sourceBefore, 'all candidate edits and exports leave both original source strings byte unchanged');
  console.log('Original bytes unchanged; opening comparison again.');
  await original.evaluate(() => { window.__holdComparison = false; });
  const secondPopup = original.waitForEvent('popup');
  await original.getByRole('button', { name: 'Открыть упрощённый', exact: true }).click();
  const reopened = await secondPopup; await reopened.waitForURL(/\/design\/index\.html/, { waitUntil: 'domcontentloaded' });
  const preserved = await raw(reopened);
  const beforeDesign = JSON.parse(candidateBeforeReopen['zamer.design.v1']), afterDesign = JSON.parse(preserved['zamer.design.v1']);
  assert.deepEqual(afterDesign.profile, beforeDesign.profile, 'second opening preserves candidate profile');
  assert.deepEqual(afterDesign.projects, beforeDesign.projects, 'second opening preserves candidate projects');
  assert.deepEqual(JSON.parse(preserved['zamer.contractTpl']), JSON.parse(candidateBeforeReopen['zamer.contractTpl']), 'second opening preserves candidate template');
  await reopened.close(); assert.deepEqual(await raw(original), sourceBefore);
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ sourceKeysUnchanged: true, onlyTwoKeysTransferred: true, forgedOriginAndSourceIgnored: true, secondOpenPreservesCandidate: true, originalMoney, currentTotal, contractPdf, actPreviewPages: actPreview.count, estimatePreviewPages: estimatePages }, null, 2));
  await context.tracing.stop({ path: path.join(output, 'trace.zip') });
  console.log('Comparison isolation, simplified UI, text/logo persistence, actual contract PDF and act/estimate previews passed.');
} catch (error) {
  if (candidate && !candidate.isClosed()) await candidate.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
  throw error;
} finally { await browser.close(); }
