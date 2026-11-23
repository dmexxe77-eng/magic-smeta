import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { setTimeout as pollDelay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { CRM_EQUIPMENT_CATALOG_SEEDS as seeds } from '../src/data/crm-equipment-catalog.js';
import { LUMFER_CATALOG_SEED as lumfer } from '../src/data/lumfer-track-catalog.js';
import { validateDesktopSnapshot } from '../src/desktop/desktop-storage.js';

const base = process.env.CRM_CATALOG_BASE || 'http://127.0.0.1:5176';
const output = path.resolve('artifacts/crm-equipment-catalog'); await fs.mkdir(output, { recursive: true });
const rows = seeds.flatMap(seed => seed.rows), ids = new Set(rows.map(row => row.id)), versions = seeds.map(seed => seed.version);
const zero = rows.find(row => row.pCost === 0), deleted = seeds[1].rows[0], retailEdit = zero.p + 11;
const key = 'zamer.desktop.working.v1', database = 'zamer.desktop.snapshots.v1';
assert.equal(rows.length, 334); assert.equal(rows.filter(row => row.pCost === 0).length, 31);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { base, rows: rows.length, zeroCostRows: 31, folders: [], errors: [], blockedWrites: [] };
let current;
async function newPage(mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 932 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { results.blockedWrites.push(request.method() + ' ' + request.url().split('?')[0]); return route.abort('blockedbyclient'); }
    return route.continue();
  });
  await context.addInitScript(({ database, key }) => {
    window.__crmSnapshot = () => new Promise((resolve, reject) => {
      const opening = indexedDB.open(database);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result, request = db.transaction('snapshots', 'readonly').objectStore('snapshots').get(key);
        request.onsuccess = () => { db.close(); resolve(request.result ? JSON.parse(request.result.raw) : null); };
        request.onerror = () => { db.close(); reject(request.error); };
      };
    });
  }, { database, key });
  const page = await context.newPage(); current = page; page.setDefaultTimeout(20000);
  page.on('pageerror', error => results.errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  return { context, page };
}
async function online(page) {
  await page.goto(base + '/online/index.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Номенклатура', exact: true }).waitFor();
}
async function folder(page, brand) {
  await page.getByRole('button', { name: 'Номенклатура', exact: true }).click();
  await page.locator('.sx-catalog-tabs').getByRole('button', { name: /^Оборудование/ }).click();
  await page.getByRole('navigation', { name: 'Папки и бренды', exact: true }).getByTitle(brand, { exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск номенклатуры', exact: true }).fill('');
}
const money = text => Number(text.replace(/[\s₽]/g, '').replace(',', '.'));
const displayName = text => text.replace(/\s+/g, ' ').trim();
function assertCatalog(snapshot) {
  const actual = snapshot.nom.filter(row => ids.has(String(row.nid ?? row.id)));
  assert.equal(actual.length, 334);
  for (const expected of rows) {
    const row = actual.find(row => String(row.nid ?? row.id) === expected.id);
    for (const field of ['n', 'sku', 'p', 'pCost', 'u', 'br', 'img', 'imageUrl', 'category']) assert.equal(row[field], expected[field], expected.id + ' ' + field);
  }
  assert.equal(actual.filter(row => row.pCost === 0).length, 31);
}
async function snapshot(page) { return page.evaluate(() => window.__crmSnapshot()); }
async function persisted(page, condition, argument) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const value = await snapshot(page);
    if (value && condition(value, argument)) return value;
    await pollDelay(50);
  }
  assert.fail('Timed out waiting for the expected saved IndexedDB snapshot');
}
async function unchanged(actual, original, label) {
  for (const field of ['projects', 'presets', 'estEd']) {
    if (!isDeepStrictEqual(actual[field], original[field])) {
      const changes = [];
      const walk = (before, after, location) => {
        if (isDeepStrictEqual(before, after) || changes.length >= 40) return;
        if (before && after && typeof before === 'object' && typeof after === 'object') {
          for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) walk(before[key], after[key], location + '.' + key);
        } else changes.push({ path: location, beforeType: typeof before, afterType: typeof after, ...(typeof before === 'number' && typeof after === 'number' ? { before, after } : {}) });
      };
      walk(original[field], actual[field], field);
      await fs.writeFile(path.join(output, 'preservation-diff.json'), JSON.stringify({ label, field, changes }, null, 2));
      assert.fail(label + ' preserves ' + field + '; diagnostic paths saved');
    }
  }
}
try {
  let desktop = await newPage();
  const response = await desktop.context.request.get(base + '/online/main-data.js'); assert.ok(response.ok());
  const script = await response.text(), prefix = 'window.MAGIC_MAIN=';
  const main = JSON.parse(script.slice(script.indexOf(prefix) + prefix.length).trim().replace(/;$/, ''));
  assertCatalog(main); assert.equal(main.projects.length, 36); assert.equal(main.projects.reduce((sum, project) => sum + project.rooms.length, 0), 236);
  // A previous desktop user's snapshot already contains the ordinary calculation
  // and photo freezing metadata. Obtain that baseline through the real runtime.
  await online(desktop.page);
  await desktop.page.getByRole('button', { name: 'Номенклатура', exact: true }).click();
  const normalized = await persisted(desktop.page, (value, expected) => expected.every(version => value.catalogueVersions?.includes(version)), versions);
  assert.equal(normalized.projects.length, 36); assert.equal(normalized.projects.reduce((sum, project) => sum + project.rooms.length, 0), 236);
  const old = structuredClone(normalized);
  await desktop.context.close();
  desktop = await newPage();
  old.nom = old.nom.filter(row => !ids.has(String(row.nid ?? row.id)));
  old.catalogueVersions = (old.catalogueVersions || []).filter(version => !versions.includes(version));
  delete old.catalogSeeds; delete old.catalogSeed;
  const lumferEdited = lumfer.rows.find(row => row.sku === '28162'), lumferDeleted = lumfer.rows.find(row => row.sku === '28154');
  old.nom.find(row => String(row.nid ?? row.id) === lumferEdited.id).p = 2777;
  old.nom = old.nom.filter(row => String(row.nid ?? row.id) !== lumferDeleted.id);
  assert.ok(old.catalogueVersions.includes(lumfer.version)); assert.ok(validateDesktopSnapshot(old), 'synthetic old working snapshot is valid');
  const original = structuredClone(old);
  await desktop.page.route(base + '/__crm_qa_blank__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated storage fixture</title>' }));
  await desktop.page.goto(base + '/__crm_qa_blank__');
  await desktop.page.evaluate(({ database, key, value }) => new Promise((resolve, reject) => {
    const opening = indexedDB.open(database, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('snapshots');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result, transaction = db.transaction('snapshots', 'readwrite');
      transaction.objectStore('snapshots').put({ version: 1, raw: JSON.stringify(value), revision: 1, updatedAt: Date.now() }, key);
      transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), { database, key, value: old });
  await online(desktop.page);
  if (!process.env.CRM_QA_SKIP_CATALOG_RENDER) for (const seed of seeds) {
    await folder(desktop.page, seed.brand);
    await desktop.page.getByText(seed.rows.length + ' позиций', { exact: true }).waitFor();
    const seen = [];
    do {
      const tableRows = desktop.page.locator('.sx-catalog-table tbody tr');
      for (const item of await tableRows.all()) {
        const name = await item.locator('strong').innerText(), expected = seed.rows.find(row => displayName(row.n) === displayName(name));
        assert.ok(expected, 'only selected source products appear in ' + seed.brand);
        const cells = item.locator('td');
        assert.equal((await cells.nth(1).innerText()).trim(), 'Оборудование');
        assert.equal((await cells.nth(3).innerText()).trim(), expected.u);
        assert.equal(money(await cells.nth(4).innerText()), expected.pCost, expected.sku + ' purchase');
        assert.equal(money(await cells.nth(5).innerText()), expected.p, expected.sku + ' retail');
        const image = item.locator('img'); await image.scrollIntoViewIfNeeded(); await image.evaluate(element => element.decode());
        assert.ok(await image.evaluate(element => element.naturalWidth > 0));
        assert.equal(new URL(await image.getAttribute('src'), base).pathname, expected.imageUrl, expected.sku + ' photograph');
        seen.push(expected.id);
      }
      if (seen.length <= 30) await desktop.page.screenshot({ path: path.join(output, seed.brand.toLowerCase() + '-catalog.png') });
      const next = desktop.page.getByRole('button', { name: 'Следующая страница', exact: true });
      if (await next.isDisabled()) break; await next.click();
    } while (true);
    assert.deepEqual(seen.slice().sort(), seed.rows.map(row => row.id).sort());
    results.folders.push({ brand: seed.brand, rows: seen.length, decodedPictures: seen.length });
    console.log(seed.brand, seen.length, 'UI rows / decoded pictures / exact prices passed');
  }
  else await folder(desktop.page, seeds[0].brand);
  const migrated = await persisted(desktop.page, (value, versions) => versions.every(version => value.catalogueVersions?.includes(version)), versions);
  assertCatalog(migrated); await unchanged(migrated, original, 'catalogue migration');
  assert.equal(migrated.nom.find(row => String(row.nid ?? row.id) === lumferEdited.id).p, 2777);
  assert.equal(migrated.nom.some(row => String(row.nid ?? row.id) === lumferDeleted.id), false);
  const photos = [...new Set(rows.map(row => row.imageUrl))]; assert.equal(photos.length, 183);
  for (const url of photos) {
    const res = await desktop.context.request.get(base + url); assert.ok(res.ok());
    const served = await res.body(), local = await fs.readFile(path.join('public', url));
    assert.ok(local.length > 0); assert.equal(createHash('sha256').update(served).digest('hex'), createHash('sha256').update(local).digest('hex'));
  }
  results.photoFiles = photos.length;
  await folder(desktop.page, zero.br);
  await desktop.page.getByRole('textbox', { name: 'Поиск номенклатуры', exact: true }).fill(zero.n);
  await desktop.page.getByRole('button', { name: 'Изменить ' + zero.n, exact: true }).click();
  const editor = desktop.page.locator('.nc-item-page');
  const retail = editor.getByRole('textbox', { name: /^Розничная/ }), cost = editor.getByRole('textbox', { name: /^Себестоимость/ });
  assert.equal(await retail.inputValue(), String(zero.p)); assert.equal(await cost.inputValue(), '0');
  await desktop.page.screenshot({ path: path.join(output, 'zero-cost-card.png') });
  await retail.fill(String(retailEdit)); await cost.fill(''); await cost.fill('0');
  await editor.locator('.nc-item-heading').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await persisted(desktop.page, (value, expected) => value.nom.some(row => row.id === expected.id && row.p === expected.price && row.pCost === 0), { id: zero.id, price: retailEdit });
  await online(desktop.page);
  await folder(desktop.page, deleted.br);
  await desktop.page.getByRole('textbox', { name: 'Поиск номенклатуры', exact: true }).fill(deleted.n);
  await desktop.page.getByRole('button', { name: 'Изменить ' + deleted.n, exact: true }).click();
  await editor.getByRole('button', { name: 'Удалить позицию', exact: true }).click();
  await editor.locator('.nc-delete-confirm').getByRole('button', { name: 'Удалить', exact: true }).click();
  await persisted(desktop.page, (value, id) => !value.nom.some(row => row.id === id), deleted.id);
  await online(desktop.page);
  const saved = await snapshot(desktop.page);
  assert.equal(saved.nom.some(row => row.id === deleted.id), false); assert.equal(saved.nom.find(row => row.id === zero.id).p, retailEdit); assert.equal(saved.nom.find(row => row.id === zero.id).pCost, 0);
  await unchanged(saved, original, 'subsequent catalogue edits');
  assert.equal(saved.nom.find(row => row.id === lumferEdited.id).p, 2777); assert.equal(saved.nom.some(row => row.id === lumferDeleted.id), false);
  results.persistence = { projects: 36, rooms: 236, presetsAndEstEdUnchanged: true, zeroCostPersisted: true, editedRetail: retailEdit, deletionPersisted: true, lumferMarkerIndependent: true };

  const equipment = rows.find(row => row.u === 'уп' && row.id !== deleted.id && main.nom.filter(item => item.n === row.n).length === 1) || seeds[1].rows[1];
  const project = main.projects.find(project => project.rooms.length);
  await desktop.page.getByTitle('Проекты', { exact: true }).click();
  await desktop.page.getByText(project.name, { exact: true }).click();
  await desktop.page.locator('.d-project-tabs').getByRole('button', { name: /^Расчёт/ }).click();
  await desktop.page.locator('.d-calc-block').filter({ hasText: 'Дополнительные позиции' }).getByRole('button', { name: 'Добавить', exact: true }).click();
  const picker = desktop.page.locator('.nc-picker');
  await picker.getByRole('textbox', { name: 'Поиск по базе номенклатуры', exact: true }).fill(equipment.n);
  await picker.getByRole('checkbox', { name: 'Выбрать ' + equipment.n, exact: true }).check();
  await picker.getByRole('button', { name: 'Добавить · 1', exact: true }).click();
  const quantity = desktop.page.getByRole('textbox', { name: 'Количество ' + equipment.n, exact: true });
  await quantity.fill('2'); await quantity.press('Tab');
  await desktop.page.locator('.d-calculation-footer').getByRole('button', { name: 'Открыть смету', exact: true }).click();
  const estimateRow = desktop.page.locator('.estimate-document tbody tr').filter({ hasText: equipment.n }).first(); await estimateRow.waitFor();
  const estimateValues = await estimateRow.evaluate(row => ({ headers: [...row.closest('table').querySelectorAll('thead th')].map(cell => cell.textContent.trim()), cells: [...row.cells].map(cell => cell.textContent.trim()) }));
  const column = pattern => { const index = estimateValues.headers.findIndex(header => pattern.test(header)); assert.ok(index >= 0, 'estimate column ' + pattern); return estimateValues.cells[index]; };
  assert.equal(column(/^Ед/), equipment.u); assert.equal(money(column(/^Кол/)), 2); assert.equal(money(column(/^Цена/)), equipment.p);
  const estimateImage = estimateRow.locator('img'); await estimateImage.evaluate(image => image.decode());
  assert.equal(new URL(await estimateImage.getAttribute('src'), base).pathname, equipment.imageUrl); assert.ok(await estimateImage.evaluate(image => image.naturalWidth > 0));
  await desktop.page.screenshot({ path: path.join(output, 'equipment-estimate.png') });
  results.estimate = { sku: equipment.sku, qty: 2, unit: equipment.u, retail: equipment.p, image: equipment.imageUrl };

  const mobile = await newPage(true);
  await mobile.page.goto(base + '/design/app.html?screen=app', { waitUntil: 'domcontentloaded' });
  await mobile.page.waitForFunction(() => window.__zamer?.nomEdVals);
  const mobileRows = await mobile.page.evaluate(() => window.__zamer.designSnapshot().nom);
  assert.equal(mobileRows.filter(row => ids.has(String(row.nid ?? row.id))).length, 0);
  assert.equal(mobileRows.filter(row => ['Technolight', 'EVOQ'].includes(row.br)).length, 0);
  assert.equal(mobileRows.filter(row => row.br === 'LumFer' && row.category === 'equipment').length, 44);
  await mobile.page.evaluate(() => window.__zamer.go('nomEd', { ne: { q: '', brand: 'LumFer', kind: 'e' } }));
  await mobile.page.getByText('44 позиций', { exact: true }).waitFor();
  await mobile.page.screenshot({ path: path.join(output, 'mobile-lumfer-unchanged.png') });
  results.mobile = { crmRows: 0, lumferEquipment: 44 };
  assert.deepEqual(results.errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
} catch (error) { await current?.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {}); await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ ...results, failure: error.message }, null, 2)); throw error; }
finally { await browser.close(); }
