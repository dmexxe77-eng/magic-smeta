import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Local, isolated document checks: no production data or application projects
// are changed. Run after `npm run design` with the existing Vite server.
const base = process.env.CONTRACT_URL || 'http://127.0.0.1:5173/design/app.html?screen=app';
const output = path.resolve(process.env.CONTRACT_ARTIFACT_DIR || 'artifacts/contract-example');
await fs.mkdir(output, { recursive: true });

const company = {
  company: 'Студия потолков', legal: 'ИП Тестовый мастер', legalForm: 'ip',
  inn: '270000000000', address: 'г. Хабаровск', phone: '+7 999 000-00-00',
  // A legacy saved signature must never appear in either document.
  sign: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  signerName: 'НЕ_ВЫВОДИТЬ_ПОДПИСЬ',
};
const initialTemplate = {
  head: company, style: 'accent', numSeq: 41,
  settings: { prepayPercent: 50, customerType: 'universal', warrantyWorksMonths: '', warrantyMaterials: 'По условиям изготовителя' },
  sections: [
    { id: 'scope', title: 'Предмет договора', text: 'Исполнитель выполняет работы по адресу: {адрес}. Заказчик: {клиент}. Площадь: {площадь} м².' },
    { id: 'price', title: 'Стоимость и оплата', text: 'Стоимость {сумма} ₽. Предоплата {предоплата} ₽. Остаток {остаток} ₽.' },
  ],
  appendices: [
    { id: 'estimate', kind: 'estimate', exportOptions: { type: 'total', cols: { num: true, photo: false, name: true, qty: true, unit: true, price: true, total: true } } },
    { id: 'access', kind: 'text', title: 'Условия доступа', text: 'Время доступа согласовывается с {клиент}.' },
  ],
};
const fixture = {
  project: { id: 'contract-fixture', name: 'Квартира · пример документов', client: 'Иван Петров', phone: '+7 999 111-22-33', address: 'г. Хабаровск, ул. Примерная, д. 12', paid: 3400, status: 'estimate' },
  total: 10000.5, area: 12, installDate: '20.11.2026', company,
  est: { mats: [{ n: 'Полотно', q: 2, p: 2500.25, u: 'м²' }], works: [{ n: 'Монтаж потолка', q: 1, p: 5000, u: 'усл' }] },
  rooms: [{ id: 'room', name: 'Гостиная', v: [[0, 0], [4, 0], [4, 3], [0, 3]], on: true }],
};

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const results = [];
let currentPage;

function shell(page) { return page.locator('.z-contract-shell'); }
function button(page, name) { return shell(page).getByRole('button', { name, exact: true }); }
async function settleDocumentFonts(page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function ready(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.MagicContract?.open && window.MagicContract?.openTemplate && window.__zamer, null, { timeout: 30000 });
}

async function openTemplate(page, viaMenu = false) {
  if (viaMenu) {
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Главное меню', exact: true });
    assert.equal(await menu.getByRole('button', { name: 'Дизайнеры', exact: true }).count(), 0, 'global menu has no designer entry');
    await menu.getByRole('button', { name: /Шаблоны документов|Шаблон договора/ }).click();
  } else {
    await page.evaluate(() => {
      let handle;
      handle = window.MagicContract.openTemplate({ onClose: () => handle.close() });
    });
  }
  await shell(page).waitFor();
}

async function openProject(page, { saved = null, source = fixture, saveError = null } = {}) {
  await page.evaluate(({ source, saved, saveError }) => {
    window.__documentSaves = [];
    window.__projectPatches = [];
    window.__documentValue = saved;
    let handle;
    handle = window.MagicContract.open({
      ...source, contract: saved,
      onSaveContract(value) { if (saveError) throw new Error(saveError); window.__documentValue = structuredClone(value); window.__documentSaves.push(structuredClone(value)); },
      onProjectPatch(value) { window.__projectPatches.push(structuredClone(value)); },
      onClose: () => handle.close(),
    });
  }, { source, saved, saveError });
  await shell(page).waitFor();
}

async function closeProject(page) {
  await button(page, 'Закрыть договор').click();
  await shell(page).waitFor({ state: 'detached' });
}

async function assertLayout(page, label, screenshot) {
  const layout = await shell(page).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, width: innerWidth, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, documentWidth: document.documentElement.scrollWidth };
  });
  assert.ok(layout.left >= -1 && layout.right <= layout.width + 1, `${label}: ${JSON.stringify(layout)}`);
  assert.ok(layout.scrollWidth <= layout.clientWidth + 1, `${label}: ${JSON.stringify(layout)}`);
  assert.ok(layout.documentWidth <= layout.width + 1, `${label}: ${JSON.stringify(layout)}`);
  assert.equal(await shell(page).getByRole('button', { name: /^(Физлицо|Юрлицо|Физическое лицо|Юридическое лицо)$/ }).count(), 0, 'no customer-type choice in the first example');
  assert.equal(await shell(page).getByRole('button', { name: /Загрузить подпись|Нарисовать подпись|Подписать онлайн/ }).count(), 0, 'signature features are absent');
  assert.equal(await shell(page).getByRole('button', { name: /Сформировать договор|Сформировать акт|Новая редакция|История|Предыдущий PDF/ }).count(), 0, 'direct export has no document history or formation step');
  if (screenshot) await page.screenshot({ path: path.join(output, screenshot) });
  return layout;
}

async function assertNoSignature(html) {
  assert.doesNotMatch(html, /НЕ_ВЫВОДИТЬ_ПОДПИСЬ|data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB/);
  assert.doesNotMatch(html, /class=["'][^"']*(?:signature|sign-line)|подпись_фио|client_signature/i);
  assert.doesNotMatch(html, /\{[а-яё_]+\}/iu, 'document contains no unresolved template fields');
}

async function preview(page, filename) {
  await button(page, 'Предпросмотр документа').click();
  const pages = shell(page).locator('.cd-pdf-page');
  await pages.first().waitFor();
  await settleDocumentFonts(page);
  assert.equal(await shell(page).getByRole('button', { name: /^(Читать|Лист)$/ }).count(), 0, 'PDF preview has no reading-mode toggle');
  const html = await pages.first().locator('.cd-pdf-document').innerHTML();
  await assertNoSignature(html);
  const metrics = await pages.evaluateAll(elements => elements.map((element, index) => {
    const clip = element.querySelector('.cd-pdf-clip').getBoundingClientRect();
    const document = element.querySelector('.cd-pdf-document');
    const whole = rectangle => rectangle.top >= clip.top - 1 && rectangle.bottom <= clip.bottom + 1;
    const overlaps = rectangle => rectangle.bottom > clip.top + 1 && rectangle.top < clip.bottom - 1;
    const footers = [...document.querySelectorAll('.contract-doc-footer')].filter(footer => overlaps(footer.getBoundingClientRect())).map(footer => {
      const article = footer.closest('[data-document-kind]');
      const kind = article.dataset.documentKind;
      const previous = kind === 'estimate' ? [...article.querySelectorAll('table tr')].at(-1) : article.querySelector('.contract-requisites') || [...article.querySelectorAll('p')].at(-1);
      return { kind, whole: whole(footer.getBoundingClientRect()), previousWhole: !!previous && whole(previous.getBoundingClientRect()) };
    });
    const walker = window.document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
    let contentCharacters = 0, bodyCharacters = 0, textIndex = 0;
    const partialTextLines = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest('style,script,.contract-doc-footer')) continue;
      const range = window.document.createRange(); range.selectNodeContents(node);
      const rectangles = [...range.getClientRects()].filter(rectangle => rectangle.width > 0 && rectangle.height > 0);
      rectangles.forEach((rectangle, index) => { if (overlaps(rectangle) && !whole(rectangle)) partialTextLines.push(`${textIndex}:${index}`); });
      textIndex++;
      if (rectangles.some(rectangle => overlaps(rectangle))) {
        contentCharacters += node.textContent.trim().length;
        if (!node.parentElement.closest('header,.contract-requisites')) bodyCharacters += node.textContent.trim().length;
      }
    }
    return {
      number: Number(element.dataset.pdfPage),
      label: element.querySelector('figcaption').textContent,
      starts: [...document.querySelectorAll('[data-contract-appendix]')].map(appendix => ({ kind: appendix.dataset.contractAppendix, number: Number(appendix.dataset.appendixNumber), distance: appendix.getBoundingClientRect().top - clip.top })).filter(appendix => Math.abs(appendix.distance) < 2),
      index,
      contentCharacters,
      bodyCharacters,
      hasRequisites: [...document.querySelectorAll('.contract-requisites')].some(element => overlaps(element.getBoundingClientRect())),
      partialTextLines,
      footers,
      rows: [...document.querySelectorAll('[data-contract-appendix="estimate"] table tr')].map((row, index) => ({ index, whole: whole(row.getBoundingClientRect()) })).filter(row => row.whole).map(row => row.index),
    };
  }));
  const appearance = await pages.first().locator('.cd-pdf-document [data-document-kind]').first().evaluate(element => ({
    style: element.dataset.contractStyle, layout: element.dataset.contractLayout,
    font: getComputedStyle(element).fontFamily, padding: getComputedStyle(element).padding,
    headerBackground: getComputedStyle(element.querySelector('header')).backgroundColor,
    naturalHeight: element.offsetHeight, naturalWidth: element.offsetWidth,
    phoneWhiteSpace: element.querySelector('.contract-brand-phone') ? getComputedStyle(element.querySelector('.contract-brand-phone')).whiteSpace : null,
  }));
  await page.evaluate(({ appearance, metrics }) => { window.__lastDocumentAppearance = appearance; window.__lastDocumentPreview = metrics; }, { appearance, metrics });
  assert.deepEqual(metrics.map(page => page.number), Array.from({ length: metrics.length }, (_, index) => index + 1));
  for (const page of metrics) {
    assert.ok(page.contentCharacters > 0, `PDF page ${page.number} must contain body content rather than only a footer/frame`);
    assert.deepEqual(page.partialTextLines, [], `PDF page ${page.number} must not cut through a text line`);
    if (page.hasRequisites) assert.ok(page.bodyCharacters > 0, `PDF page ${page.number} must not contain only requisites and a footer`);
    for (const footer of page.footers) {
      assert.ok(footer.whole, `${footer.kind} footer must fit on a single page`);
      assert.ok(footer.previousWhole, `${footer.kind} footer stays with its last row or requisites`);
    }
  }
  if (html.includes('z-contract-packet')) {
    const packet = await pages.first().locator('.cd-pdf-document').evaluate(element => {
      const requisites = element.querySelector('[data-document-kind="contract"] .contract-requisites');
      const appendices = [...element.querySelectorAll('[data-contract-appendix]')];
      return {
        end: !!element.querySelector('.z-contract-packet > [data-contract-packet-end][data-pdf-content-end]'),
        requisitesBefore: appendices.every(appendix => !!(requisites.compareDocumentPosition(appendix) & Node.DOCUMENT_POSITION_FOLLOWING)),
        appendices: appendices.map(appendix => ({ kind: appendix.dataset.contractAppendix, number: Number(appendix.dataset.appendixNumber), breakBefore: appendix.hasAttribute('data-pdf-break-before') })),
        actCount: element.querySelectorAll('[data-contract-appendix="act"], [data-document-kind^="acceptance"]').length,
      };
    });
    assert.ok(packet.end && packet.requisitesBefore, 'packet ends after appendices and contract requisites precede them');
    assert.equal(packet.actCount, 0, 'contract packet contains no act; acts are exported from their own tab');
    let previous = 0;
    for (const appendix of packet.appendices) {
      assert.ok(appendix.breakBefore);
      assert.equal(appendix.number, appendix.kind === 'estimate' ? 1 : appendix.kind === 'act' ? 2 : 3);
      const matching = metrics.filter(page => page.starts.some(start => start.kind === appendix.kind && start.number === appendix.number));
      assert.equal(matching.length, 1, `${appendix.kind} starts at the top of one PDF page`);
      assert.ok(matching[0].number > previous && matching[0].number > 1, 'each appendix starts on a separate subsequent page');
      previous = matching[0].number;
    }
    const rowCount = await pages.first().locator('.cd-pdf-document [data-contract-appendix="estimate"] table tr').count();
    assert.deepEqual(metrics.flatMap(page => page.rows).sort((a, b) => a - b), Array.from({ length: rowCount }, (_, index) => index), 'every estimate row appears whole on exactly one preview page');
  }
  await assertLayout(page, 'preview', filename);
  if (filename?.includes('default') || filename?.includes('footer') || filename?.startsWith('base-contract-')) {
    for (let index = 0; index < metrics.length; index++) await pages.nth(index).screenshot({ path: path.join(output, filename.replace('.png', `-page-${index + 1}.png`)) });
    await fs.writeFile(path.join(output, filename.replace('.png', '-pages.json')), JSON.stringify(metrics, null, 2));
  }
  await button(page, 'Закрыть договор').click();
  return html;
}

async function assertNoOpenSave(page, expectedSequence = 41) {
  await page.clock.runFor(750);
  assert.equal(await page.evaluate(() => window.__documentSaves.length), 0, 'opening or previewing a document does not save it');
  assert.equal(await page.evaluate(() => window.__projectPatches.length), 0, 'opening does not patch project data');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')).numSeq), expectedSequence, 'opening does not allocate a contract number');
}

async function downloadPdf(page, filename, action = 'Скачать PDF') {
  await preview(page);
  const previewPages = await page.evaluate(() => window.__lastDocumentPreview.length);
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
  await button(page, action).click();
  const download = await downloadPromise;
  const file = path.join(output, filename);
  await download.saveAs(file);
  const bytes = await fs.readFile(file);
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', 'real PDF export writes PDF bytes');
  assert.ok(bytes.length > 1000, 'generated document has content');
  const pdfPages = [...bytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.equal(pdfPages, previewPages, 'downloaded PDF and preview have matching page counts');
  await button(page, 'Скачать PDF').waitFor();
  return { path: file, bytes: bytes.length, pages: pdfPages };
}

async function templatePersistence(page) {
  await shell(page).locator('.cd-section-toggle').filter({ hasText: 'Предмет договора' }).click();
  await shell(page).getByLabel('Раздел 1', { exact: true }).fill('Работы по договору');
  const text = shell(page).getByLabel('Текст раздела 1', { exact: true });
  await text.fill('Проверка сохранения: ');
  await text.focus();
  await text.evaluate(element => element.setSelectionRange(element.value.length, element.value.length));
  await button(page, 'Вставить поле').click();
  await shell(page).getByRole('button', { name: 'Вставить {клиент}', exact: true }).click();
  assert.equal(await text.inputValue(), 'Проверка сохранения: {клиент}');
  await shell(page).locator('.cd-section-toggle').filter({ hasText: 'Вступление' }).click();
  await shell(page).getByLabel('Текст вступления', { exact: true }).fill('ПРОВЕРКА ВСТУПЛЕНИЯ: {клиент}.');
  const editedPreview = await preview(page, 'template-edited-preamble-390.png');
  assert.match(editedPreview, /ПРОВЕРКА ВСТУПЛЕНИЯ: Иванов Алексей Сергеевич\./);
  assert.doesNotMatch(editedPreview, /ПРОВЕРКА ВСТУПЛЕНИЯ: \{клиент\}/);
  await button(page, 'Сохранить настройки').click();
  await shell(page).waitFor({ state: 'detached' });
  await ready(page);
  await openTemplate(page);
  await shell(page).locator('.cd-section-toggle').filter({ hasText: 'Вступление' }).click();
  assert.equal(await shell(page).getByLabel('Текст вступления', { exact: true }).inputValue(), 'ПРОВЕРКА ВСТУПЛЕНИЯ: {клиент}.', 'edited preamble survives saving and reload');
  await shell(page).locator('.cd-section-toggle').filter({ hasText: 'Работы по договору' }).click();
  assert.equal(await shell(page).getByLabel('Текст раздела 1', { exact: true }).inputValue(), 'Проверка сохранения: {клиент}');
  await shell(page).getByLabel('Раздел 1', { exact: true }).fill('НЕ СОХРАНЯТЬ');
  await button(page, 'Закрыть договор').click();
  await shell(page).getByRole('dialog', { name: 'Сохранить изменения?', exact: true }).getByRole('button', { name: 'Не сохранять', exact: true }).click();
  await shell(page).waitFor({ state: 'detached' });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')));
  assert.equal(stored.sections[0].title, 'Работы по договору', 'discard keeps the saved template');
  // Restore the meaningful fixture after checking edits, without real user data.
  await page.evaluate(template => localStorage.setItem('zamer.contractTpl', JSON.stringify(template)), initialTemplate);
}

async function captureDefaultExample(page) {
  // Normalization supplies the complete shipping text, rather than the short
  // two-section fixture used for focused workflow assertions above.
  await page.evaluate(head => localStorage.setItem('zamer.contractTpl', JSON.stringify({ head, style: 'magic', numSeq: 41 })), company);
  await openTemplate(page);
  assert.ok(await shell(page).locator('.cd-section-toggle').count() >= 7, 'shipping contract contains the full prepared text');
  await assertLayout(page, 'default template', 'template-default-390.png');
  const contract = await preview(page, 'template-default-contract-preview-390.png');
  await fs.writeFile(path.join(output, 'template-default-contract.html'), contract);
  await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  const act = await preview(page, 'template-default-act-preview-390.png');
  await fs.writeFile(path.join(output, 'template-default-act.html'), act);
  await closeProject(page);
}

async function checkPlaceholderInsertion(page) {
  const insert = async (label, token, name) => {
    const input = shell(page).getByLabel(label, { exact: true });
    const before = await input.inputValue();
    const position = await input.evaluate(element => element.selectionStart);
    if (name === 'preamble') assert.doesNotMatch(before, /представительство_заказчика/, 'legacy representation token is removed from the preamble');
    // A user can open the picker immediately after expanding a section,
    // without touching its textarea or focusing a previous section.
    await button(page, 'Вставить поле').click();
    const unfocusedItem = button(page, 'Вставить {' + token + '}');
    assert.equal(await unfocusedItem.isDisabled(), false, `${name}: picker works before textarea focus`);
    await unfocusedItem.click();
    assert.equal(await input.inputValue(), before.slice(0, position) + '{' + token + '}' + before.slice(position), `${name}: picker targets its own newly expanded section`);
    await page.waitForFunction(({ label, position }) => {
      const element = document.querySelector('textarea[aria-label="' + label + '"]');
      return document.activeElement === element && element.selectionStart === position;
    }, { label, position: position + token.length + 2 });
    const prefix = 'До ', suffix = ' после.';
    await input.fill(prefix + suffix);
    assert.equal(await input.evaluate(element => element.selectionStart), prefix.length + suffix.length);
    for (let index = 0; index < suffix.length; index++) await input.press('ArrowLeft');
    assert.equal(await input.evaluate(element => element.selectionStart), prefix.length);
    await button(page, 'Вставить поле').click();
    const item = button(page, 'Вставить {' + token + '}');
    await item.waitFor();
    await page.screenshot({ path: path.join(output, `placeholders-${name}-sheet.png`) });
    assert.equal(await shell(page).getByRole('button', { name: 'Вставить {представительство_заказчика}', exact: true }).count(), 0);
    await item.click();
    assert.equal(await input.inputValue(), prefix + '{' + token + '}' + suffix, `${name}: insert at the existing cursor position`);
    await page.waitForFunction(({ label, position }) => {
      const element = document.querySelector('textarea[aria-label="' + label + '"]');
      return document.activeElement === element && element.selectionStart === position && element.selectionEnd === position;
    }, { label, position: prefix.length + token.length + 2 });
    await page.screenshot({ path: path.join(output, `placeholders-${name}-inserted.png`) });
  };
  await shell(page).locator('.cd-section-toggle').filter({ hasText: 'Вступление' }).click();
  await insert('Текст вступления', 'клиент', 'preamble');
  await shell(page).locator('.cd-section-toggle').filter({ hasText: 'Предмет договора' }).click();
  await insert('Текст раздела 1', 'адрес', 'contract-section');
  await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  await shell(page).locator('.cd-section-toggle').first().click();
  await insert('Текст раздела 1', 'клиент', 'act-section');
}

async function draftSaveAndExit(page) {
  let downloads = 0;
  const downloaded = () => downloads++;
  page.on('download', downloaded);
  await shell(page).getByLabel('Номер договора', { exact: true }).fill('');
  await shell(page).getByLabel('Дата договора', { exact: true }).fill('');
  await shell(page).getByLabel('Предоплата, ₽', { exact: true }).fill('1250,75');
  await shell(page).getByText('Реквизиты заказчика', { exact: true }).click();
  await shell(page).getByLabel('ИНН заказчика', { exact: true }).fill('1234567890');
  await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  await shell(page).getByLabel('Дата акта', { exact: true }).fill('');
  await shell(page).getByLabel('Выполненные работы', { exact: true }).fill('Незавершённый объём: гостиная');
  await button(page, 'Закрыть договор').click();
  await shell(page).getByRole('dialog', { name: 'Сохранить изменения?', exact: true }).getByRole('button', { name: 'Сохранить и выйти', exact: true }).click();
  await shell(page).waitFor({ state: 'detached' });
  const pending = await page.evaluate(() => structuredClone(window.__documentValue));
  assert.equal(pending.status, 'draft');
  assert.equal(pending.numberAllocated, false);
  assert.ok(!pending.html, 'saving an incomplete draft does not generate PDF HTML');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')).numSeq), 41);
  const source = structuredClone(fixture);
  source.total = 11000.75; source.area = 14;
  await openProject(page, { saved: pending, source });
  await assertNoOpenSave(page);
  assert.equal(await shell(page).getByLabel('Номер договора', { exact: true }).inputValue(), '', 'intentionally blank number stays blank');
  assert.equal(await shell(page).getByLabel('Дата договора', { exact: true }).inputValue(), '', 'intentionally blank date stays blank');
  assert.equal(await shell(page).getByLabel('Предоплата, ₽', { exact: true }).inputValue(), '1250,75');
  await shell(page).getByText('Реквизиты заказчика', { exact: true }).click();
  assert.equal(await shell(page).getByLabel('ИНН заказчика', { exact: true }).inputValue(), '1234567890');
  const html = await preview(page, 'draft-restored-preview-390.png');
  assert.match(html, /11(?:\s|&nbsp;|&#160;|\u00a0)000,75/, 'saved draft uses current calculator total');
  assert.match(html, /14 м²/);
  await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  assert.equal(await shell(page).getByLabel('Дата акта', { exact: true }).inputValue(), '');
  assert.equal(await shell(page).getByLabel('Выполненные работы', { exact: true }).inputValue(), 'Незавершённый объём: гостиная');
  assert.equal(downloads, 0, 'saving and reopening a draft never downloads a PDF');
  page.off('download', downloaded);
  await closeProject(page);
  await openProject(page, { saveError: 'Проверка ошибки сохранения' });
  await shell(page).getByLabel('Предоплата, ₽', { exact: true }).fill('10');
  await button(page, 'Закрыть договор').click();
  const sheet = shell(page).getByRole('dialog', { name: 'Сохранить изменения?', exact: true });
  await sheet.getByRole('button', { name: 'Сохранить и выйти', exact: true }).click();
  assert.equal(await sheet.getByRole('alert').textContent(), 'Проверка ошибки сохранения');
  assert.equal(await shell(page).getByLabel('Предоплата, ₽', { exact: true }).inputValue(), '10', 'failed save keeps edited fields');
  await sheet.getByRole('button', { name: 'Закрыть без сохранения', exact: true }).click();
  await shell(page).waitFor({ state: 'detached' });
  await openProject(page);
}

async function footerRegression(page, { checkAddresses = true } = {}) {
  await page.evaluate(() => {
    const app = window.__zamer;
    const original = app.state.projects.find(project => /Дзержинского/.test(project.name));
    if (!original) throw new Error('Bundled long-estimate fixture was not found');
    // Retain its identifier so the isolated demo's estEd quantity overrides
    // remain attached to the same project as its calculator total.
    const project = { ...structuredClone(original), name: 'Изолированный пример длинной сметы', client: 'Тестовый клиент', phone: '+7 999 000-00-00', address: 'Тестовый адрес', contract: null };
    window.__footerTotal = app.pSum(project);
    app.setState({ projects: [project], curId: project.id, screen: 'project', sheet: null }, () => app.openContract());
  });
  await shell(page).waitFor();
  await shell(page).getByLabel('Начало работ', { exact: true }).fill('2026-11-20');
  await shell(page).getByLabel('Окончание работ', { exact: true }).fill('2026-11-21');
  const html = await preview(page, 'long-estimate-footer-preview-390.png');
  const before = await page.evaluate(() => window.__lastDocumentPreview);
  assert.ok(before.length >= 3, 'long-estimate fixture contains contract, estimate and a separate custom appendix');
  if (process.env.CONTRACT_FOOTER_DIAGNOSTICS === '1') {
    const diagnostics = await page.evaluate(html => {
      const source = document.createElement('div');
      source.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;width:800px;background:#fff;z-index:-1;';
      source.innerHTML = html; document.body.appendChild(source);
      const root = source.firstElementChild;
      const origin = root.getBoundingClientRect();
      const describe = element => element ? { tag: element.tagName, class: element.className, top: element.getBoundingClientRect().top - origin.top, bottom: element.getBoundingClientRect().bottom - origin.top } : null;
      const article = source.querySelector('[data-document-kind="estimate"]');
      const footer = article.querySelector('.contract-doc-footer');
      const previous = footer.previousElementSibling;
      const last = [...previous.querySelectorAll('tr,.no-split,p')].at(-1) || previous;
      const table = article.querySelector('table');
      const data = {
        footer: describe(footer), previous: describe(previous), last: describe(last), closestNoSplit: describe(last.closest('.no-split')), article: describe(article), table: describe(table),
        tableContainingNoSplit: [...source.querySelectorAll('.no-split')].filter(element => element.contains(table)).map(describe),
        keepNext: [...source.querySelectorAll('[data-pdf-keep-with-next]')].map(element => ({ heading: describe(element), next: describe(element.nextElementSibling), nextContainsTable: !!element.nextElementSibling?.contains(table), firstRow: describe(element.nextElementSibling?.querySelector('tbody tr')) })),
      };
      source.remove(); return data;
    }, html);
    await fs.writeFile(path.join(output, 'footer-diagnostics.json'), JSON.stringify(diagnostics, null, 2));
    console.log(JSON.stringify(diagnostics));
    return;
  }
  const estimateFirstPage = before.find(page => page.starts.some(start => start.kind === 'estimate'));
  assert.ok(estimateFirstPage.rows.length > 1, 'estimate title and first rows stay together instead of leaving a header-only page');
  const rowCount = before.flatMap(page => page.rows).length;
  const footerPage = before.find(page => page.footers.some(footer => footer.kind === 'estimate'));
  assert.ok(footerPage.rows.includes(rowCount - 2) && footerPage.rows.includes(rowCount - 1), 'last real estimate row, summary and footer stay together');
  const pdf = await downloadPdf(page, 'long-estimate-footer.pdf');
  await page.waitForFunction(() => !!window.__zamer.cur()?.contract?.html);
  const snapshot = await page.evaluate(() => structuredClone(window.__zamer.cur().contract));
  assert.equal(snapshot.total, await page.evaluate(() => window.__footerTotal));
  const totalLayout = await page.evaluate(html => {
    const container = document.createElement('div'); container.style.cssText = 'position:fixed;opacity:0;width:800px;pointer-events:none'; container.innerHTML = html; document.body.appendChild(container);
    const totalCell = [...container.querySelectorAll('[data-document-kind="estimate"] table tr')].at(-1).querySelector('td:last-child');
    const range = document.createRange(); range.selectNodeContents(totalCell);
    const lines = [...new Set([...range.getClientRects()].filter(rectangle => rectangle.width > 0 && rectangle.height > 0).map(rectangle => Math.round(rectangle.top)))];
    const result = { amount: Number(totalCell.textContent.replace(/[\s₽]/g, '').replace(',', '.')), lines: lines.length };
    container.remove(); return result;
  }, snapshot.html);
  assert.equal(totalLayout.amount, snapshot.total, 'estimate total matches the source calculator with preserved quantity overrides');
  assert.equal(totalLayout.lines, 1, 'large total and ₽ stay on the same line');
  await assertNoSignature(snapshot.html);
  assert.ok(snapshot.html.includes('Итого'), 'estimate total is retained');
  const addresses = await page.evaluate(html => {
    const container = document.createElement('div'); container.innerHTML = html;
    const article = container.querySelector('[data-document-kind="contract"]');
    return { header: article.querySelector('header').textContent, requisites: article.querySelector('.contract-requisites').textContent };
  }, snapshot.html);
  if (checkAddresses) {
    assert.ok(addresses.header.includes('ОФИС QA: ул. Производственная, 10'));
    assert.ok(!addresses.header.includes('ЮРИДИЧЕСКИЙ QA'));
    assert.ok(addresses.requisites.includes('ЮРИДИЧЕСКИЙ QA: ул. Регистрационная, 22'));
  }
  await fs.writeFile(path.join(output, 'long-estimate-footer.html'), html);
  await fs.writeFile(path.join(output, 'results-footer.json'), JSON.stringify({ total: snapshot.total, totalLayout, estimateRows: before.flatMap(page => page.rows).length, pages: before, pdf }, null, 2));
}

async function finalTemplateDelta(page) {
  await page.evaluate(() => window.__zamer.go('account'));
  await page.locator('[data-zamer-screen="account"]').waitFor();
  assert.equal(await page.getByText('Дизайнеры', { exact: true }).count(), 0, 'account menu has no designer entry');
  await page.evaluate(() => window.__zamer.go('dash'));
  await openTemplate(page, true);
  await button(page, 'Изменить').click();
  const settings = page.locator('.z-account-settings');
  await settings.waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Компания в документах', exact: true }).count(), 0, 'company Edit opens the shared account settings form');
  if (!await settings.getByRole('button', { name: 'Изменить ФИО', exact: true }).count()) {
    await settings.getByRole('button', { name: 'Изменить Форма', exact: true }).click();
    await settings.getByRole('dialog', { name: 'Форма', exact: true }).getByRole('radio', { name: 'ИП', exact: true }).click();
  }
  const edit = async (label, value) => {
    await settings.getByRole('button', { name: 'Изменить ' + label, exact: true }).click();
    const dialog = settings.getByRole('dialog', { name: label, exact: true });
    await dialog.getByLabel(label, { exact: true }).fill(value);
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  };
  const fullName = 'Иванов Александр Константинович Тестовый Исполнитель';
  await edit('Компания', 'Студия QA двух адресов');
  await edit('ФИО', fullName);
  await edit('Адрес компании', 'ОФИС QA: ул. Производственная, 10');
  await edit('Адрес регистрации', 'ЮРИДИЧЕСКИЙ QA: ул. Регистрационная, 22');
  const fio = settings.getByRole('button', { name: 'Изменить ФИО', exact: true }).locator('.z-as-value');
  assert.equal(await fio.textContent(), fullName);
  const fioSize = await fio.evaluate(element => ({ scroll: element.scrollHeight, client: element.clientHeight, width: element.scrollWidth, clientWidth: element.clientWidth }));
  assert.ok(fioSize.scroll <= fioSize.client + 1 && fioSize.width <= fioSize.clientWidth + 1, 'long full name wraps without clipping');
  await fio.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'company-shared-form-full-fio-two-addresses-390.png') });
  await settings.getByRole('button', { name: 'Готово', exact: true }).click();
  await shell(page).waitFor();
  assert.match(await shell(page).innerText(), /Студия QA двух адресов/, 'closing company settings returns to the updated template');
  for (const label of ['Гарантия на монтаж, мес.', 'Гарантия на материалы']) assert.equal(await shell(page).getByLabel(label, { exact: true }).count(), 0, 'guarantee settings are removed from controls');
  await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  assert.equal(await shell(page).locator('.cd-section-toggle').count(), 4, 'all four act body blocks are available for editing');
  for (let index = 0; index < 4; index++) {
    await shell(page).locator('.cd-section-toggle').nth(index).click();
    const text = shell(page).getByLabel('Текст раздела ' + (index + 1), { exact: true });
    await text.fill(`РЕДАКТИРУЕМЫЙ БЛОК ${index + 1}. ` + await text.inputValue());
  }
  const html = await preview(page, 'act-full-body-edited-preview-390.png');
  for (let index = 0; index < 4; index++) assert.ok(html.includes(`РЕДАКТИРУЕМЫЙ БЛОК ${index + 1}.`));
  await button(page, 'Сохранить настройки').click();
  await shell(page).waitFor({ state: 'detached' });
  await ready(page);
  assert.equal(await page.evaluate(() => window.__zamer.state.profile.companyAddress), 'ОФИС QA: ул. Производственная, 10');
  assert.equal(await page.evaluate(() => window.__zamer.state.profile.address), 'ЮРИДИЧЕСКИЙ QA: ул. Регистрационная, 22');
  await openTemplate(page);
  await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  for (let index = 0; index < 4; index++) {
    await shell(page).locator('.cd-section-toggle').nth(index).click();
    assert.ok((await shell(page).getByLabel('Текст раздела ' + (index + 1), { exact: true }).inputValue()).startsWith(`РЕДАКТИРУЕМЫЙ БЛОК ${index + 1}.`));
  }
  await closeProject(page);
  await fs.writeFile(path.join(output, 'results-template-delta.json'), JSON.stringify({ fourActBlocksEditable: true, savedEditsRestore: true, guaranteeControlsAbsent: true, designerMenusAbsent: true, sharedCompanyForm: true, longFioWraps: true, twoAddressesPersist: true }, null, 2));
}

async function separateActDelta(page) {
  const snapshot = await page.evaluate(() => structuredClone(window.__zamer.cur().contract));
  assert.doesNotMatch(snapshot.html, /data-contract-appendix="act"|data-document-kind="acceptance/);
  await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  await shell(page).getByLabel('Дата акта', { exact: true }).fill('2026-11-22');
  await shell(page).getByLabel('Работы завершены', { exact: true }).fill('2026-11-21');
  await shell(page).getByLabel('Выполненные работы', { exact: true }).fill('Монтаж потолков по тестовому проекту');
  await button(page, 'Без замечаний').click();
  const html = await preview(page, 'separate-act-four-blocks-preview-390.png');
  for (let index = 0; index < 4; index++) assert.ok(html.includes(`РЕДАКТИРУЕМЫЙ БЛОК ${index + 1}.`), 'separate act uses each edited body section');
  const pdf = await downloadPdf(page, 'separate-act-four-editable-blocks.pdf');
  const saved = await page.evaluate(() => structuredClone(window.__zamer.cur().contract));
  for (let index = 0; index < 4; index++) assert.ok(saved.act.html.includes(`РЕДАКТИРУЕМЫЙ БЛОК ${index + 1}.`));
  assert.doesNotMatch(saved.html, /data-contract-appendix="act"|data-document-kind="acceptance/);
  await closeProject(page);
  await fs.writeFile(path.join(output, 'results-separate-act.json'), JSON.stringify({ noActInContract: true, fourEditableBlocksInSeparatePdf: true, pdf }, null, 2));
}

async function standaloneEstimateDelta(page, { checkAddresses = true, expectLogo = false, expectedStyle = 'brand' } = {}) {
  await page.evaluate(() => window.__zamer.openEstimateEditor());
  const editor = page.locator('.z-mobile-estimate');
  await editor.waitFor();
  await editor.getByRole('radio', { name: 'Общая смета Материалы, работы и оборудование', exact: true }).click();
  const photo = editor.getByRole('group', { name: 'Столбцы сметы' }).getByRole('button', { name: 'Фото', exact: true });
  if (await photo.getAttribute('aria-pressed') === 'true') await photo.click();
  await editor.getByRole('button', { name: 'Предпросмотр', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Предпросмотр сметы', exact: true });
  await preview.waitFor();
  const estimateArticle = preview.locator('.estimate-document').first();
  await preview.locator('.z-estimate-pdf-page[data-pdf-page]').first().waitFor();
  await settleDocumentFonts(page);
  const style = await estimateArticle.evaluate(element => ({ font: getComputedStyle(element).fontFamily, background: getComputedStyle(element.querySelector('.estimate-company-card')).backgroundColor, layout: element.dataset.estimateLayout, text: element.textContent }));
  assert.match(style.font, expectedStyle === 'brand' ? /Serif|Times|Georgia/ : /Manrope/i);
  assert.equal(style.background, expectedStyle === 'brand' ? 'rgb(26, 58, 92)' : 'rgb(239, 245, 255)');
  assert.equal(style.layout, 'stacked');
  if (checkAddresses) { assert.match(style.text, /ОФИС QA/); assert.match(style.text, /ЮРИДИЧЕСКИЙ QA/); }
  await assertNoSignature(await estimateArticle.innerHTML());
  assert.equal(await preview.locator('.estimate-signature').count(), 0, 'legacy signatures are not printed');
  if (expectLogo) assert.equal(await estimateArticle.locator('.estimate-company-logo').count(), 1, 'uploaded logo is used in the actual estimate');
  const plan = await estimateArticle.evaluate(async element => {
    const { paginatePdf, collectPdfAvoidRanges, pdfContentEnd } = await import('/src/utils/pdf-pagination.js');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;opacity:0;width:800px;pointer-events:none';
    const article = element.cloneNode(true); article.style.removeProperty('transform'); article.style.removeProperty('transform-origin'); host.appendChild(article); document.body.appendChild(host);
    const rect = article.getBoundingClientRect(), width = Math.ceil(rect.width) * 2, height = Math.ceil(rect.height) * 2, scaleY = height / article.scrollHeight;
    const range = node => { const box = node.getBoundingClientRect(); return { top: Math.max(0, Math.floor((box.top - rect.top) * scaleY)), bottom: Math.min(height, Math.ceil((box.bottom - rect.top) * scaleY)) }; };
    const avoid = collectPdfAvoidRanges(article, range);
    const slices = paginatePdf({ height, pageHeight: Math.floor(277 * width / 190), avoidRanges: avoid, breakBefore: [...article.querySelectorAll('[data-pdf-break-before]')].map(node => range(node).top), contentEnd: pdfContentEnd(article, range), edgeTolerance: 1 });
    const rows = [...article.querySelectorAll('table tr')].map(range);
    const coverage = slices.map(slice => rows.flatMap((row, index) => row.top >= slice.top - 1 && row.bottom <= slice.bottom + 1 ? [index] : []));
    const result = { pages: slices.length, rows: rows.length, coverage, total: article.querySelector('[data-estimate-grand-total]').textContent, html: article.outerHTML };
    host.remove(); return result;
  });
  assert.ok(plan.coverage[0].length > 1, 'standalone estimate starts rows under its header');
  assert.deepEqual(plan.coverage.flat().sort((a, b) => a - b), Array.from({ length: plan.rows }, (_, index) => index), 'standalone estimate retains every whole row');
  const renderedPages = preview.locator('.z-estimate-pdf-page[data-pdf-page]');
  assert.equal(await renderedPages.count(), plan.pages, 'standalone preview uses the same physical A4 pages as PDF');
  const renderedCoverage = await renderedPages.evaluateAll(pages => pages.map(page => {
    const article = page.querySelector('.estimate-document'), clip = article.parentElement.parentElement.getBoundingClientRect();
    const rows = [...article.querySelectorAll('table tr')].flatMap((row, index) => { const box = row.getBoundingClientRect(); return box.top >= clip.top - 1 && box.bottom <= clip.bottom + 1 ? [index] : []; });
    const footer = article.querySelector('.estimate-summary').getBoundingClientRect();
    return { number: Number(page.dataset.pdfPage), rows, hasFooter: footer.bottom > clip.top + 1 && footer.top < clip.bottom - 1 };
  }));
  assert.deepEqual(renderedCoverage.flatMap(page => page.rows).sort((a, b) => a - b), Array.from({ length: plan.rows }, (_, index) => index));
  for (const page of renderedCoverage) assert.ok(page.rows.length, 'standalone A4 page contains estimate rows, rather than only header/footer');
  for (let index = 0; index < plan.pages; index++) await renderedPages.nth(index).screenshot({ path: path.join(output, `standalone-estimate-${expectedStyle}-preview-390-page-${index + 1}.png`) });
  await page.screenshot({ path: path.join(output, `standalone-estimate-${expectedStyle}-preview-390.png`) });
  await preview.getByRole('button', { name: 'Закрыть предпросмотр сметы', exact: true }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
  await editor.getByRole('button', { name: 'Скачать PDF', exact: true }).click();
  const download = await downloadPromise;
  const file = path.join(output, `standalone-estimate-${expectedStyle}-print.pdf`);
  await download.saveAs(file);
  const bytes = await fs.readFile(file);
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.equal([...bytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length, plan.pages, 'standalone PDF matches the preview print layout');
  const custom = await page.evaluate(() => {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;opacity:0;width:800px;pointer-events:none';
    host.innerHTML = window.MagicEstimate.estimateHtml({ template: { formatVersion: 2, background: '#0a5b42', font: 'verdana' } }); document.body.appendChild(host);
    const result = { background: getComputedStyle(host.querySelector('.estimate-company-card')).backgroundColor, font: getComputedStyle(host.querySelector('.estimate-document')).fontFamily }; host.remove(); return result;
  });
  assert.equal(custom.background, 'rgb(10, 91, 66)'); assert.match(custom.font, /Verdana/i);
  await fs.writeFile(path.join(output, `standalone-estimate-${expectedStyle}-print.html`), plan.html);
  await fs.writeFile(path.join(output, `results-standalone-estimate-${expectedStyle}.json`), JSON.stringify({ expectedStyle, customAppearancePreserved: true, pages: plan.pages, rows: plan.rows, renderedCoverage, total: plan.total, pdf: file }, null, 2));
}

async function contractStylesDelta(page) {
  await openTemplate(page, true);
  const styles = [['magic', 'Фирменный', 'brandbar'], ['accent', 'Современный', 'split']];
  assert.equal(await shell(page).locator('.cd-style-option').count(), 2);
  await shell(page).locator('.cd-style-options').locator('..').screenshot({ path: path.join(output, 'contract-two-style-picker-390.png') });
  const examples = [];
  for (const [id, label, layout] of styles) {
    await button(page, 'Оформление: ' + label).click();
    await preview(page, `contract-appearance-${id}-390.png`);
    const appearance = await page.evaluate(() => window.__lastDocumentAppearance);
    assert.equal(appearance.style, id); assert.equal(appearance.layout, layout);
    examples.push(appearance);
  }
  assert.equal(new Set(examples.map(example => [example.font, example.padding, example.headerBackground].join('|'))).size, 2, 'both styles visibly differ in the actual preview');
  await button(page, 'Сохранить настройки').click();
  await shell(page).waitFor({ state: 'detached' });
  await ready(page);
  await openTemplate(page, true);
  assert.equal(await button(page, 'Оформление: Современный').getAttribute('aria-pressed'), 'true', 'chosen contract style persists after reload');
  await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
  await preview(page, 'act-appearance-modern-390.png');
  assert.equal(await page.evaluate(() => window.__lastDocumentAppearance.style), 'accent', 'act uses the same saved style');
  await shell(page).getByRole('tab', { name: 'Договор', exact: true }).click();
  await button(page, 'Оформление: Фирменный').click();
  await button(page, 'Сохранить настройки').click();
  await shell(page).waitFor({ state: 'detached' });
  await fs.writeFile(path.join(output, 'results-contract-appearance.json'), JSON.stringify({ examples, persisted: true, sharedWithAct: true }, null, 2));
}

async function baseContractPaginationDelta(page) {
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')));
  const logo = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
    const context = canvas.getContext('2d'); context.fillStyle = '#1A3A5C'; context.fillRect(0, 0, 48, 48);
    return canvas.toDataURL('image/png');
  });
  const source = structuredClone(fixture);
  source.total = 85000; source.area = 42.6;
  source.est = { mats: [{ n: 'Полотно и профиль', q: 42.6, p: 1500, u: 'м²' }], works: [{ n: 'Монтаж потолка', q: 1, p: 21100, u: 'усл' }] };
  Object.assign(source.project, { client: 'Петров Алексей Константинович', inn: '123456789012', legalAddress: 'г. Хабаровск, ул. Длинная Тестовая, дом 15, квартира 101' });
  const saved = { status: 'draft', number: 'QA-BASE', numberAuto: false, numberAllocated: false, date: '2026-11-13', startDate: '2026-11-20', endDate: '2026-11-21', prepay: 42500 };
  const examples = [];
  for (const style of ['magic', 'accent']) {
    const template = { ...original, style, head: { ...original.head, logo, legal: 'ИП Иванов Александр Константинович', ogrn: '123456789012345', companyAddress: 'г. Хабаровск, ул. Производственная, дом 10, офис 25', address: 'г. Хабаровск, ул. Регистрационная, дом 22, квартира 105', bank: '' }, appendices: original.appendices.filter(appendix => appendix.kind === 'estimate') };
    source.company = structuredClone(template.head);
    delete template.sections; delete template.preamble;
    await page.evaluate(template => localStorage.setItem('zamer.contractTpl', JSON.stringify(template)), template);
    await openProject(page, { saved, source });
    await preview(page, `base-contract-${style}-390.png`);
    const pages = await page.evaluate(() => window.__lastDocumentPreview);
    const appearance = await page.evaluate(() => window.__lastDocumentAppearance);
    const fonts = await page.evaluate(() => ({ normalManropeCyrillic: document.fonts.check('400 12px Manrope', 'Проверка текста'), boldManropeCyrillic: document.fonts.check('700 12px Manrope', 'Проверка текста') }));
    examples.push({ style, appearance, fonts, pages });
    await fs.writeFile(path.join(output, 'base-contract-diagnostics.json'), JSON.stringify(examples, null, 2));
    assert.equal(pages.length, 2, `${style}: full seven-section base contract with long requisites fits one A4 plus one estimate page`);
    assert.equal(pages.find(page => page.starts.some(start => start.kind === 'estimate')).number, 2);
    assert.ok(appearance.naturalHeight <= Math.ceil(277 * appearance.naturalWidth / 190), `${style}: natural contract height stays within printable A4`);
    assert.equal(appearance.phoneWhiteSpace, 'nowrap', 'company phone stays unbroken');
    await downloadPdf(page, `base-contract-${style}-two-pages.pdf`);
    const normalized = await page.evaluate(() => structuredClone(window.__documentValue.template));
    await closeProject(page);
    normalized.sections.at(-1).text += '\n' + 'Дополнительные согласованные условия выполнения работ и доступа к объекту сохраняют права сторон. '.repeat(45);
    normalized.head.bank = 'Р/с 40802810000000000001\nБИК 040000001\nТестовый Банк\nК/с 30101810000000000001';
    source.company = structuredClone(normalized.head);
    await page.evaluate(template => localStorage.setItem('zamer.contractTpl', JSON.stringify(template)), normalized);
    await openProject(page, { saved, source });
    await preview(page, `long-paragraph-${style}-390.png`);
    const longPages = await page.evaluate(() => window.__lastDocumentPreview);
    assert.ok(longPages.length >= 3, 'long body text uses continuation pages');
    assert.ok(longPages.filter(page => page.hasRequisites).every(page => page.bodyCharacters > 0), 'requisites remain with body text in both styles');
    examples.at(-1).longParagraphPages = longPages;
    await closeProject(page);
  }
  await page.evaluate(template => localStorage.setItem('zamer.contractTpl', JSON.stringify(template)), original);
  await fs.writeFile(path.join(output, 'results-base-contract-pagination.json'), JSON.stringify(examples, null, 2));
}

async function estimateHeaderAppearanceDelta(page) {
  await page.evaluate(() => window.__zamer.openEstimateHeader());
  const header = page.getByRole('dialog', { name: 'Шапка сметы', exact: true });
  await header.waitFor();
  assert.equal(await header.getByRole('button', { name: /подпис/i }).count(), 0);
  assert.equal(await header.locator('[data-estimate-preset]').count(), 2);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 48;
    const context = canvas.getContext('2d'); context.fillStyle = '#1A3A5C'; context.fillRect(0, 0, 96, 48);
    context.fillStyle = 'white'; context.font = 'bold 28px Arial'; context.fillText('QA', 10, 34);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const upload = async (buffer, name) => {
    const chooser = page.waitForEvent('filechooser');
    await header.getByRole('button', { name: /^(Загрузить|Заменить) логотип$/ }).click();
    await (await chooser).setFiles({ name, mimeType: 'image/png', buffer });
  };
  await upload(Buffer.from(png, 'base64'), 'qa-logo.png');
  await page.waitForFunction(() => window.__zamer.state.profile.logo?.startsWith('data:image/'));
  const firstLogo = await page.evaluate(() => window.__zamer.state.profile.logo);
  await upload(Buffer.from('invalid image'), 'invalid.png');
  await header.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => window.__zamer.state.profile.logo), firstLogo, 'failed logo replacement preserves the saved image');
  await header.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.waitForFunction(() => window.__zamer.state.profile.logo === '');
  await header.getByRole('button', { name: 'Загрузить логотип', exact: true }).waitFor();
  await upload(Buffer.from(png, 'base64'), 'qa-logo.png');
  await page.waitForFunction(() => window.__zamer.state.profile.logo?.startsWith('data:image/'));
  const logo = await page.evaluate(() => window.__zamer.state.profile.logo);
  await page.screenshot({ path: path.join(output, 'estimate-two-preset-picker-logo-390.png') });
  const presets = [['brand', '#1a3a5c', 'rgb(26, 58, 92)'], ['modern', '#eff5ff', 'rgb(239, 245, 255)']];
  for (const [id, color, background] of presets) {
    await header.locator(`[data-estimate-preset="${id}"]`).click();
    await page.waitForFunction(color => window.__zamer.state.profile.estimateTemplate?.background.toLowerCase() === color, color);
    await header.getByRole('button', { name: 'Вид', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Предпросмотр сметы', exact: true });
    await preview.waitFor();
    await preview.locator('.z-estimate-pdf-page[data-pdf-page]').first().waitFor();
    await settleDocumentFonts(page);
    const article = preview.locator('.estimate-document').first();
    assert.equal(await article.getAttribute('data-estimate-preset'), id);
    assert.equal(await article.locator('.estimate-company-card').evaluate(element => getComputedStyle(element).backgroundColor), background);
    if (id === 'modern') {
      assert.match(await article.evaluate(element => getComputedStyle(element).fontFamily), /Manrope/i);
      assert.equal(await article.locator('th').first().evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(231, 239, 253)');
      assert.equal(await article.locator('th').first().evaluate(element => getComputedStyle(element).color), 'rgb(22, 75, 157)');
      assert.equal(await article.locator('.estimate-company-card').evaluate(element => getComputedStyle(element).borderLeftWidth), '4px');
    }
    assert.equal(await article.locator('.estimate-company-logo').count(), 1);
    await assertNoSignature(await article.innerHTML());
    await page.screenshot({ path: path.join(output, `estimate-appearance-${id}-390.png`) });
    await preview.getByRole('button', { name: 'Закрыть предпросмотр сметы', exact: true }).click();
  }
  await header.getByRole('button', { name: 'Закрыть шапку сметы', exact: true }).click();
  await ready(page);
  assert.equal(await page.evaluate(() => window.__zamer.state.profile.logo), logo);
  assert.equal(await page.evaluate(() => window.__zamer.state.profile.estimateTemplate.background.toLowerCase()), '#eff5ff');
  await page.evaluate(() => window.__zamer.openEstimateHeader());
  await header.waitFor();
  assert.equal(await header.locator('[data-estimate-preset="modern"]').getAttribute('aria-pressed'), 'true');
  await header.getByRole('button', { name: /^Данные компании/ }).click();
  const settings = page.locator('.z-account-settings'); await settings.waitFor();
  await settings.getByRole('button', { name: 'Готово', exact: true }).click();
  await header.waitFor();
  await header.locator('[data-estimate-preset="brand"]').click();
  await header.getByRole('button', { name: 'Закрыть шапку сметы', exact: true }).click();
  const legacy = await page.evaluate(({ company, fixture }) => ['total', 'compact', 'rooms', 'draw'].map(type => window.MagicEstimate.estimateHtml({ company, est: fixture.est, rooms: fixture.rooms, type })), { company, fixture });
  for (const html of legacy) await assertNoSignature(html);
  await page.evaluate(() => { const template = JSON.parse(localStorage.getItem('zamer.contractTpl')); template.style = 'magic'; localStorage.setItem('zamer.contractTpl', JSON.stringify(template)); });
  await footerRegression(page, { checkAddresses: false });
  await closeProject(page);
  await standaloneEstimateDelta(page, { checkAddresses: false, expectLogo: true });
  await page.locator('.z-mobile-estimate').getByRole('button', { name: 'Закрыть редактор сметы', exact: true }).click();
  await page.evaluate(() => window.__zamer.openEstimateHeader());
  await header.waitFor();
  await header.locator('[data-estimate-preset="modern"]').click();
  await header.getByRole('button', { name: 'Закрыть шапку сметы', exact: true }).click();
  await standaloneEstimateDelta(page, { checkAddresses: false, expectLogo: true, expectedStyle: 'modern' });
  await fs.writeFile(path.join(output, 'results-estimate-appearance.json'), JSON.stringify({ presets: ['brand', 'modern'], logoUploadRemovalFailure: true, logoAndPresetPersist: true, sharedCompanySettings: true, legacySignaturesAbsentInAllModes: true }, null, 2));
}

try {
  const placeholdersOnly = process.env.CONTRACT_CHECK === 'placeholders';
  const footerOnly = process.env.CONTRACT_CHECK === 'footer';
  const appearanceOnly = process.env.CONTRACT_CHECK === 'appearance';
  const baseOnly = process.env.CONTRACT_CHECK === 'base';
  const viewports = [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }].filter(viewport => placeholdersOnly || footerOnly || appearanceOnly || baseOnly ? viewport.width === 390 : !process.env.CONTRACT_WIDTH || viewport.width === Number(process.env.CONTRACT_WIDTH));
  assert.ok(viewports.length, 'CONTRACT_WIDTH must be 375, 390, or 768');
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, acceptDownloads: true, isMobile: viewport.width < 700, hasTouch: true });
    await context.tracing.start({ screenshots: true, snapshots: true });
    await context.addInitScript(template => {
      if (!localStorage.getItem('zamer.contractTpl')) localStorage.setItem('zamer.contractTpl', JSON.stringify(template));
    }, initialTemplate);
    const page = await context.newPage(); currentPage = page;
    page.setDefaultTimeout(10000);
    await page.clock.install({ time: new Date('2026-11-13T02:00:00Z') });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { console.error(`Browser dialog: ${dialog.message()}`); await dialog.dismiss(); });
    await ready(page);
    if (baseOnly) {
      await baseContractPaginationDelta(page);
      assert.deepEqual(errors, [], 'no browser exceptions in full base contracts');
      await context.tracing.stop({ path: path.join(output, 'trace-base-contracts.zip') });
      await context.close(); currentPage = null;
      console.log('Both full base contract PDFs fit two pages; long requisites and long paragraphs keep body together.');
      continue;
    }
    if (appearanceOnly) {
      if (process.env.CONTRACT_SKIP_BASE !== '1') {
        await contractStylesDelta(page);
        await baseContractPaginationDelta(page);
      }
      await estimateHeaderAppearanceDelta(page);
      assert.deepEqual(errors, [], 'no browser exceptions in appearance checks');
      await context.tracing.stop({ path: path.join(output, 'trace-appearance.zip') });
      await context.close(); currentPage = null;
      console.log('Two contract styles, two estimate presets, logo lifecycle, persistence, no signatures, footer rows and actual PDFs passed.');
      continue;
    }
    if (footerOnly) {
      if (process.env.CONTRACT_FOOTER_DIAGNOSTICS !== '1') await finalTemplateDelta(page);
      await footerRegression(page);
      if (process.env.CONTRACT_FOOTER_DIAGNOSTICS !== '1') await separateActDelta(page);
      if (process.env.CONTRACT_FOOTER_DIAGNOSTICS !== '1') await standaloneEstimateDelta(page);
      assert.deepEqual(errors, [], 'no browser exceptions in long estimate');
      await context.tracing.stop({ path: path.join(output, 'trace-footer.zip') });
      await context.close(); currentPage = null;
      console.log(process.env.CONTRACT_FOOTER_DIAGNOSTICS === '1' ? 'Footer DOM diagnostics recorded.' : 'Long estimate rows, total, footer grouping and real PDF/preview page counts passed.');
      continue;
    }
    if (placeholdersOnly) await page.evaluate(() => {
      const template = JSON.parse(localStorage.getItem('zamer.contractTpl'));
      template.preamble = 'Исполнитель и {клиент}{представительство_заказчика} согласовали работы.';
      localStorage.setItem('zamer.contractTpl', JSON.stringify(template));
    });
    await openTemplate(page, viewport.width === 390);
    const templateLayout = await assertLayout(page, 'template', `template-${viewport.width}.png`);
    if (placeholdersOnly) {
      assert.equal(await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).count(), 1);
      assert.equal(await button(page, 'Акт выполненных работ').count(), 0, 'appendices have no duplicate act shortcut');
      await checkPlaceholderInsertion(page);
      assert.deepEqual(errors, [], 'no browser exceptions while inserting placeholders');
      await fs.writeFile(path.join(output, 'results-placeholders.json'), JSON.stringify({ preamble: true, section: true, act: true, cursorRestored: true, errors }, null, 2));
      await context.tracing.stop({ path: path.join(output, 'trace-placeholders.zip') });
      await context.close(); currentPage = null;
      console.log('Placeholder sheets and middle-of-text insertion passed for preamble, contract section and act section.');
      continue;
    }

    await preview(page, `preview-${viewport.width}.png`);
    await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
    await preview(page, `template-act-preview-${viewport.width}.png`);
    if (viewport.width === 390) {
      await shell(page).getByRole('tab', { name: 'Договор', exact: true }).click();
      await templatePersistence(page);
    } else await closeProject(page);

    await openProject(page);
    const projectLayout = await assertLayout(page, 'project', `project-${viewport.width}.png`);
    await assertNoOpenSave(page);
    await preview(page);
    await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
    await assertLayout(page, 'act', `act-${viewport.width}.png`);
    assert.equal(await button(page, 'Без замечаний').getAttribute('aria-pressed'), 'false');
    assert.equal(await button(page, 'Есть замечания').getAttribute('aria-pressed'), 'false');
    await assertNoOpenSave(page);
    await shell(page).getByRole('tab', { name: 'Договор', exact: true }).click();
    const pdfs = [];
    if (viewport.width === 390) {
      await draftSaveAndExit(page);
      await shell(page).getByLabel('Начало работ', { exact: true }).fill('2026-11-20');
      await shell(page).getByLabel('Окончание работ', { exact: true }).fill('2026-11-21');
      await shell(page).getByLabel('Предоплата, ₽', { exact: true }).fill('99999');
      await button(page, 'Скачать PDF').click();
      await shell(page).getByRole('alert').waitFor();
      assert.match(await shell(page).innerText(), /Предоплата не может превышать сумму договора/);
      assert.equal(await page.evaluate(() => window.__documentSaves.length), 0);
      await shell(page).getByLabel('Предоплата, ₽', { exact: true }).fill('1250,75');
      await shell(page).getByLabel('Заказчик', { exact: true }).fill('');
      await button(page, 'Отправить').click();
      assert.equal(await shell(page).getByLabel('Заказчик', { exact: true }).getAttribute('aria-invalid'), 'true');
      assert.equal(await page.evaluate(() => window.__documentSaves.length), 0, 'share validates the same draft before saving');
      await shell(page).getByLabel('Заказчик', { exact: true }).fill(fixture.project.client);
      pdfs.push(await downloadPdf(page, 'contract-first.pdf'));
      const saved = await page.evaluate(() => structuredClone(window.__documentValue));
      assert.equal(saved.prepay, 1250.75);
      assert.equal(saved.total, fixture.total);
      assert.deepEqual(saved.est, fixture.est);
      await assertNoSignature(saved.html);
      await closeProject(page);
      await page.evaluate(() => {
        const template = JSON.parse(localStorage.getItem('zamer.contractTpl'));
        template.sections[0].text = 'ОБНОВЛЁННЫЙ ШАБЛОН. {клиент}; площадь {площадь} м².';
        localStorage.setItem('zamer.contractTpl', JSON.stringify(template));
      });
      const source = structuredClone(fixture);
      source.total = 20000.99; source.area = 24;
      source.project.client = 'ООО Новый заказчик'; source.project.paid = 4200;
      source.est = { mats: [{ n: 'Новое полотно', q: 4, p: 2500.25, u: 'м²' }], works: [{ n: 'Новый монтаж', q: 1, p: 9999.99, u: 'усл' }] };
      source.rooms = [{ ...fixture.rooms[0], name: 'Новая гостиная', area: 24, v: [[0, 0], [6, 0], [6, 4], [0, 4]] }];
      await openProject(page, { saved, source });
      await assertNoOpenSave(page, 42);
      assert.equal(await shell(page).getByLabel('Заказчик', { exact: true }).inputValue(), source.project.client, 'current project party wins over saved PDF');
      const currentPreview = await preview(page, 'project-current-preview-390.png');
      assert.match(currentPreview, /ОБНОВЛЁННЫЙ ШАБЛОН/);
      assert.match(currentPreview, /Новое полотно/);
      assert.match(currentPreview, /24/);
      assert.equal(await page.evaluate(() => window.__documentValue.html), saved.html, 'opening current preview does not overwrite the stored snapshot');
      pdfs.push(await downloadPdf(page, 'contract-current.pdf'));
      const refreshed = await page.evaluate(() => structuredClone(window.__documentValue));
      assert.equal(refreshed.total, source.total);
      assert.equal(refreshed.area, source.area);
      assert.equal(refreshed.client, source.project.client);
      assert.deepEqual(refreshed.est, source.est);
      assert.deepEqual(refreshed.documentContext.rooms, source.rooms);
      assert.match(refreshed.html, /ОБНОВЛЁННЫЙ ШАБЛОН/);
      await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
      await button(page, 'Скачать PDF').click();
      await shell(page).getByRole('alert').waitFor();
      assert.equal(await page.evaluate(() => window.__documentSaves.length), 1, 'incomplete act does not save');
      await shell(page).getByLabel('Дата акта', { exact: true }).fill('2026-11-22');
      await shell(page).getByLabel('Работы завершены', { exact: true }).fill('2026-11-21');
      await button(page, 'Есть замечания').click();
      await shell(page).getByLabel('Выполненные работы', { exact: true }).fill('Монтаж потолков в гостиной и прихожей');
      await shell(page).getByLabel('Замечания и недостатки', { exact: true }).fill('Отрегулировать примыкание у окна');
      await shell(page).getByLabel('Устранить до', { exact: true }).fill('2026-11-25');
      await shell(page).getByLabel('Стоимость по акту, ₽', { exact: true }).fill('17500,50');
      await preview(page, 'act-current-preview-390.png');
      pdfs.push(await downloadPdf(page, 'act-current.pdf'));
      await assertLayout(page, 'completed act', 'act-filled-390.png');
      const pack = await page.evaluate(() => structuredClone(window.__documentValue));
      assert.equal(pack.act.total, 17500.5);
      assert.equal(pack.act.contractTotal, source.total);
      assert.equal(pack.act.paid, 4200, 'act uses actual payments, independently of 1250.75 contractual prepay');
      assert.equal(pack.act.contractNumber, pack.number);
      assert.match(pack.act.html, /Отрегулировать примыкание у окна/);
      assert.match(pack.act.html, /Монтаж потолков в гостиной и прихожей/);
      await assertNoSignature(pack.act.html);
      assert.doesNotMatch(pack.html, /data-contract-appendix="act"|data-document-kind="acceptance/, 'act stays outside the contract packet');
      await closeProject(page);
      await openProject(page, { saved: pack, source });
      await assertNoOpenSave(page, 42);
      await shell(page).getByRole('tab', { name: 'Акт выполненных работ', exact: true }).click();
      assert.equal(await shell(page).getByLabel('Стоимость по акту, ₽', { exact: true }).inputValue(), '17500.5', 'saved act amount survives reopen');
      assert.equal(await shell(page).getByLabel('Замечания и недостатки', { exact: true }).inputValue(), pack.act.remarks);
      await shell(page).getByRole('tab', { name: 'Договор', exact: true }).click();
      pdfs.push(await downloadPdf(page, 'contract-preserves-act.pdf'));
      const finalPack = await page.evaluate(() => structuredClone(window.__documentValue));
      assert.deepEqual(finalPack.act, pack.act, 'new contract PDF preserves existing current act');
      assert.doesNotMatch(finalPack.html, /data-contract-appendix="act"|data-document-kind="acceptance/, 're-export keeps act separate from contract');
      assert.ok(await page.evaluate(() => window.__projectPatches.every(patch => !('paid' in patch) && !('status' in patch))), 'documents do not change finance or project status');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zamer.contractTpl')).numSeq), 42, 're-export does not consume another number');
      await closeProject(page);
      await captureDefaultExample(page);
    }
    assert.deepEqual(errors, [], 'no browser exceptions');
    results.push({ viewport, templateLayout, projectLayout, errors, pdfs });
    await fs.writeFile(path.join(output, process.env.CONTRACT_WIDTH ? `results-${viewport.width}.json` : 'results.json'), JSON.stringify(results, null, 2));
    await context.tracing.stop({ path: path.join(output, `trace-${viewport.width}.zip`) });
    await context.close(); currentPage = null;
    console.log(`Contract example passed at ${viewport.width} × ${viewport.height}`);
  }
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: path.join(output, 'failure.png') });
    const diagnostics = await currentPage.evaluate(() => ({ appearance: window.__lastDocumentAppearance, pages: window.__lastDocumentPreview }));
    await fs.writeFile(path.join(output, 'failure-diagnostics.json'), JSON.stringify(diagnostics, null, 2));
  }
  throw error;
} finally {
  await browser.close();
}
