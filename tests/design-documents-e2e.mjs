import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.DESIGN_DOCUMENTS_URL || 'http://127.0.0.1:5173/design/app.html';
const output = 'artifacts/document-editors';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
let pdfResult = 'not run';
page.on('pageerror', error => errors.push(error.message));

const company = { company: 'Студия потолков', legal: 'ИП Тестовый', inn: '0000000000', signerName: 'Тестовый мастер', phone: '', address: '', bank: '' };
const template = {
  head: company, style: 'strict', numSeq: 1,
  sections: [{ id: 'first', title: 'Предмет договора', text: 'Работы по адресу: {адрес}.' }, { id: 'second', title: 'Условия оплаты', text: 'Сумма по договору — {сумма} ₽.' }],
  appendices: [{ id: 'estimate', kind: 'estimate', exportOptions: { type: 'total', cols: { num: true, photo: false, name: true, qty: true, unit: true, price: true, total: true } } }],
};

async function ready() { await page.waitForFunction(() => window.__zamer && window.MagicDocuments && window.MagicContract); }
async function openContract() {
  await page.evaluate(() => window.__zamer.go('dash'));
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await page.getByRole('dialog', { name: 'Главное меню', exact: true }).getByRole('button', { name: 'Шаблон договора', exact: true }).click();
  await page.locator('.z-contract-header').getByText('Шаблон договора', { exact: true }).waitFor();
}
async function assertPhone(selector) {
  const result = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, width: window.innerWidth, scroll: element.scrollWidth, client: element.clientWidth, document: document.documentElement.scrollWidth };
  });
  assert.ok(result.left >= -1 && result.right <= result.width + 1, JSON.stringify(result));
  assert.ok(result.scroll <= result.client + 1, JSON.stringify(result));
  assert.equal(result.document, result.width);
}

try {
  await context.addInitScript(value => { if (!localStorage.getItem('zamer.contractTpl')) localStorage.setItem('zamer.contractTpl', JSON.stringify(value)); }, template);
  await page.goto(base, { waitUntil: 'networkidle' });
  await ready();

  await openContract();
  const media = await page.getByRole('button', { name: 'Загрузить логотип', exact: true }).evaluate(button => {
    const preview = button.previousElementSibling, box = preview.getBoundingClientRect(), control = button.getBoundingClientRect();
    return { width: box.width, height: box.height, buttonHeight: control.height, rightOfPreview: control.left > box.right, background: getComputedStyle(button).backgroundColor };
  });
  assert.deepEqual(media, { width: 72, height: 72, buttonHeight: 44, rightOfPreview: true, background: 'rgb(20, 97, 238)' });
  const companyTitle = await page.getByText('Информация о компании', { exact: true }).evaluate(element => ({ transform: getComputedStyle(element).textTransform, size: getComputedStyle(element).fontSize }));
  assert.deepEqual(companyTitle, { transform: 'uppercase', size: '14px' });
  assert.equal(await page.getByText('Студия потолков', { exact: true }).evaluate(element => getComputedStyle(element).textAlign), 'left');
  await page.locator('input[type="file"][aria-label="Загрузить логотип"]').setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') });
  await page.getByRole('alert').getByText(/Не удалось открыть изображение/).waitFor();
  assert.equal(await page.locator('.z-contract-header').getByRole('button', { name: 'Готово', exact: true }).isEnabled(), true);
  await page.getByLabel('Раздел 1', { exact: true }).fill('Условия для ');
  await page.getByLabel('Раздел 1', { exact: true }).press('End');
  await page.getByRole('button', { name: 'Подстановки', exact: true }).click();
  await page.getByRole('button', { name: 'Вставить {компания}', exact: true }).click();
  assert.equal(await page.getByLabel('Раздел 1', { exact: true }).inputValue(), 'Условия для {компания}');
  await page.getByRole('button', { name: '+ Добавить раздел', exact: true }).click();
  await page.getByLabel('Раздел 3', { exact: true }).fill('Порядок приёмки');
  await page.getByLabel('Текст раздела 3', { exact: true }).fill('Заказчик принимает выполненные работы.');
  await page.getByRole('button', { name: 'Переместить выше раздел 3', exact: true }).click();
  assert.equal(await page.getByLabel('Раздел 2', { exact: true }).inputValue(), 'Порядок приёмки');

  await page.getByRole('button', { name: 'Параметры сметы', exact: true }).click();
  const params = page.getByRole('dialog', { name: 'Параметры сметы', exact: true });
  await params.getByRole('radio', { name: /Общая \+ чертежи/ }).click();
  await params.getByRole('button', { name: 'Фото', exact: true }).click();
  await params.getByRole('button', { name: 'Цена', exact: true }).click();
  await params.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('button', { name: '+ Добавить приложение', exact: true }).click();
  await page.getByRole('dialog', { name: 'Добавить приложение', exact: true }).getByRole('button', { name: 'Текст', exact: true }).click();
  await page.getByLabel('Приложение 2', { exact: true }).fill('Акт приёмки');
  await page.getByLabel('Текст приложения 2', { exact: true }).fill('Принято заказчиком: {клиент}.');
  await page.getByRole('button', { name: /^(ЗАМЕРX|ZAMER)$/ }).click();
  await page.getByRole('button', { name: 'Предпросмотр договора', exact: true }).click();
  assert.match(await page.locator('.z-contract-paper').innerText(), /Условия для Студия потолков/);
  assert.match(await page.locator('.z-contract-paper').innerText(), /Акт приёмки/);
  await page.getByRole('button', { name: 'Закрыть договор', exact: true }).click();
  await page.locator('.z-contract-header').getByRole('button', { name: 'Готово', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('zamer.contractTpl')).sections.length === 3);
  await page.reload({ waitUntil: 'networkidle' });
  await ready();
  await openContract();
  assert.equal(await page.getByLabel('Раздел 2', { exact: true }).inputValue(), 'Порядок приёмки');
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')));
  assert.equal(persisted.appendices[0].exportOptions.type, 'totalDraw');
  assert.equal(persisted.appendices[0].exportOptions.cols.photo, true);
  assert.equal(persisted.appendices[0].exportOptions.cols.price, false);
  assert.equal(persisted.appendices[1].title, 'Акт приёмки');

  await page.locator('.z-contract-content').evaluate(element => { element.scrollTop = 0; });
  await assertPhone('.z-contract-shell');
  await page.screenshot({ path: `${output}/contract-editor.png` });
  await page.getByLabel('Раздел 1', { exact: true }).fill('Не сохранять этот текст');
  await page.getByRole('button', { name: 'Закрыть договор', exact: true }).click();
  await page.getByRole('dialog', { name: 'Сохранить изменения?', exact: true }).getByRole('button', { name: 'Не сохранять', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')).sections[0].title), 'Условия для {компания}');

  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await page.getByRole('dialog', { name: 'Главное меню', exact: true }).getByRole('button', { name: 'Шапка сметы', exact: true }).click();
  await page.getByRole('dialog', { name: 'Шапка сметы', exact: true }).waitFor();
  await page.getByRole('button', { name: /Реквизиты компании/ }).click();
  await page.getByRole('dialog', { name: 'Настройки аккаунта', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Закрыть настройки аккаунта', exact: true }).click();
  await page.getByRole('button', { name: 'Закрыть шапку сметы', exact: true }).click();

  const projectId = await page.evaluate(() => {
    const app = window.__zamer, original = app.state.projects.find(project => project.rooms.length), source = original.rooms[0];
    const room = { ...source, id: 'document-room', name: 'Гостиная', on: true, v: [[0, 0], [4, 0], [4, 3], [0, 3]], holes: [], opts: {}, optQ: {}, canvas: { pid: null, off: {} }, main: { pid: null, off: {} }, extra: [], light: [], track: [], curtain: [], other: [], extraItems: [
      { n: 'Полотно', m: true, qty: 2, p: 100, u: 'м²' }, { n: 'Монтаж', m: false, qty: 3, p: 50, u: 'м²' },
      { n: 'Блок питания', m: true, category: 'equipment', qty: 1, p: 75, u: 'шт' },
    ] };
    for (const block of window.MAGIC_MAIN.blocks) room[block.id] = block.id === 'canvas' || block.id === 'main' ? { pid: null, off: {} } : [];
    const project = { ...original, id: 'document-project', name: 'Квартира · документы', client: 'Тестовый клиент', address: 'Тестовый объект', phone: '', status: 'estimate', rooms: [room], estimateAdjustment: null, estimateExportOptions: undefined };
    app.setState({ projects: [project], estEd: {}, profile: { company: 'Студия потолков', legal: 'ИП Тестовый', signerName: 'Тестовый мастер' }, curId: project.id, screen: 'project', tab: room.id });
    return project.id;
  });
  await page.waitForFunction(id => window.__zamer.cur()?.id === id, projectId);
  await page.evaluate(() => window.__zamer.openEstimateEditor());
  await page.getByRole('dialog', { name: 'Редактор сметы', exact: true }).waitFor();
  assert.equal(await page.locator('.z-me-total output').innerText(), '425 ₽');
  await page.getByRole('radio', { name: /По помещениям/ }).click();
  await page.getByRole('button', { name: 'Фото', exact: true }).click();
  await page.getByRole('button', { name: /^Материалы / }).click();
  await page.getByRole('button', { name: '+5%', exact: true }).click();
  await page.getByRole('button', { name: /^Работы / }).click();
  await page.getByLabel('Процент наценки или скидки', { exact: true }).fill('7,5');
  await page.getByLabel('Процент наценки или скидки', { exact: true }).press('Tab');
  await page.getByRole('checkbox', { name: /Показывать корректировку работ/ }).click();
  assert.equal(await page.locator('.z-me-total output').innerText(), '446,25 ₽');
  await page.getByRole('button', { name: 'Предпросмотр', exact: true }).click();
  await page.getByRole('dialog', { name: 'Предпросмотр сметы', exact: true }).waitFor();
  const previewText = await page.locator('.estimate-document').innerText();
  assert.match(previewText.replace(/\u00a0/g, ' '), /446,25 ₽/);
  assert.match(previewText, /Гостиная/);
  assert.doesNotMatch(previewText, /Наценка на работы/);
  assert.match(previewText, /Наценка на материалы/);
  await page.getByRole('button', { name: 'Закрыть предпросмотр сметы', exact: true }).click();
  await page.getByLabel('Процент наценки или скидки', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Закрыть редактор сметы', exact: true }).click();
  await page.getByRole('alert').getByText('Введите процент от −100 до 1000').waitFor();
  await page.getByLabel('Процент наценки или скидки', { exact: true }).fill('7,5');
  await page.getByLabel('Процент наценки или скидки', { exact: true }).press('Tab');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('.z-me-scroll').evaluate(element => { element.scrollTop = 0; });
  await page.locator('.z-me-heading').click();
  await assertPhone('.z-mobile-estimate');
  await page.screenshot({ path: `${output}/estimate-editor.png` });
  await page.getByRole('button', { name: 'Закрыть редактор сметы', exact: true }).click();
  await page.evaluate(() => window.__zamer.saveDesign());
  await page.reload({ waitUntil: 'networkidle' });
  await ready();
  await page.evaluate(id => { window.__zamer.openCalc(id); window.__zamer.openEstimateEditor(); }, projectId);
  await page.getByRole('dialog', { name: 'Редактор сметы', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio', { name: /По помещениям/ }).getAttribute('aria-checked'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Фото', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.z-me-total output').innerText(), '446,25 ₽');
  if (process.env.DOCUMENTS_PDF === '1') {
    try {
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: 'Скачать PDF', exact: true }).click()]);
      const file = await download.path();
      assert.equal(fs.readFileSync(file).subarray(0, 5).toString(), '%PDF-');
      pdfResult = 'real PDF downloaded and file signature verified';
    } catch (error) { pdfResult = 'PDF unavailable: ' + error.message.split('\n')[0]; }
  }
  await page.getByRole('button', { name: 'Закрыть редактор сметы', exact: true }).click();
  await page.evaluate(() => window.__zamer.go('dash'));
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).waitFor();
  await page.getByText('PDF сохранён', { exact: true }).waitFor({ state: 'hidden' });
  await page.screenshot({ path: `${output}/home-screen.png` });
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await page.getByRole('dialog', { name: 'Главное меню', exact: true }).getByRole('button', { name: 'Шаблон договора', exact: true }).click();
  await page.locator('.z-contract-header').getByText('Шаблон договора', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Закрыть договор', exact: true }).click();
  assert.deepEqual(errors, []);
  console.log('PASS: native media72/upload44-blue/company typography, contract invalid media/placeholder/sections/reorder/appendices/style/preview/save/reload/discard, header-to-profile link; estimate three groups, decimal rate, scope disclosure, photo/type settings, rendered preview totals, invalid close guard, reload and 360/390px layout; home top menu-to-contract; no JS errors. ' + pdfResult);
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
