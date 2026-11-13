import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const output = path.resolve('artifacts/document-editor-tweaks');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await context.newPage(); page.setDefaultTimeout(10000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const shell = page.locator('.z-contract-shell');
const button = name => shell.getByRole('button', { name, exact: true });
async function ready() { await page.goto('http://127.0.0.1:5174/design/app.html?screen=app', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__zamer && window.MagicContract && window.MagicDocuments && window.MagicEstimate); }
async function template() { await page.evaluate(() => window.__zamer.openContractTpl()); await shell.waitFor(); }
async function close() { await button('Закрыть договор').click(); await shell.waitFor({ state: 'detached' }); }
async function estimate() { await page.evaluate(() => { const app = window.__zamer; app.setState({ screen: 'project', curId: app.state.projects[0].id }, () => app.openEstimateEditor()); }); await page.locator('.z-mobile-estimate').waitFor(); }
try {
  await ready();
  await page.evaluate(() => {
    const app = window.__zamer, project = structuredClone(app.state.projects.find(project => /Дзержинского/.test(project.name)));
    project.name = 'Мелкие правки QA'; project.client = 'Клиент QA'; project.address = 'Тестовый адрес'; project.contract = null;
    project.estimateExportOptions = { type: 'total', cols: { photo: false, qty: false } };
    const company = { company: 'Компания QA', legalForm: 'ip', legal: 'Тестовый исполнитель', inn: '123456789012', address: 'Тестовый адрес компании', description: 'ппп' };
    app.setState({ projects: [project], curId: project.id, screen: 'dash', profile: company }, () => app.saveDesign());
    localStorage.setItem('zamer.contractTpl', JSON.stringify({ head: company, settings: { prepayPercent: 35 } }));
  });
  const total = await page.evaluate(() => window.__zamer.pSum(window.__zamer.state.projects[0]));
  await template();
  assert.equal(await shell.locator('.cd-template-extra').count(), 0);
  assert.equal(await shell.getByLabel('Предоплата, %', { exact: true }).count(), 0);
  await shell.getByRole('heading', { name: 'Приложения', exact: true }).waitFor();
  await button('+ Добавить приложение').click();
  assert.equal(await shell.getByRole('dialog', { name: 'Добавить приложение', exact: true }).count(), 0);
  const title = shell.getByLabel('Приложение 3', { exact: true }); await title.waitFor();
  assert.equal(await title.evaluate(element => document.activeElement === element), true, 'new appendix title receives focus');
  await title.fill('Порядок доступа QA'); await shell.getByLabel('Текст приложения 3', { exact: true }).fill('Доступ согласовать с {клиент}.');
  await page.screenshot({ path: path.join(output, 'appendix-inline.png') });
  await button('Сохранить').click(); await shell.waitFor({ state: 'detached' }); await ready(); await template();
  await shell.locator('.cd-section-toggle').filter({ hasText: 'Порядок доступа QA' }).click();
  assert.equal(await shell.getByLabel('Текст приложения 3', { exact: true }).inputValue(), 'Доступ согласовать с {клиент}.');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')).settings.prepayPercent), 35);
  await shell.locator('.cd-section-toggle').filter({ hasText: 'Приложение №1' }).click();
  await button('Удалить приложение 1').click(); await button('+ Добавить смету из проекта').click();
  assert.equal(await shell.getByRole('dialog').count(), 0, 'estimate restore is inline');
  await button('Параметры сметы').click(); await button('Фото').click(); await button('Сохранить параметры').click();
  await button('Сохранить').click(); await shell.waitFor({ state: 'detached' }); await ready(); await template();
  await shell.locator('.cd-section-toggle').filter({ hasText: 'Приложение №1' }).click(); await button('Параметры сметы').click();
  assert.equal(await button('Фото').getAttribute('aria-pressed'), 'false', 'appendix photo OFF survives saving parameters and reloading');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')).appendices.find(row => row.kind === 'estimate').exportOptions.columnsDefaultsVersion), 1);
  await shell.getByRole('dialog', { name: 'Параметры сметы', exact: true }).getByRole('button', { name: 'Закрыть', exact: true }).click(); await close();
  await page.evaluate(() => { const app = window.__zamer; app.setState({ screen: 'project', curId: app.state.projects[0].id }, () => app.openContract()); }); await shell.waitFor();
  assert.equal(await shell.getByLabel('Предоплата, ₽', { exact: true }).isVisible(), true);
  for (const tab of ['Договор', 'Акт выполненных работ']) {
    await shell.getByRole('tab', { name: tab, exact: true }).click();
    assert.equal(await shell.locator('.cd-footer').getByRole('button').count(), 2);
    assert.equal(await button('Скачать PDF').count(), 1); assert.equal(await shell.getByRole('button', { name: /Отправить/ }).count(), 0);
    await button('Предпросмотр документа').click();
    const header = shell.locator('.cd-pdf-page [data-document-kind] header').first(); await header.waitFor();
    assert.doesNotMatch(await header.textContent(), /ппп/); await button('Закрыть договор').click();
  }
  await close(); await estimate();
  const editor = page.locator('.z-mobile-estimate'), columns = editor.getByRole('group', { name: 'Столбцы сметы', exact: true }).getByRole('button');
  assert.equal(await columns.count(), 7);
  for (const column of await columns.all()) assert.equal(await column.getAttribute('aria-pressed'), 'true', 'legacy unversioned settings start with every column enabled');
  assert.equal(await editor.getByRole('button', { name: /Позиции сметы|Отправить/ }).count(), 0);
  await page.screenshot({ path: path.join(output, 'estimate-seven-columns.png') });
  await editor.getByRole('button', { name: 'Фото', exact: true }).click();
  await editor.getByRole('button', { name: 'Закрыть редактор сметы', exact: true }).click(); await ready(); await estimate();
  assert.equal(await editor.getByRole('button', { name: 'Фото', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => window.__zamer.cur().estimateExportOptions.columnsDefaultsVersion), 1);
  await editor.getByRole('button', { name: 'Предпросмотр', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Предпросмотр сметы', exact: true });
  await preview.locator('.z-estimate-pdf-page').first().waitFor();
  assert.doesNotMatch(await preview.locator('.estimate-document header').first().textContent(), /ппп/);
  assert.equal(await page.evaluate(() => window.__zamer.pSum(window.__zamer.cur())), total, 'UI changes leave totals unchanged');
  assert.equal(await page.evaluate(() => window.__zamer.state.profile.description), 'ппп', 'legacy description remains stored');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')).head.description), 'ппп');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ inlineAppendixPersists: true, estimateRestoreInline: true, projectPrepayPresent: true, defaultPrepayRetained: 35, legacySevenColumnsOn: true, manualPhotoOffPersists: true, appendixPhotoOffPersists: true, noSendOrPositions: true, legacyDescriptionHiddenButRetained: true, total }, null, 2));
  console.log('Editor tweaks: inline appendices, seven-column migration, manual photo OFF, one PDF action and hidden legacy description passed.');
} catch (error) { await page.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {}); throw error; }
finally { await browser.close(); }
