import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { LUMFER_CATALOG_SEED as seed, LUMFER_CATALOG_PENDING as pending } from '../src/data/lumfer-track-catalog.js';
import { LUMFER_TRACK_IMAGES as pictures } from '../src/data/lumfer-track-images.js';

const base = process.env.LUMFER_BASE || 'http://127.0.0.1:5174';
const output = path.resolve('artifacts/lumfer-catalog'); await fs.mkdir(output, { recursive: true });
const ids = new Set(seed.rows.map(row => row.id)), reused = seed.rows.filter(row => /^n\d+$/.test(row.id));
const light = seed.rows.find(row => row.sku === '28162'), removed = seed.rows.find(row => row.sku === '28154');
assert.equal(seed.rows.length, 44); assert.equal(reused.length, 8); assert.equal(pending.length, 5);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { base, version: seed.version, rows: 44, errors: [], blockedWrites: [] };
let current;
async function makeContext(width, desktop = false) {
  const context = await browser.newContext({ viewport: { width, height: desktop ? 1000 : 932 }, isMobile: !desktop, hasTouch: !desktop, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { results.blockedWrites.push(request.method() + ' ' + request.url().split('?')[0]); return route.abort('blockedbyclient'); }
    return route.continue();
  });
  const page = await context.newPage(); current = page; page.setDefaultTimeout(15000);
  page.on('pageerror', error => results.errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  return { context, page };
}
async function ready(page) {
  await page.goto(base + '/design/app.html?screen=app', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__zamer?.designSnapshot && window.__zamer?.nomEdVals);
}
async function snapshot(page) { return page.evaluate(() => structuredClone(window.__zamer.designSnapshot())); }
function catalogue(snapshot, expected = seed.rows) {
  const actual = snapshot.nom.filter(row => ids.has(String(row.nid ?? row.id)));
  assert.equal(actual.length, expected.length);
  for (const expectedRow of expected) {
    const row = actual.find(row => String(row.nid ?? row.id) === expectedRow.id);
    assert.ok(row, expectedRow.id); assert.equal(row.category, 'equipment');
    for (const key of ['n', 'p', 'pCost', 'img']) assert.equal(row[key], expectedRow[key], expectedRow.id + ' ' + key);
  }
  for (const row of reused) assert.equal(actual.filter(item => String(item.nid ?? item.id) === row.id && item.category !== 'equipment').length, 0);
  for (const item of pending) assert.equal(actual.some(row => row.sku === item.sku), false);
  for (const id of ['n409', 'n412']) { const row = actual.find(item => String(item.nid ?? item.id) === id); assert.equal(row.mult, 3); assert.equal(row.specs.stockLengthM, 3); }
}
async function mobileCatalog(page, width, viaMenu = false) {
  if (viaMenu) {
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    await page.getByRole('dialog', { name: 'Главное меню', exact: true }).getByRole('button', { name: 'Номенклатуры', exact: true }).click();
  }
  await page.evaluate(() => window.__zamer.go('nomEd', { ne: { q: '', brand: 'LumFer', kind: 'e', from: 'dash' } }));
  await page.getByText(light.n, { exact: true }).waitFor();
  const groups = await page.evaluate(() => window.__zamer.nomEdVals().neGroups.map(group => ({ title: group.title, names: group.items.map(row => row.n) })));
  assert.deepEqual(groups.map(group => group.title), ['Оборудование']);
  assert.deepEqual(groups[0].names.slice().sort(), seed.rows.map(row => row.n).sort());
  const images = await page.evaluate(names => names.map(name => {
    const element = [...document.querySelectorAll('div,span,strong')].find(node => node.childElementCount === 0 && node.textContent === name);
    for (let parent = element?.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const backgrounds = [...parent.querySelectorAll('*')].map(node => getComputedStyle(node).backgroundImage).filter(value => value.includes('/design/nom/lf_catalog_'));
      if (backgrounds.length === 1) return { name, background: backgrounds[0] };
      if (backgrounds.length > 1) break;
    }
    return { name, background: null };
  }), seed.rows.map(row => row.n));
  for (const row of seed.rows) assert.ok(images.find(image => image.name === row.n)?.background?.includes('/design/nom/' + row.img), row.id + ' UI photograph matches SKU');
  await page.evaluate(() => window.__zamer.nomEdVals().neKinds.find(kind => kind.label === 'Материалы').pick());
  const materialNames = await page.evaluate(() => window.__zamer.nomEdVals().neGroups.flatMap(group => group.items.map(row => row.n)));
  for (const row of reused) assert.equal(materialNames.includes(row.n), false, row.id + ' no longer appears among materials');
  await page.evaluate(() => window.__zamer.nomEdVals().neKinds.find(kind => kind.label === 'Оборудование').pick());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(output, 'mobile-' + width + '.png') });
  return groups[0].names.length;
}
async function browserPictures(page) {
  const loaded = await page.evaluate(async rows => Promise.all(rows.map(row => new Promise(resolve => {
    const image = new Image(); image.onload = () => resolve({ id: row.id, source: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ id: row.id, source: image.src, width: 0, height: 0 }); image.src = row.imageUrl;
  }))), seed.rows);
  for (const image of loaded) assert.ok(image.width > 0 && image.height > 0, image.id + ' image decodes in browser');
  const files = new Map(seed.rows.map(row => [row.img, row]));
  for (const [file, row] of files) {
    const response = await page.request.get(base + row.imageUrl); assert.ok(response.ok(), file);
    const bytes = await response.body(), expected = Buffer.from(pictures[file.replace(/\.webp$/, '')].split(',')[1], 'base64');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(expected).digest('hex'), file + ' matches catalogue extraction');
  }
  return { rowsLoaded: loaded.length, uniqueFiles: files.size };
}
try {
  const mobile = await makeContext(390); await ready(mobile.page);
  const fresh = await snapshot(mobile.page); catalogue(fresh);
  results.mobile390 = await mobileCatalog(mobile.page, 390, true);
  results.pictures = await browserPictures(mobile.page);
  const old = structuredClone(fresh);
  old.catalogueVersions = (old.catalogueVersions || []).filter(version => version !== seed.version);
  old.nom = old.nom.filter(row => !ids.has(String(row.nid ?? row.id)));
  old.nom.push(...reused.map(row => ({ id: row.id, n: row.n, br: 'LumFer', u: row.u, m: 1, p: 99, pCost: 49 })));
  old.nom.push({ id: 'qa-unrelated', n: 'Сохранённая пользовательская позиция', br: 'Пример', u: 'шт', m: 0, p: 11223 });
  const preserved = { projects: old.projects, presets: old.presets, estEd: old.estEd };
  await mobile.page.evaluate(value => localStorage.setItem('zamer.design.v1', JSON.stringify(value)), old);
  await ready(mobile.page);
  const migrated = await snapshot(mobile.page); catalogue(migrated);
  for (const key of Object.keys(preserved)) assert.deepEqual(migrated[key], preserved[key], 'migration preserves ' + key);
  assert.equal(migrated.nom.find(row => row.id === 'qa-unrelated').p, 11223);
  assert.ok(migrated.catalogueVersions.includes(seed.version));
  await mobileCatalog(mobile.page, 390);
  await mobile.page.getByText(light.n, { exact: true }).click();
  await mobile.page.waitForFunction(() => window.__zamer.state.screen === 'nomItem');
  const fields = mobile.page.locator('input');
  const indexes = await fields.evaluateAll(nodes => ({ retail: nodes.findIndex(node => node.value === '2380'), cost: nodes.findIndex(node => node.value === '1274') }));
  assert.ok(indexes.retail >= 0 && indexes.cost >= 0, '28162 card shows retail 2380 and purchase 1274');
  await mobile.page.screenshot({ path: path.join(output, 'light-28162-prices.png') });
  await fields.nth(indexes.retail).fill('2499'); await fields.nth(indexes.cost).fill('1299');
  await mobile.page.waitForFunction(() => window.__zamer.state.ni.p === '2499' && window.__zamer.state.ni.pCost === '1299');
  await mobile.page.evaluate(() => window.__zamer.nomEdVals().niDone());
  await mobile.page.evaluate(() => window.__zamer.saveDesign());
  await ready(mobile.page);
  let saved = await snapshot(mobile.page);
  assert.equal(saved.nom.find(row => row.id === light.id).p, 2499); assert.equal(saved.nom.find(row => row.id === light.id).pCost, 1299);
  await mobile.page.evaluate(() => window.__zamer.go('nomEd', { ne: { q: '', brand: 'LumFer', kind: 'e' } }));
  await mobile.page.getByText(removed.n, { exact: true }).click();
  await mobile.page.waitForFunction(() => window.__zamer.state.screen === 'nomItem');
  await mobile.page.evaluate(() => { window.__zamer.nomEdVals().niDelete(); window.__zamer.saveDesign(); });
  await ready(mobile.page); saved = await snapshot(mobile.page);
  assert.equal(saved.nom.some(row => row.id === removed.id), false, 'deleted catalogue position is not restored by the seed');
  assert.equal(saved.nom.find(row => row.id === light.id).p, 2499); assert.equal(saved.nom.find(row => row.id === light.id).pCost, 1299);
  for (const key of Object.keys(preserved)) assert.deepEqual(saved[key], preserved[key], 'later catalogue edits preserve ' + key);
  results.migration = { oldRowsMigrated: 8, added: 36, projectsAndPresetsPreserved: true, userPriceAndCostPersist: true, deletionPersists: true, marker: seed.version };

  const wide = await makeContext(430); await ready(wide.page); catalogue(await snapshot(wide.page)); results.mobile430 = await mobileCatalog(wide.page, 430);
  await wide.page.evaluate(async item => {
    const rows = window.__zamer.designSnapshot().nom;
    const est = window.MagicEstimate.withEstimateImages({ equipment: [{ n: item.n, q: 1, p: item.p, u: item.u }] }, rows);
    await window.MagicEstimate.previewEstimate({ project: { name: 'Пример LumFer' }, est, cols: { photo: true } });
  }, light);
  const estimatePicture = wide.page.getByRole('dialog', { name: 'Предпросмотр сметы', exact: true }).locator('.estimate-document tbody img').first();
  await estimatePicture.waitFor(); await estimatePicture.evaluate(image => image.decode());
  assert.ok((await estimatePicture.getAttribute('src')).endsWith('/design/nom/' + light.img));
  assert.ok(await estimatePicture.evaluate(image => image.naturalWidth > 0));
  await wide.page.screenshot({ path: path.join(output, 'equipment-estimate-photo.png') });
  await wide.page.getByRole('button', { name: 'Закрыть предпросмотр сметы', exact: true }).click();
  results.estimatePhoto = light.img;
  const desktop = await makeContext(1440, true);
  await desktop.page.goto(base + '/online/index.html', { waitUntil: 'domcontentloaded' });
  await desktop.page.getByRole('button', { name: 'Номенклатура', exact: true }).waitFor();
  await desktop.page.getByRole('button', { name: 'Номенклатура', exact: true }).click();
  await desktop.page.locator('.sx-catalog-tabs').getByRole('button', { name: /^Оборудование/ }).click();
  await desktop.page.getByRole('navigation', { name: 'Папки и бренды', exact: true }).getByTitle('LumFer', { exact: true }).click();
  await desktop.page.getByText('44 позиций', { exact: true }).waitFor();
  const online = await desktop.page.evaluate(() => structuredClone(window.MAGIC_MAIN.nom));
  catalogue({ nom: online });
  const pages = [];
  do {
    const rows = desktop.page.locator('.sx-catalog-table tbody tr');
    pages.push(...await rows.locator('strong').allTextContents());
    for (const image of await rows.locator('img').all()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(element => element.decode()); assert.ok(await image.evaluate(element => element.naturalWidth > 0)); }
    const next = desktop.page.getByRole('button', { name: 'Следующая страница', exact: true });
    if (await next.isDisabled()) break;
    await next.click();
  } while (true);
  assert.deepEqual(pages.slice().sort(), seed.rows.map(row => row.n).sort());
  await desktop.page.screenshot({ path: path.join(output, 'online-equipment.png') });
  results.desktopOnline = { rows: pages.length, loadedPictures: pages.length };
  assert.deepEqual(results.errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} catch (error) { await current?.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {}); await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ ...results, failure: error.message }, null, 2)); throw error; }
finally { await browser.close(); }
