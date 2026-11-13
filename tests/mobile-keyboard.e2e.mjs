import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.KEYBOARD_BASE || 'http://127.0.0.1:5174';
const baseline = process.env.KEYBOARD_BASELINE === '1';
const output = path.resolve(process.env.KEYBOARD_OUTPUT || `artifacts/mobile-keyboard/${baseline ? 'baseline' : 'fixed'}`);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { base, baseline, physicalIPhone: false, scenarios: [], errors: [], blockedWrites: [] };

function mockVisualViewport() {
  const viewport = new EventTarget();
  let dimensions = { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1 };
  for (const key of Object.keys(dimensions)) Object.defineProperty(viewport, key, { get: () => dimensions[key] });
  Object.defineProperties(viewport, { pageTop: { get: () => scrollY + dimensions.offsetTop }, pageLeft: { get: () => scrollX + dimensions.offsetLeft } });
  viewport.set = patch => {
    dimensions = { ...dimensions, ...patch };
    for (const type of ['resize', 'scroll']) {
      const event = new Event(type); viewport.dispatchEvent(event); viewport['on' + type]?.(event);
    }
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport });
  window.__keyboardViewport = viewport;
}

async function context(mobile) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1360, height: 1050 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  await context.addInitScript(mockVisualViewport);
  await context.route('**/*', route => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { results.blockedWrites.push(request.method() + ' ' + request.url().split('?')[0]); return route.abort('blockedbyclient'); }
    return route.continue();
  });
  context.on('page', page => page.on('pageerror', error => results.errors.push(error.message)));
  return context;
}
async function settle(frame) { await frame.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }); }
async function load(page) {
  await page.goto(base + '/design/app.html?screen=app', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__zamer && window.MagicContract && window.MagicDocuments);
  await settle(page);
}
async function probe(page, name, selector, input) {
  // The preload runs before the device-width meta is parsed on mobile Chromium.
  // Start each keyboard transition from the final layout viewport, not 980px mode.
  await page.evaluate(() => window.__keyboardViewport.set({ width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0 }));
  await settle(page);
  await input.waitFor(); await input.focus(); await settle(page);
  const initial = await page.locator(selector).evaluate(element => { const r = element.getBoundingClientRect(); return { top: r.top, height: r.height, left: r.left, width: r.width }; });
  await page.evaluate(() => {
    const spacer = document.createElement('div'); spacer.id = 'keyboard-scroll-fixture';
    spacer.style.cssText = 'position:absolute;top:2200px;left:0;width:1px;height:1px;pointer-events:none'; document.body.append(spacer);
    window.scrollTo(0, 145);
    window.__keyboardViewport.set({ height: 480, offsetTop: 170 });
    window.dispatchEvent(new Event('scroll'));
  });
  await settle(page);
  const observed = await page.locator(selector).evaluate(element => {
    const r = element.getBoundingClientRect(), viewport = visualViewport, active = document.activeElement, f = active?.getBoundingClientRect();
    return { root: { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height },
      viewport: { top: viewport.offsetTop, height: viewport.height, bottom: viewport.offsetTop + viewport.height, pageTop: viewport.pageTop },
      documentScroll: scrollY, focus: { tag: active?.tagName, top: f?.top, bottom: f?.bottom },
      coveredTop: element.contains(document.elementFromPoint(viewport.offsetLeft + 8, viewport.offsetTop + 8)),
      coveredBottom: element.contains(document.elementFromPoint(viewport.offsetLeft + 8, viewport.offsetTop + viewport.height - 8)) };
  });
  const failures = [];
  if (Math.abs(observed.root.top - observed.viewport.top) > 2) failures.push('root top does not follow visualViewport offsetTop');
  if (Math.abs(observed.root.height - observed.viewport.height) > 2) failures.push('root height does not follow keyboard viewport');
  if (!observed.coveredTop || !observed.coveredBottom) failures.push('underlying page is exposed inside the visible viewport');
  const fieldHeight = observed.focus.bottom - observed.focus.top;
  if (fieldHeight <= observed.viewport.height && (observed.focus.top < observed.viewport.top - 2 || observed.focus.bottom > observed.viewport.bottom + 2)) failures.push('focused control is outside the keyboard viewport');
  await page.screenshot({ path: path.join(output, name + '-keyboard.png') });
  await page.evaluate(() => { document.activeElement?.blur(); window.__keyboardViewport.set({ height: innerHeight }); document.getElementById('keyboard-scroll-fixture')?.remove(); window.scrollTo(0, 0); window.dispatchEvent(new Event('scroll')); });
  await settle(page);
  const recovered = await page.locator(selector).evaluate(element => { const r = element.getBoundingClientRect(); return { top: r.top, height: r.height }; });
  if (Math.abs(recovered.top - initial.top) > 2 || Math.abs(recovered.height - initial.height) > 2) failures.push('geometry did not recover after closing keyboard');
  await page.evaluate(() => window.__keyboardViewport.set({ offsetTop: 0 }));
  results.scenarios.push({ name, initial, observed, recovered, failures });
  console.log(name, JSON.stringify({ scroll: observed.documentScroll, root: observed.root, viewport: observed.viewport, failures }));
}

try {
  const mobile = await context(true), page = await mobile.newPage();
  const viewportResponse = await mobile.request.get(base + '/design/viewport.js');
  results.viewportScriptSha256 = createHash('sha256').update(await viewportResponse.body()).digest('hex');
  await load(page);
  await page.evaluate(() => { let handle; handle = window.MagicContract.openTemplate({ templateStore: { load: () => ({}), save() {} }, onClose: () => handle.close() }); window.__keyboardHandle = handle; });
  await page.locator('.cd-section-toggle').filter({ hasText: 'Вступление' }).click();
  await probe(page, 'contract', '.z-contract-shell', page.getByLabel('Текст вступления', { exact: true }));
  await page.evaluate(() => window.__keyboardHandle.close());

  await load(page);
  await page.evaluate(() => { const app = window.__zamer, project = app.state.projects.find(project => project.rooms?.length); app.setState({ screen: 'project', curId: project.id, sheet: null }); });
  await probe(page, 'project', '.z-app-shell', page.getByLabel('Адрес', { exact: true }));

  await load(page);
  await page.evaluate(() => window.MagicDocuments.openAccountSettings({ profile: { signerName: 'Иванов И.И.' }, onChange() { throw new Error('Read-only QA'); } }));
  await page.getByRole('button', { name: 'Изменить ФИО для подписи', exact: true }).click();
  await probe(page, 'account', '.z-account-settings', page.getByRole('textbox', { name: 'ФИО для подписи', exact: true }));

  await load(page);
  await page.evaluate(() => window.MagicDocuments.openMenuDestination({ id: 'support' }));
  await probe(page, 'support', '.nm-page', page.getByRole('dialog', { name: 'Поддержка', exact: true }).getByLabel('Текст', { exact: true }));

  await load(page);
  await page.evaluate(() => { const app = window.__zamer, project = app.state.projects.find(project => project.rooms?.length); app.setState({ screen: 'calc', curId: project.id, tab: project.rooms[0].id, sheet: null }); });
  await page.getByText(/^Полотно$/i).click();
  await probe(page, 'calculator', '.z-app-shell', page.locator('input:visible').first());

  await page.goto(base + '/design/login.html', { waitUntil: 'domcontentloaded' });
  await probe(page, 'login', '.z-login-screen', page.locator('input:visible').first());

  const desktop = await context(false), host = await desktop.newPage();
  await host.goto(base + '/design/index.html?screen=app&preview=1&previewDevice=iphone-14', { waitUntil: 'domcontentloaded' });
  await host.locator('#preview-frame').waitFor();
  const frame = await (await host.locator('#preview-frame').elementHandle()).contentFrame();
  assert.ok(frame);
  await frame.locator('.z-app-shell').waitFor();
  await settle(frame);
  assert.equal(await frame.evaluate(() => document.documentElement.classList.contains('z-mobile-viewport')), false, 'native keyboard guard is inactive inside a desktop preview');
  const innerBefore = await frame.locator('.z-app-shell').boundingBox();
  const before = await host.locator('#preview-frame').boundingBox();
  await frame.locator('.z-app-shell').evaluate(() => window.__keyboardViewport.set({ height: 480, offsetTop: 170 }));
  await settle(frame);
  const after = await host.locator('#preview-frame').boundingBox();
  const innerAfter = await frame.locator('.z-app-shell').boundingBox();
  if (!baseline) {
    assert.deepEqual(after, before, 'desktop device preview geometry remains unchanged');
  }
  results.desktop = { before, after, innerBefore, innerAfter };
  await host.screenshot({ path: path.join(output, 'desktop-preview.png') });
  assert.deepEqual(results.errors, []);
  const failures = results.scenarios.filter(scenario => scenario.failures.length);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  if (baseline) assert.ok(failures.length > 0, 'old behavior reproduces a keyboard geometry failure');
  else assert.deepEqual(failures.map(scenario => ({ name: scenario.name, failures: scenario.failures })), []);
  console.log(baseline ? 'Old keyboard geometry regression reproduced.' : 'Keyboard geometry regression checks passed.');
} catch (error) { await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ ...results, failure: error.message }, null, 2)); throw error; }
finally { await browser.close(); }
