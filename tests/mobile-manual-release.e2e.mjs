import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Exercises the shipped MagicDraw bridge in an isolated browser context.
// Saved drawings stay in this fixture and never enter application projects.
const url = process.env.MANUAL_URL || 'http://127.0.0.1:5175/design/';
const output = process.env.MANUAL_ARTIFACT_DIR || '/private/tmp/zamerx-manual-restore-qa/local';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await context.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const editor = page.locator('.zd .app');
const action = (name, extra = '') => page.locator(`.zd [data-act="${name}"]${extra}`);
const stage = number => page.waitForFunction(value => document.querySelector('.zd .app')?.dataset.stage === String(value), number, { timeout: 8000 });
const screenshot = name => page.screenshot({ path: path.join(output, `${name}-390.png`) });

async function open(initial = null) {
  await page.evaluate(value => {
    window.__manualHandle?.close();
    window.__manualHandle = window.MagicDraw.open({
      roomName: 'Проверка ручного построения', initial: value,
      onFinish: result => { window.__manualSaved = result; window.__manualHandle.close(); },
    });
  }, initial);
  await editor.waitFor({ state: 'visible' });
}

async function assertNewStart() {
  assert.equal(await editor.evaluate(node => node.classList.contains('mobile-workflow')), true, 'the public bridge opts into the current phone workflow');
  await page.getByRole('heading', { name: 'Как построим потолок?', exact: true }).waitFor();
  assert.equal(await action('q-poly').count(), 1);
  assert.equal(await action('q-polyfree').count(), 1);
  const text = await editor.innerText();
  for (const label of ['Прямые углы', 'Диагонали и градусы', 'Готовая форма', 'Прямоугольник', 'Круг / овал']) assert.ok(text.includes(label), label);
  assert.doesNotMatch(text, /Многоугольник · автоматически|Сложный многоугольник|Как строить/);
  const shapes = await page.locator('.zd .quick-shapes .opt-compact').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
  }));
  assert.equal(shapes.length, 2);
  assert.ok(Math.abs(shapes[0].y - shapes[1].y) < 2, 'ready shapes share one compact row');
  for (const box of shapes) assert.ok(box.x >= 0 && box.right <= 390 && box.bottom <= 844, 'start choices fit on the phone');
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.MagicDraw?.open === 'function' && window.__zamer?.state.projects);
  const projectsBefore = await page.evaluate(() => JSON.stringify(window.__zamer.state.projects));
  await open();
  await assertNewStart();
  await screenshot('manual-start');

  // The free branch and ruler controls must belong to the restored screen,
  // rather than merely changing the text of the old shape chooser.
  await action('q-polyfree').tap();
  await stage(1);
  assert.match(await action('sketchMode').innerText(), /Диагонали \/ градусы/);
  await action('rulerMode', '[data-v="ruler"]').tap();
  assert.equal(await action('rulerMode', '[data-v="ruler"]').getAttribute('aria-pressed'), 'true');
  await page.locator('.zd #viewToggle').tap();
  await action('viewFit').waitFor({ state: 'visible' });
  await screenshot('manual-view');
  await action('viewToggle').tap();
  await open();
  await action('q-poly').tap();
  await stage(1);
  assert.match(await action('sketchMode').innerText(), /Прямые углы/);
  assert.equal(await action('rulerMode', '[data-v="rough"]').getAttribute('aria-pressed'), 'true');
  const canvas = await page.locator('.zd #cv').boundingBox();
  assert.ok(canvas.width > 250 && canvas.height > 160, 'drawing retains a usable canvas');
  for (const [fx, fy] of [[0.2, 0.25], [0.8, 0.25], [0.8, 0.65], [0.2, 0.65]]) {
    const current = await page.locator('.zd #cv').boundingBox();
    await page.touchscreen.tap(current.x + current.width * fx, current.y + current.height * fy);
  }
  await screenshot('manual-sketch');
  assert.equal(await page.locator('.zd #cv [data-hit="v"]').count(), 4);
  await action('close').tap();
  await stage(2);
  const first = page.locator('.zd input[data-in="side"][data-i="0"]');
  await first.fill('465,6');
  await first.press('Enter');
  await page.locator('.zd input[data-in="side"][data-i="1"]').fill('300.4');
  await page.locator('.zd input[data-in="side"][data-i="1"]').press('Enter');
  await page.getByRole('button', { name: 'Скрыть клавиатуру', exact: true }).tap();
  await page.waitForFunction(() => document.querySelector('.zd #doneBtn')?.disabled === false, null, { timeout: 8000 });
  await action('done').tap();
  await stage(3);
  await screenshot('manual-decimal');
  await action('finish').tap();
  const saved = await page.evaluate(() => window.__manualSaved);
  await fs.writeFile(path.join(output, 'manual-saved.json'), JSON.stringify(saved, null, 2));
  const firstCentimetres = Math.hypot(saved.verts[1][0] - saved.verts[0][0], saved.verts[1][1] - saved.verts[0][1]) * 100;
  assert.ok(Math.abs(firstCentimetres - 465.6) < 1e-9, `saved AB is ${firstCentimetres} cm`);
  for (const [i, expected] of [465.6, 300.4, 465.6, 300.4].entries()) {
    const a = saved.verts[i], b = saved.verts[(i + 1) % saved.verts.length];
    assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) * 100 - expected) < 1e-8, `right-angle side ${i} agrees with the entered dimensions`);
  }
  assert.deepEqual(saved.draw.m.sides, [465.6, 300.4, null, null]);
  await open(saved);
  await stage(3);
  await page.locator('.zd #stages [data-stage="2"]').tap();
  await stage(2);
  assert.equal(await page.locator('.zd input[data-in="side"][data-i="0"]').inputValue(), '465,6');
  await screenshot('manual-reopened');

  await open();
  await action('q-rect').tap();
  await page.locator('.zd input[data-in="q"][data-k="a"]').fill('465,6');
  await page.locator('.zd input[data-in="q"][data-k="b"]').fill('300.4');
  await action('quickBuild').tap();
  await stage(3);
  await action('finish').tap();
  const quick = await page.evaluate(() => window.__manualSaved);
  assert.ok(Math.abs(quick.verts[1][0] - quick.verts[0][0] - 4.656) < 1e-12);
  assert.ok(Math.abs(quick.verts[2][1] - quick.verts[1][1] - 3.004) < 1e-12);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), projectsBefore, 'isolated fixture does not alter application projects');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'manual-result.json'), JSON.stringify({ url, saved, quick, pageErrors: errors }, null, 2));
  console.log('PASS: restored mobile start, compact shapes, free/grid modes, ruler/view controls, decimal measurement save/reopen, rectangle, untouched projects, no browser errors.');
} catch (error) {
  await screenshot('manual-failure');
  console.error(await editor.innerText().catch(() => 'Editor already closed'));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
