import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Standalone browser check: node tests/mobile-tracing.e2e.mjs
// The trace callback records results only in this isolated browser context.
// It never adds rooms to the application projects or changes their geometry.
const base = process.env.TRACE_URL || 'http://127.0.0.1:5173/design/app.html';
const mode = process.env.TRACE_MODE || 'workflow';
const output = path.resolve(process.env.TRACE_ARTIFACT_DIR || 'artifacts/mobile-tracing');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  headless: true,
});

const namedPlanRooms = [
  { name: 'Спальня', points: [[70, 70], [350, 70], [350, 360], [70, 360]] },
  { name: 'Кухня', points: [[620, 70], [940, 70], [940, 350], [620, 350]] },
  { name: 'Коридор', points: [[420, 60], [560, 60], [560, 420], [920, 420], [920, 560], [420, 560]] },
];

async function openTestPlan(page, { width = 780, height = 580, busy = false, alignmentDefault = false } = {}) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.MagicTrace?.open === 'function' && Array.isArray(window.__zamer?.state.projects));
  await page.evaluate(async ({ width, height, busy, rooms }) => {
    window.__traceProjectBefore = JSON.stringify(window.__zamer?.state.projects);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    if (busy) {
      context.strokeStyle = '#d7dde4';
      context.lineWidth = 0.7;
      for (let x = 10; x < width; x += 20) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 10; y < height; y += 20) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      rooms.forEach((room, index) => {
        context.strokeStyle = '#687483';
        context.lineWidth = 9;
        context.beginPath();
        room.points.forEach(([x, y], point) => point ? context.lineTo(x, y) : context.moveTo(x, y));
        context.closePath();
        context.stroke();
        context.strokeStyle = '#cbd2db';
        context.lineWidth = 2;
        context.stroke();
        context.font = '13px sans-serif';
        context.fillStyle = '#87919e';
        room.points.forEach(([x, y], point) => {
          const next = room.points[(point + 1) % room.points.length];
          context.fillText(String(1100 + index * 200 + point * 75), (x + next[0]) / 2 + 7, (y + next[1]) / 2 - 9);
        });
      });
      context.font = '11px sans-serif';
      context.fillStyle = '#929ba7';
      for (let y = 110; y < 580; y += 90) for (let x = 90; x < 950; x += 140) context.fillText('01 02 / 1800', x, y);
      context.font = '18px sans-serif';
      context.fillStyle = '#657486';
      context.fillText('SYNTHETIC PLAN / FULL ROOM NAMES', 70, 25);
    } else {
    context.strokeStyle = '#35455c';
    context.lineWidth = 4;
    context.strokeRect(100, 100, 200, 200);
    context.strokeRect(430, 100, 200, 200);
    context.font = '18px sans-serif';
    context.fillStyle = '#6f7688';
    context.fillText('SYNTHETIC PLAN / LOCAL TEST', 100, 50);
    }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    window.__traceResults = [];
    window.__traceRoomUpdates = [];
    let handle;
    handle = window.MagicTrace.open({
      file: new File([blob], 'trace-test-plan.png', { type: 'image/png' }),
      roomCount: 0,
      onRoom: room => window.__traceResults.push(room),
      onRoomsChange: rooms => window.__traceRoomUpdates.push(structuredClone(rooms)),
      onDone: () => handle.close(),
    });
    window.__traceTestHandle = handle;
  }, { width, height, busy, rooms: namedPlanRooms });
  await page.waitForFunction(expectedWidth => {
    const image = document.querySelector('.trace-canvas-surface img');
    return image?.complete && image.naturalWidth === expectedWidth && image.getBoundingClientRect().width > 0;
  }, width);
  if (!alignmentDefault) {
    // Free-geometry fixtures select their required mode explicitly, independently
    // of the product default. Fresh-default assertions opt out of this setup.
    await page.getByRole('button', { name: 'Вид', exact: true }).tap();
    await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).uncheck();
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  }
}

async function tapImagePoint(page, x, y) {
  // The production tracer intentionally guards against duplicated touch/click
  // events for 500 ms; respect that interval instead of bypassing its handlers.
  await page.waitForTimeout(550);
  const image = await page.locator('.trace-canvas-surface img').boundingBox();
  const natural = await page.locator('.trace-canvas-surface img').evaluate(element => ({ width: element.naturalWidth, height: element.naturalHeight }));
  assert.ok(image);
  await page.touchscreen.tap(image.x + x / natural.width * image.width, image.y + y / natural.height * image.height);
}

async function assertNoMagnet(page, context, viewportWidth, { baseRooms = 2, verifyLoupe = true } = {}) {
  const surface = page.locator('.trace-canvas-surface');
  const controls = page.locator('.trace-canvas-controls');
  const contour = page.locator('.trace-active-contour');
  // Intentionally skewed walls must keep the coordinates the user chose.
  const rawPoints = [[150.25, 350.5], [310.75, 370.25], [285.5, 500.75], [120.5, 475.25]];
  for (const [x, y] of rawPoints) {
    await tapImagePoint(page, x, y);
  }
  const originalPoints = await contour.getAttribute('points');
  const image = await surface.locator('img').boundingBox();
  // Stay outside the visible close button but inside the old 30px proximity radius.
  await tapImagePoint(page, 150.25 - 20 / image.width * 780, 350.5);
  if (await marker(page, 'E').count() !== 1) {
    await page.screenshot({ path: path.join(output, `no-magnet-debug-${viewportWidth}.png`) });
    console.log('No-magnet debug:', await page.evaluate(() => ({
      contour: document.querySelector('.trace-active-contour')?.getAttribute('points'),
      markers: document.querySelectorAll('.trace-current-geometry .trace-vertex').length,
      surface: document.querySelector('.trace-canvas-surface').getBoundingClientRect().toJSON(),
      image: document.querySelector('.trace-canvas-surface img').getBoundingClientRect().toJSON(),
    })));
  }
  assert.equal(await marker(page, 'E').count(), 1, 'nearby points do not magnetically close the contour');
  assert.match(await contour.getAttribute('stroke-dasharray'), /8[, ]+4/);
  await page.getByRole('button', { name: 'Отменить последнюю точку', exact: true }).click();
  assert.equal(await contour.getAttribute('points'), originalPoints);
  await page.waitForTimeout(550);
  await tapImagePoint(page, rawPoints[0][0], rawPoints[0][1]);
  await page.waitForFunction(() => document.querySelector('.trace-active-contour')?.getAttribute('stroke-dasharray') === 'none');
  const initialScale = controls.getByPlaceholder('длина в см', { exact: true });
  if (await initialScale.isVisible()) {
    await initialScale.fill('500');
    await controls.getByRole('button', { name: 'OK', exact: true }).tap();
  }
  await controls.getByRole('button', { name: /^Добавить / }).waitFor();
  const closedPoints = (await contour.getAttribute('points')).trim().split(/\s+/).map(point => point.split(',').map(Number));
  const originalScreenPoints = originalPoints.trim().split(/\s+/).map(point => point.split(',').map(Number));
  const expectedPoints = [...originalScreenPoints, originalScreenPoints[0]];
  assert.equal(closedPoints.length, expectedPoints.length);
  for (let index = 0; index < expectedPoints.length; index += 1) {
    for (let axis = 0; axis < 2; axis += 1) {
      const actualDelta = closedPoints[index][axis] - closedPoints[0][axis];
      const expectedDelta = expectedPoints[index][axis] - expectedPoints[0][axis];
      assert.ok(Math.abs(actualDelta - expectedDelta) < 1e-6, 'explicit closure preserves skewed wall geometry when the resized canvas recentres');
    }
  }
  await page.screenshot({ path: path.join(output, `no-magnet-${viewportWidth}.png`) });
  // Save to the isolated callback, not to application projects. Its image points
  // expose exact placement without reverse-projecting rounded CSS transforms.
  await controls.getByRole('button', { name: /^Добавить / }).tap();
  await page.waitForFunction(count => window.__traceResults.length === count, baseRooms + 1);
  const savedPoints = await page.evaluate(index => window.__traceResults[index].imgPts, baseRooms);
  for (let index = 0; index < rawPoints.length; index += 1) {
    for (let axis = 0; axis < 2; axis += 1) {
      assert.ok(Math.abs(savedPoints[index][axis] - rawPoints[index][axis]) < 0.001, 'saved placement preserves fractional source-image coordinates');
    }
  }
  assert.equal(await marker(page, 'A').count(), 0);
  if (!verifyLoupe) return;

  // Holding near a dark corner used to snap the loupe to image features.
  // Precision motion moves a virtual target slowly, without image-feature snapping.
  const imageAfter = await surface.locator('img').boundingBox();
  const screen = (x, y) => ({ x: imageAfter.x + x / 780 * imageAfter.width, y: imageAfter.y + y / 580 * imageAfter.height });
  const start = screen(60.25, 55.75), end = screen(106.75, 105.25);
  const cdp = await context.newCDPSession(page);
  await surface.evaluate(element => {
    window.__traceLastTouchMove = null;
    element.addEventListener('touchmove', event => {
      window.__traceLastTouchMove = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true, capture: true });
  });
  await page.waitForTimeout(550);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 0, radiusX: 1, radiusY: 1, force: 1 }] });
  await surface.locator('canvas').waitFor({ state: 'visible' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 0, radiusX: 1, radiusY: 1, force: 1 }] });
  await page.waitForFunction(({ x, y }) => window.__traceLastTouchMove && Math.abs(window.__traceLastTouchMove.x - x) < 0.01 && Math.abs(window.__traceLastTouchMove.y - y) < 0.01, end);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await marker(page, 'A').waitFor();
  const actual = await marker(page, 'A').boundingBox();
  const zoom = imageAfter.width / 780;
  const precisionRatio = zoom * 0.65 / Math.max(zoom * 2, 2);
  const expected = { x: start.x + (end.x - start.x) * precisionRatio, y: start.y + (end.y - start.y) * precisionRatio };
  if (Math.abs(actual.x + actual.width / 2 - expected.x) >= 0.75 || Math.abs(actual.y + actual.height / 2 - expected.y) >= 0.75) {
    console.log('Loupe placement debug:', { start, end, expected, actual });
    await page.screenshot({ path: path.join(output, `loupe-debug-${viewportWidth}.png`) });
  }
  assert.ok(Math.abs(actual.x + actual.width / 2 - expected.x) < 0.75, 'loupe placement commits the slower virtual X without corner snapping');
  assert.ok(Math.abs(actual.y + actual.height / 2 - expected.y) < 0.75, 'loupe placement commits the slower virtual Y without corner snapping');
  assert.equal(await controls.getByPlaceholder('длина в см', { exact: true }).count(), 0);
  await cdp.detach();
}

const marker = (page, letter) => page.locator(`.trace-current-geometry .trace-vertex[data-index="${letter.charCodeAt(0) - 65}"] circle.appearance-node`);

async function markerStyle(page, letter) {
  return marker(page, letter).evaluate(element => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height, radius: Number(element.getAttribute('r')), fill: style.fill, stroke: style.stroke };
  });
}

async function draftImagePoints(page) {
  return page.evaluate(() => {
    const contour = document.querySelector('.trace-active-contour');
    if (!contour) return [];
    const image = document.querySelector('.trace-canvas-surface img');
    const box = image.getBoundingClientRect();
    const scale = box.width / image.naturalWidth;
    const panX = Number.parseFloat(image.style.left), panY = Number.parseFloat(image.style.top);
    const points = contour.getAttribute('points').trim().split(/\s+/).map(point => {
      const [x, y] = point.split(',').map(Number);
      return [(x - panX) / scale, (y - panY) / scale];
    });
    if (contour.getAttribute('stroke-dasharray') === 'none') points.pop();
    return points;
  });
}

function assertPointsClose(actual, expected, message, tolerance = 0.002) {
  assert.equal(actual.length, expected.length, message + ': vertex count');
  actual.forEach((point, index) => point.forEach((coordinate, axis) => {
    assert.ok(Math.abs(coordinate - expected[index][axis]) < tolerance, `${message}: point ${index}, axis ${axis} (${coordinate} vs ${expected[index][axis]})`);
  }));
}

async function verifyOptionalOrthogonal(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTestPlan(page, { alignmentDefault: true });
  const controls = page.locator('.trace-canvas-controls');
  const undo = () => page.getByRole('button', { name: 'Отменить последнюю точку', exact: true }).tap();
  const setOrthogonal = async enabled => {
    await page.getByRole('button', { name: 'Вид', exact: true }).tap();
    await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).setChecked(enabled);
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  };
  const holdWithPreview = async (x, y, darkPreview, threshold) => {
    await page.waitForTimeout(550);
    const image = await page.locator('.trace-canvas-surface img').boundingBox();
    const finger = { x: image.x + x / 780 * image.width, y: image.y + y / 580 * image.height };
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...finger, id: 0, radiusX: 1, radiusY: 1, force: 1 }] });
    await page.locator('.trace-canvas-surface canvas').waitFor({ state: 'visible' });
    // This sample is on the source plan's top wall only when the loupe previews
    // the horizontal snap; a free endpoint 11 screen pixels away leaves it white.
    await page.waitForFunction(expectDark => {
      const canvas = document.querySelector('.trace-canvas-surface canvas');
      const pixel = canvas?.getContext('2d').getImageData(68, 83, 1, 1).data;
      return pixel?.[3] > 240 && (expectDark ? Math.max(pixel[0], pixel[1], pixel[2]) < 160 : Math.min(pixel[0], pixel[1], pixel[2]) > 220);
    }, darkPreview);
    await page.screenshot({ path: path.join(output, `orthogonal-preview-${threshold}-${viewport.width}.png`) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.locator('.trace-canvas-surface canvas').waitFor({ state: 'hidden' });
    await cdp.detach();
  };
  await page.getByRole('button', { name: 'Вид', exact: true }).tap();
  assert.equal(await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).isChecked(), true, 'a fresh trace starts with alignment enabled');
  const checkboxBounds = await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).boundingBox();
  const fitBounds = await page.getByRole('button', { name: 'Вписать в экран', exact: true }).boundingBox();
  const zoomBounds = await page.getByRole('button', { name: 'Уменьшить чертёж', exact: true }).boundingBox();
  assert.ok(checkboxBounds.y >= fitBounds.y + fitBounds.height - 1 && checkboxBounds.y < zoomBounds.y, 'angle alignment sits immediately below fit/100% and above zoom');
  await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  const initialFree = [[100.25, 100.5], [300.75, 120.25], [310.5, 305.75], [90.5, 280.25]];
  for (const [x, y] of initialFree) await tapImagePoint(page, x, y);
  assertPointsClose(await draftImagePoints(page), initialFree, 'default free drawing preserves each skewed point');
  await setOrthogonal(true);
  assertPointsClose(await draftImagePoints(page), initialFree, 'enabling right angles does not rewrite an existing draft');
  await tapImagePoint(page, initialFree[0][0], initialFree[0][1]);
  await controls.getByPlaceholder('длина в см', { exact: true }).waitFor();
  assertPointsClose(await draftImagePoints(page), initialFree, 'a mixed contour closes unchanged while the option stays enabled');
  await undo();
  assertPointsClose(await draftImagePoints(page), initialFree, 'undo reopens a mixed contour without changing any vertex');
  await setOrthogonal(false);
  assertPointsClose(await draftImagePoints(page), initialFree, 'disabling right angles does not rewrite an existing draft');
  for (let point = 0; point < 4; point += 1) await undo();

  await setOrthogonal(true);
  const imageScale = () => page.locator('.trace-canvas-surface img').evaluate(image => image.getBoundingClientRect().width / image.naturalWidth);
  const setZoom = async name => {
    await page.getByRole('button', { name: 'Вид', exact: true }).tap();
    await page.getByRole('button', { name, exact: true }).tap();
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  };
  const visibleStart = () => page.evaluate(() => {
    const image = document.querySelector('.trace-canvas-surface img');
    const imageBox = image.getBoundingClientRect();
    const surface = document.querySelector('.trace-canvas-surface').getBoundingClientRect();
    const scale = imageBox.width / image.naturalWidth;
    return [(surface.left + 50 - imageBox.left) / scale, (surface.top + surface.height * 0.45 - imageBox.top) / scale];
  });
  for (const zoomName of ['Вписать в экран', '100%']) {
    await setZoom(zoomName);
    const scale = await imageScale();
    for (const wallLength of [60, 180]) {
      const a = await visibleStart();
      await tapImagePoint(page, ...a);
      await tapImagePoint(page, a[0] + wallLength / scale, a[1] + 9 / scale);
      assertPointsClose(await draftImagePoints(page), [a, [a[0] + wallLength / scale, a[1]]], `9 screen pixels snap a ${wallLength}px first wall at ${zoomName}`);
      await undo();
      const outside = [a[0] + wallLength / scale, a[1] + 11 / scale];
      await tapImagePoint(page, ...outside);
      assertPointsClose(await draftImagePoints(page), [a, outside], `11 screen pixels remain free on a ${wallLength}px first wall at ${zoomName}`);
      await undo();
      await undo();
    }
    const a = await visibleStart();
    await tapImagePoint(page, ...a);
    const b = [a[0] + 80 / scale, a[1]];
    await tapImagePoint(page, ...b);
    await tapImagePoint(page, b[0] + 9 / scale, b[1] + 60 / scale);
    assertPointsClose(await draftImagePoints(page), [a, b, [b[0], b[1] + 60 / scale]], `the following perpendicular uses the same 9 screen pixel tolerance at ${zoomName}`);
    await undo();
    const outside = [b[0] + 11 / scale, b[1] + 60 / scale];
    await tapImagePoint(page, ...outside);
    assertPointsClose(await draftImagePoints(page), [a, b, outside], `the following perpendicular stays free at 11 screen pixels at ${zoomName}`);
    for (let point = 0; point < 3; point += 1) await undo();
  }

  await setZoom('Вписать в экран');
  const scale = await imageScale();
  await tapImagePoint(page, 100, 100);
  await holdWithPreview(160, 100 + 9 / scale, true, 'inside-9px');
  await tapImagePoint(page, 160 + 9 / scale, 160);
  await tapImagePoint(page, 106, 154);
  const square = [[100, 100], [160, 100], [160, 160], [100, 160]];
  assertPointsClose(await draftImagePoints(page), square, 'a final new corner near A joins the preceding perpendicular with the start guide');
  await page.getByRole('button', { name: 'Вид', exact: true }).tap();
  await page.screenshot({ path: path.join(output, `orthogonal-view-${viewport.width}.png`) });
  await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  await tapImagePoint(page, 100, 100);
  await controls.getByPlaceholder('длина в см', { exact: true }).waitFor();
  assertPointsClose(await draftImagePoints(page), square, 'closure preserves all placed square vertices');
  assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 4, 'calibration retains the closed contour vertices');
  await undo();
  assertPointsClose(await draftImagePoints(page), square, 'undo simply reopens the square without altering its last point');
  await tapImagePoint(page, 100, 100);
  await controls.getByPlaceholder('длина в см', { exact: true }).fill('500');
  assert.equal((await draftImagePoints(page)).length, 4, 'tapping A closes without appending a duplicate A');
  await controls.getByRole('button', { name: 'OK', exact: true }).tap();
  await page.getByRole('textbox', { name: 'Название помещения', exact: true }).fill('Прямые углы');
  await page.screenshot({ path: path.join(output, `orthogonal-closed-${viewport.width}.png`) });
  await controls.getByRole('button', { name: 'Добавить Прямые углы', exact: true }).tap();
  await page.waitForFunction(() => window.__traceResults.length === 1);
  const firstResult = await page.evaluate(() => window.__traceResults[0]);
  assert.equal(firstResult.area, 25, '500 cm orthogonal square produces 25 square metres');
  assert.equal(firstResult.perim, 20);
  assertPointsClose(firstResult.imgPts, square, 'saved orthogonal room preserves the closed rectangle');
  assert.equal(await page.locator('.trace-saved-geometry .trace-vertex').count(), 0, 'adding a room removes its calibration markers');
  const completedBeforeToggle = JSON.stringify(firstResult);
  await setOrthogonal(false);
  await setOrthogonal(true);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__traceResults[0])), completedBeforeToggle, 'the option never changes a completed room');

  await tapImagePoint(page, 430, 100);
  const outsideFirst = [630, 100 + 11 / scale];
  await holdWithPreview(outsideFirst[0], outsideFirst[1], false, 'outside-11px');
  assertPointsClose(await draftImagePoints(page), [[430, 100], outsideFirst], 'loupe preview and commit both leave an 11 screen pixel deviation free');
  await undo();
  await undo();

  for (const [x, y] of [[430, 100], [430, 160], [490, 160], [484, 106]]) await tapImagePoint(page, x, y);
  const reverseSquare = [[430, 100], [430, 160], [490, 160], [490, 100]];
  assertPointsClose(await draftImagePoints(page), reverseSquare, 'the guides through A also align the last new corner for the opposite winding');
  await undo();
  const jointTooFar = [490 - 8 / scale, 100 + 8 / scale];
  await tapImagePoint(page, ...jointTooFar);
  assertPointsClose(await draftImagePoints(page), [[430, 100], [430, 160], [490, 160], [490, jointTooFar[1]]], 'an intersection more than 10 screen pixels away keeps the eligible preceding perpendicular');
  await undo();
  const onlyStartGuide = [490 - 11 / scale, 100 + 9 / scale];
  await tapImagePoint(page, ...onlyStartGuide);
  assertPointsClose(await draftImagePoints(page), [[430, 100], [430, 160], [490, 160], [onlyStartGuide[0], 100]], 'a nearby guide through A can align a point when the preceding perpendicular is outside tolerance');
  await undo();
  const beforeOddClose = [[430, 100], [430, 160], [490, 160]];
  await tapImagePoint(page, 430, 100);
  await controls.getByRole('button', { name: /^Добавить / }).waitFor();
  assertPointsClose(await draftImagePoints(page), beforeOddClose, 'odd closure never inserts a synthetic corner or forces the closing diagonal');
  await undo();
  assertPointsClose(await draftImagePoints(page), beforeOddClose, 'undo restores the same three-vertex contour');
  for (let point = 0; point < 3; point += 1) await undo();

  for (const point of [[430, 100], [430, 300], [630, 300], [624, 106]]) await tapImagePoint(page, ...point);
  assertPointsClose(await draftImagePoints(page), [[430, 100], [430, 300], [630, 300], [630, 100]], 'a large valid contour aligns with the line through A even when A is far along that line');
  await undo();
  const outsideGuide = [624, 100 + 11 / scale];
  await tapImagePoint(page, ...outsideGuide);
  assertPointsClose(await draftImagePoints(page), [[430, 100], [430, 300], [630, 300], [630, outsideGuide[1]]], 'an endpoint 11 screen pixels from the line through A keeps the preceding perpendicular without start-guide attraction');
  for (let point = 0; point < 4; point += 1) await undo();
  const winding = [[100, 100], [180, 100], [180, 180], [100, 180], [100, 140], [140, 140]];
  for (const point of winding) await tapImagePoint(page, ...point);
  await tapImagePoint(page, 144, 104);
  assertPointsClose(await draftImagePoints(page), [...winding, [140, 104]], 'a nearby start-guide joint touching an earlier wall is rejected without changing existing vertices');
  await page.screenshot({ path: path.join(output, `orthogonal-guide-wall-rejection-${viewport.width}.png`) });
  for (let point = 0; point < 7; point += 1) await undo();

  await setOrthogonal(false);
  const freeAgain = [[430.25, 100.5], [630.75, 120.25], [620.5, 305.75], [420.5, 280.25]];
  for (const [x, y] of freeAgain) await tapImagePoint(page, x, y);
  assertPointsClose(await draftImagePoints(page), freeAgain, 'switching back to free drawing preserves fractional nonorthogonal placement');
  await tapImagePoint(page, freeAgain[0][0], freeAgain[0][1]);
  await controls.getByRole('button', { name: /^Добавить / }).waitFor();
  await page.getByRole('textbox', { name: 'Название помещения', exact: true }).fill('Свободный контур');
  await page.screenshot({ path: path.join(output, `orthogonal-free-${viewport.width}.png`) });
  await controls.getByRole('button', { name: 'Добавить Свободный контур', exact: true }).tap();
  await page.waitForFunction(() => window.__traceResults.length === 2);
  const freeResult = await page.evaluate(() => window.__traceResults[1]);
  assertPointsClose(freeResult.imgPts, freeAgain, 'the free room is saved without angle corrections');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__traceResults[0])), completedBeforeToggle);
  await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).tap();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore));
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`Screen-distance alignment and start guides passed at ${viewport.width} × ${viewport.height}`);
}

async function verifyLoupePrecision(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTestPlan(page, { alignmentDefault: true });
  await page.getByRole('button', { name: 'Вид', exact: true }).tap();
  assert.equal(await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).isChecked(), true, 'alignment is enabled in a fresh trace before the free-precision fixture disables it');
  await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  // Observe the source-image crop actually drawn in the loupe, without changing
  // handlers, timers or geometry. This proves preview and committed point agree.
  await page.evaluate(() => {
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (this.canvas.width === 160 && this.canvas.height === 160 && args.length === 9) {
        const [, sx, sy, sw, sh, dx, dy, dw, dh] = args;
        window.__precisionFrame = { x: sx + (80 - dx) * sw / dw, y: sy + (80 - dy) * sh / dh, mag: dw / sw };
      }
      return Reflect.apply(drawImage, this, args);
    };
    const surface = document.querySelector('.trace-canvas-surface');
    for (const type of ['mousedown', 'mousemove', 'touchstart', 'touchmove']) surface.addEventListener(type, event => {
      const pointer = event.touches?.[0] || event;
      const value = { x: pointer.clientX, y: pointer.clientY };
      if (type.endsWith('down') || type.endsWith('start')) window.__precisionStart = value;
      else if (event.touches?.length || event.buttons === 1) window.__precisionMove = value;
    }, { capture: true, passive: true });
  });
  const cdp = await context.newCDPSession(page);
  const surface = page.locator('.trace-canvas-surface');
  const canvas = surface.locator('canvas');
  const undo = () => page.getByRole('button', { name: 'Отменить последнюю точку', exact: true }).tap();
  const setZoom = async name => {
    await page.getByRole('button', { name: 'Вид', exact: true }).tap();
    await page.getByRole('button', { name, exact: true }).tap();
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  };
  const imageGeometry = () => surface.locator('img').evaluate(image => {
    const box = image.getBoundingClientRect();
    return { left: box.left, top: box.top, zoom: box.width / image.naturalWidth, camera: [image.style.left, image.style.top, image.style.transform] };
  });
  const markerImagePoint = async letter => {
    const box = await marker(page, letter).boundingBox();
    const image = await imageGeometry();
    return [(box.x + box.width / 2 - image.left) / image.zoom, (box.y + box.height / 2 - image.top) / image.zoom];
  };
  const begin = async (device, pointer) => {
    await page.waitForTimeout(550);
    await page.evaluate(() => { window.__precisionFrame = null; window.__precisionMove = null; });
    if (device === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...pointer, id: 0, radiusX: 1, radiusY: 1, force: 1 }] });
    else { await page.mouse.move(pointer.x, pointer.y); await page.mouse.down(); }
    await canvas.waitFor({ state: 'visible' });
    await page.waitForFunction(() => window.__precisionFrame);
    return page.evaluate(() => ({ start: window.__precisionStart, frame: window.__precisionFrame }));
  };
  const move = async (device, pointer) => {
    if (device === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...pointer, id: 0, radiusX: 1, radiusY: 1, force: 1 }] });
    else await page.mouse.move(pointer.x, pointer.y);
    await page.waitForFunction(({ x, y, tolerance }) => window.__precisionMove && Math.abs(window.__precisionMove.x - x) < tolerance && Math.abs(window.__precisionMove.y - y) < tolerance, { ...pointer, tolerance: device === 'mouse' ? 1 : 0.01 });
    return page.evaluate(() => window.__precisionMove);
  };
  const release = async device => {
    if (device === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await canvas.waitFor({ state: 'hidden' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const waitPreview = expected => page.waitForFunction(({ x, y }) => window.__precisionFrame && Math.abs(window.__precisionFrame.x - x) < 0.01 && Math.abs(window.__precisionFrame.y - y) < 0.01, expected);
  for (const zoomName of ['Вписать в экран', '100%']) {
    await setZoom(zoomName);
    for (const device of ['touch', 'mouse']) {
      const image = await imageGeometry();
      const box = await surface.boundingBox();
      const pointer = { x: box.x + 120, y: box.y + box.height * 0.4 };
      const { start, frame } = await begin(device, pointer);
      const anchor = { x: (start.x - image.left) / image.zoom, y: (start.y - image.top) / image.zoom };
      assert.ok(Math.abs(frame.x - anchor.x) < 0.002 && Math.abs(frame.y - anchor.y) < 0.002, `${device} activation has no jump and resets the previous precision target at ${zoomName}`);
      const movement = await move(device, { x: start.x + 64, y: start.y + 32 });
      const expected = { x: anchor.x + (movement.x - start.x) * 0.65 / frame.mag, y: anchor.y + (movement.y - start.y) * 0.65 / frame.mag };
      await waitPreview(expected);
      const rendered = await page.evaluate(() => window.__precisionFrame);
      assert.ok(Math.abs((rendered.x - anchor.x) * frame.mag - 64 * 0.65) < 0.01, 'the image in the loupe moves 65 percent of the finger distance');
      assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 0, 'holding and moving previews without placing a point');
      assert.deepEqual((await imageGeometry()).camera, image.camera, 'precision movement does not pan the main plan');
      await page.screenshot({ path: path.join(output, `loupe-precision-${device}-${zoomName === '100%' ? '100' : 'fit'}-${viewport.width}.png`) });
      await release(device);
      assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 1, `${device} release adds exactly one point`);
      assertPointsClose([await markerImagePoint('A')], [[expected.x, expected.y]], `${device} release commits the virtual target, not the final pointer at ${zoomName}`);
      await undo();
    }
  }
  // A normal tap still commits its exact raw coordinate after precision gestures.
  await setZoom('Вписать в экран');
  await tapImagePoint(page, 100.25, 100.5);
  assertPointsClose([await markerImagePoint('A')], [[100.25, 100.5]], 'normal taps do not inherit the slower cursor');
  await undo();
  // The native click after mouseup must not close A at the physical pointer.
  await setZoom('100%');
  const mouseImage = await imageGeometry();
  const mouseSurface = await surface.boundingBox();
  const a = [(mouseSurface.x + 90 - mouseImage.left) / mouseImage.zoom, (mouseSurface.y + mouseSurface.height * 0.25 - mouseImage.top) / mouseImage.zoom];
  const mouseDraft = [a, [a[0] + 150, a[1]], [a[0] + 150, a[1] + 150]];
  for (const point of mouseDraft) await tapImagePoint(page, ...point);
  const mouseStart = { x: mouseImage.left + (a[0] + 100) * mouseImage.zoom, y: mouseImage.top + (a[1] + 100) * mouseImage.zoom };
  const mouseEnd = { x: mouseImage.left + a[0] * mouseImage.zoom, y: mouseImage.top + a[1] * mouseImage.zoom };
  const mouseActivation = await begin('mouse', mouseStart);
  const mouseMovement = await move('mouse', mouseEnd);
  const virtual = [mouseActivation.frame.x + (mouseMovement.x - mouseActivation.start.x) * 0.65 / mouseActivation.frame.mag, mouseActivation.frame.y + (mouseMovement.y - mouseActivation.start.y) * 0.65 / mouseActivation.frame.mag];
  await waitPreview({ x: virtual[0], y: virtual[1] });
  await release('mouse');
  assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 4, 'mouse release at physical A appends exactly one virtual point');
  assert.match(await page.locator('.trace-active-contour').getAttribute('stroke-dasharray'), /8[, ]+4/, 'the follow-up native click does not accidentally close the contour');
  assertPointsClose(await draftImagePoints(page), [...mouseDraft, virtual], 'mouse release keeps the virtual target even when the physical pointer is on A');
  await page.waitForTimeout(550);
  const next = [a[0] + 40, a[1] + 140];
  await page.mouse.click(mouseImage.left + next[0] * mouseImage.zoom, mouseImage.top + next[1] * mouseImage.zoom);
  const nextMouse = await page.evaluate(() => window.__precisionStart);
  const nextPoint = [(nextMouse.x - mouseImage.left) / mouseImage.zoom, (nextMouse.y - mouseImage.top) / mouseImage.zoom];
  assertPointsClose(await draftImagePoints(page), [...mouseDraft, virtual, nextPoint], 'the next normal mouse click still places its exact point');
  await page.screenshot({ path: path.join(output, `loupe-mouse-physical-a-${viewport.width}.png`) });
  for (let point = 0; point < 5; point += 1) await undo();
  // Preview and release use the same existing alignment on the virtual target.
  await setZoom('Вписать в экран');
  await page.getByRole('button', { name: 'Вид', exact: true }).tap();
  await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).check();
  await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  await tapImagePoint(page, 100, 100);
  const image = await imageGeometry();
  const raw = { x: 300, y: 100 + 12 / image.zoom };
  const pointer = { x: image.left + raw.x * image.zoom, y: image.top + raw.y * image.zoom };
  const { start, frame } = await begin('touch', pointer);
  assert.ok(Math.abs(frame.y - raw.y) < 0.002, 'the initial target outside the 10px alignment tolerance remains free');
  await move('touch', { x: start.x, y: start.y - 64 });
  await waitPreview({ x: 300, y: 100 });
  await page.screenshot({ path: path.join(output, `loupe-aligned-preview-${viewport.width}.png`) });
  await release('touch');
  assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 2);
  assertPointsClose(await draftImagePoints(page), [[100, 100], [300, 100]], 'alignment previews and commits the same slowed virtual target');
  await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).tap();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore));
  assert.deepEqual(errors, []);
  await cdp.detach();
  await context.close();
  console.log(`Touch and mouse precision loupe passed at ${viewport.width} × ${viewport.height}`);
}

async function verifyFractionalCalibration(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTestPlan(page);
  const controls = page.locator('.trace-canvas-controls');
  for (const point of [[100, 100], [300, 100], [300, 300], [100, 300]]) await tapImagePoint(page, ...point);
  await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
  const length = controls.getByPlaceholder('длина в см', { exact: true });
  await length.fill('465,6');
  assert.equal(await length.inputValue(), '465,6', 'the centimetre input accepts a comma decimal without truncation');
  await controls.getByRole('button', { name: 'OK', exact: true }).tap();
  const assertLabels = async selector => assert.deepEqual(await page.locator(`${selector} .trace-dimension .appearance-label`).allTextContents(), ['465,6', '465,6', '465,6', '465,6'], 'wall labels preserve decimal centimetres rather than rounding to integers');
  await assertLabels('.trace-current-geometry');
  await controls.getByText(/^AB:\s*465,6\s*см$/).waitFor();
  await controls.getByRole('button', { name: 'Изменить размер', exact: true }).tap();
  assert.equal(await length.inputValue(), '465,6', 'returning to calibration preserves the entered decimal');
  await controls.getByRole('button', { name: 'OK', exact: true }).tap();
  await page.getByRole('textbox', { name: 'Название помещения', exact: true }).fill('Дробный размер');
  await page.screenshot({ path: path.join(output, `fractional-calibration-${viewport.width}.png`) });
  await controls.getByRole('button', { name: 'Добавить Дробный размер', exact: true }).tap();
  await page.waitForFunction(() => window.__traceResults.length === 1);
  const result = await page.evaluate(() => window.__traceResults[0]);
  assertPointsClose(result.verts, [[0, 0], [4.656, 0], [4.656, 4.656], [0, 4.656]], 'the saved room retains the real 4.656 metre side instead of 4.66 or 4.65', 1e-10);
  await assertLabels('.trace-saved-geometry');
  await page.screenshot({ path: path.join(output, `fractional-saved-${viewport.width}.png`) });

  for (const point of [[430, 100], [630, 100], [630, 300], [430, 300]]) await tapImagePoint(page, ...point);
  await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
  await controls.getByRole('button', { name: /^Добавить / }).waitFor();
  assert.equal(await length.count(), 0, 'the next room inherits the fractional calibration without asking for a rounded length');
  await assertLabels('.trace-current-geometry');
  await page.getByRole('button', { name: 'Отменить последнюю точку', exact: true }).tap();
  await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
  await controls.getByRole('button', { name: /^Добавить / }).waitFor();
  await assertLabels('.trace-current-geometry');
  await page.screenshot({ path: path.join(output, `fractional-inherited-${viewport.width}.png`) });
  await controls.getByRole('button', { name: /^Добавить / }).tap();
  await page.waitForFunction(() => window.__traceResults.length === 2);
  assert.deepEqual(await page.evaluate(() => window.__traceResults[1].verts), result.verts, 'saving another room after reopening keeps the same fractional scale');
  assert.deepEqual(await page.evaluate(() => window.__traceResults[0].verts), result.verts, 'later rooms do not rewrite the first saved fractional side');
  await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).tap();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore));
  // Coordinate rounding can hide on axis-aligned walls. A slanted side exposes
  // a change from 465.6 cm to 465.5 cm after saving, even with correct input.
  await openTestPlan(page);
  for (const point of [[100, 150], [200, 350], [400, 250], [300, 50]]) await tapImagePoint(page, ...point);
  await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
  await length.fill('465,6');
  await controls.getByRole('button', { name: 'OK', exact: true }).tap();
  await assertLabels('.trace-current-geometry');
  await controls.getByRole('button', { name: /^Добавить / }).tap();
  await page.waitForFunction(() => window.__traceResults.length === 1);
  const slanted = await page.evaluate(() => window.__traceResults[0]);
  assert.ok(Math.abs(Math.hypot(slanted.verts[1][0] - slanted.verts[0][0], slanted.verts[1][1] - slanted.verts[0][1]) - 4.656) < 1e-10, 'the saved slanted side preserves all entered tenths of a centimetre');
  await assertLabels('.trace-saved-geometry');
  await page.screenshot({ path: path.join(output, `fractional-slanted-saved-${viewport.width}.png`) });
  await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).tap();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore));
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`Fractional 465,6 cm calibration passed at ${viewport.width} × ${viewport.height}`);
}

async function verifySheetRecalibration(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTestPlan(page);
  const controls = page.locator('.trace-canvas-controls');
  const length = controls.getByPlaceholder('длина в см', { exact: true });
  const draw = async points => {
    for (const point of points) await tapImagePoint(page, ...point);
    await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
  };
  const save = () => controls.getByRole('button', { name: /^Добавить / }).tap();
  await draw([[100, 100], [300, 100], [300, 300], [100, 300]]);
  await length.fill('465,6');
  await controls.getByRole('button', { name: 'OK', exact: true }).tap();
  await save();
  await draw([[430, 100], [630, 100], [630, 300], [430, 300]]);
  await save();
  await page.waitForFunction(() => window.__traceResults.length === 2);
  const original = await page.evaluate(() => structuredClone(window.__traceResults));
  const originalSources = original.map(room => room.imgPts);
  const originalIds = original.map(room => room.traceId);
  assert.equal(new Set(originalIds).size, 2);

  await draw([[100, 360], [300, 360], [300, 540], [100, 540]]);
  const draftBefore = await draftImagePoints(page);
  const savedImagePoints = () => page.locator('.trace-completed-room polygon').evaluateAll(elements => {
    const image = document.querySelector('.trace-canvas-surface img');
    const scale = image.getBoundingClientRect().width / image.naturalWidth;
    const panX = Number.parseFloat(image.style.left), panY = Number.parseFloat(image.style.top);
    return elements.map(element => element.getAttribute('points').trim().split(/\s+/).map(point => {
      const [x, y] = point.split(',').map(Number);
      return [(x - panX) / scale, (y - panY) / scale];
    }));
  });
  const savedBefore = await savedImagePoints();
  const edit = controls.getByRole('button', { name: 'Изменить масштаб', exact: true });
  await edit.tap();
  await controls.getByText('Новый размер пересчитает все обведённые помещения этого листа.', { exact: true }).waitFor();
  assert.equal(await length.inputValue(), '465,6', 'recalibration starts from the accepted fractional length');
  await length.fill('900');
  await controls.getByRole('button', { name: 'Отмена', exact: true }).tap();
  assert.equal(await page.evaluate(() => window.__traceRoomUpdates.length), 0, 'cancel never changes saved rooms');
  await controls.getByText(/^AB:\s*465,6\s*см$/).waitFor();
  await edit.tap();
  await length.fill('0');
  assert.equal(await controls.getByRole('button', { name: 'OK', exact: true }).isDisabled(), true, 'zero calibration cannot be confirmed');
  await length.press('Enter');
  assert.equal(await page.evaluate(() => window.__traceRoomUpdates.length), 0, 'invalid Enter cannot recalibrate a sheet');
  await length.fill('500');
  await page.screenshot({ path: path.join(output, `recalibration-edit-${viewport.width}.png`) });
  await controls.getByRole('button', { name: 'OK', exact: true }).tap();
  await page.waitForFunction(() => window.__traceRoomUpdates.length === 1);
  const updated = await page.evaluate(() => window.__traceRoomUpdates[0]);
  assert.equal(await page.evaluate(() => window.__traceResults.length), 2, 'changing scale updates rooms without appending a new room');
  assert.deepEqual(updated.map(room => room.traceId), originalIds, 'recalibration retains stable room identities');
  assert.deepEqual(updated.map(room => room.imgPts), originalSources, 'recalibration never moves original image contours');
  for (const room of updated) {
    assert.deepEqual(room.verts, [[0, 0], [5, 0], [5, 5], [0, 5]]);
    assert.equal(room.area, 25, 'existing room areas follow the confirmed scale');
    assert.equal(room.perim, 20, 'existing room perimeters follow the confirmed scale');
  }
  assertPointsClose(await draftImagePoints(page), draftBefore, 'the current image contour is unchanged');
  // Controls change the available canvas height, so the camera may recenter.
  // Compare placement on the source PDF, independently of that screen pan.
  const savedAfter = await savedImagePoints();
  savedAfter.forEach((points, index) => assertPointsClose(points, savedBefore[index], 'accepted scale changes measurements, not PDF placement', 1e-8));
  assert.deepEqual(await page.locator('.trace-saved-geometry .trace-dimension .appearance-label').allTextContents(), Array(8).fill('500'), 'saved SVG dimensions update immediately before adding the current room');
  await page.screenshot({ path: path.join(output, `recalibration-applied-${viewport.width}.png`) });

  await save();
  await page.waitForFunction(() => window.__traceResults.length === 3);
  const third = await page.evaluate(() => window.__traceResults[2]);
  assert.deepEqual(third.verts, [[0, 0], [5, 0], [5, 4.5], [0, 4.5]], 'subsequent saved rooms inherit the new scale');
  await draw([[430, 360], [630, 360], [630, 540], [430, 540]]);
  await controls.getByText(/^AB:\s*500\s*см$/).waitFor();
  await edit.tap();
  await length.fill('465,6');
  await length.press('Enter');
  await page.waitForFunction(() => window.__traceRoomUpdates.length === 2);
  const restored = await page.evaluate(() => window.__traceRoomUpdates[1]);
  assert.equal(restored.length, 3);
  assert.deepEqual(restored.slice(0, 2).map(room => room.verts), original.map(room => room.verts), 'returning to the original scale does not accumulate rounding drift');
  assert.deepEqual(restored.map(room => room.traceId), [...originalIds, third.traceId]);
  assert.equal(await page.evaluate(() => window.__traceResults.length), 3, 'Enter recalibrates once and never adds the current draft');
  await controls.getByText(/^AB:\s*465,6\s*см$/).waitFor();
  await page.screenshot({ path: path.join(output, `recalibration-restored-${viewport.width}.png`) });
  await fs.writeFile(path.join(output, `recalibration-values-${viewport.width}.json`), JSON.stringify({ original, updated, restored }, null, 2));
  await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).tap();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore), 'isolated trace callbacks never modify user projects');
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`Whole-sheet recalibration passed at ${viewport.width} × ${viewport.height}`);
}

async function captureCurrentAngleMenu(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openTestPlan(page);
  await page.getByRole('button', { name: 'Вид', exact: true }).tap();
  await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).check();
  await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  for (const [x, y] of [[100, 100], [300, 120], [320, 300], [100, 280]]) await tapImagePoint(page, x, y);
  await page.getByRole('button', { name: 'Вид', exact: true }).tap();
  await page.getByText('Привязка к 90°', { exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Выравнивать углы', exact: true }).isChecked(), true);
  await page.screenshot({ path: path.join(output, `orthogonal-view-${viewport.width}.png`) });
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore));
  await context.close();
  console.log(`Current angle menu captured at ${viewport.width} × ${viewport.height}`);
}

async function assertContained(page) {
  const layout = await page.evaluate(() => {
    const shell = document.querySelector('.z-trace-shell').getBoundingClientRect();
    const surface = document.querySelector('.trace-canvas-surface').getBoundingClientRect();
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      shell: { left: shell.left, right: shell.right },
      surface: { width: surface.width, height: surface.height },
    };
  });
  assert.ok(layout.documentWidth <= layout.viewport + 1, 'mobile page must not scroll horizontally');
  assert.ok(layout.shell.left >= -1 && layout.shell.right <= layout.viewport + 1, 'trace shell fits the phone');
  assert.ok(layout.surface.width >= 300 && layout.surface.height >= 160, 'the plan keeps a usable drawing surface');
}

async function assertCompletedLabelContained(page, index = 0) {
  const geometry = await page.locator('.trace-completed-room').nth(index).evaluate(room => {
    const polygon = room.querySelector('polygon');
    const transform = polygon.getScreenCTM();
    const points = [...polygon.points].map(point => {
      const screen = new DOMPoint(point.x, point.y).matrixTransform(transform);
      return [screen.x, screen.y];
    });
    const label = room.querySelector('.trace-room-label');
    const texts = [...label.querySelectorAll('text')].map(text => {
      const box = text.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
    const dimensions = [...room.querySelectorAll('.trace-dimension rect')].map(rect => {
      const box = rect.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
    return {
      points, texts, dimensions, rectangles: label.querySelectorAll('rect').length,
    };
  });
  const inside = ([x, y]) => {
    let result = false;
    for (let i = 0, j = geometry.points.length - 1; i < geometry.points.length; j = i++) {
      const [ax, ay] = geometry.points[i], [bx, by] = geometry.points[j];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) result = !result;
    }
    return result;
  };
  assert.equal(geometry.rectangles, 0, 'room names are direct text rather than white cards');
  for (const label of geometry.texts) {
    const centerX = (label.left + label.right) / 2, centerY = (label.top + label.bottom) / 2;
    for (const point of [[label.left, label.top], [label.right, label.top], [label.right, label.bottom], [label.left, label.bottom], [centerX, centerY], [centerX, label.top], [centerX, label.bottom], [label.left, centerY], [label.right, centerY]]) {
      assert.ok(inside(point), 'visible name and area stay inside the actual room polygon, including concave rooms');
    }
    for (const dimension of geometry.dimensions) {
      const overlaps = label.left < dimension.right && label.right > dimension.left
        && label.top < dimension.bottom && label.bottom > dimension.top;
      assert.equal(overlaps, false, `room ${index} text ${JSON.stringify(label)} does not overlap side dimension ${JSON.stringify(dimension)}`);
    }
  }
}

async function verifyFullRoomLabels(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTestPlan(page, { width: 1000, height: 800, busy: true });
  const controls = page.locator('.trace-canvas-controls');
  for (let index = 0; index < namedPlanRooms.length; index += 1) {
    const room = namedPlanRooms[index];
    for (const [x, y] of room.points) await tapImagePoint(page, x, y);
    await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
    const scaleInput = controls.getByPlaceholder('длина в см', { exact: true });
    if (await scaleInput.isVisible()) {
      await scaleInput.fill('500');
      await controls.getByRole('button', { name: 'OK', exact: true }).tap();
    }
    await page.getByRole('textbox', { name: 'Название помещения', exact: true }).fill(room.name);
    await controls.getByRole('button', { name: `Добавить ${room.name}`, exact: true }).tap();
    await page.waitForFunction(count => window.__traceResults.length === count, index + 1);
  }
  await page.waitForFunction(() => document.querySelectorAll('.trace-room-label').length === 3);
  for (let index = 0; index < namedPlanRooms.length; index += 1) {
    const name = namedPlanRooms[index].name;
    const label = page.locator('.trace-completed-room').nth(index).locator('.trace-room-label');
    const rendered = (await label.locator('.trace-room-name').allTextContents()).join('').replace(/\s+/g, '');
    assert.equal(rendered, name, `the complete visible name ${name} is not truncated`);
    assert.doesNotMatch(rendered, /…|\.\.\./);
    assert.match(await label.locator('title').textContent(), new RegExp(name));
    await assertCompletedLabelContained(page, index);
  }
  const corridor = await page.locator('.trace-completed-room').nth(2).locator('polygon').getAttribute('points');
  const vertices = corridor.trim().split(/\s+/).map(point => point.split(',').map(Number));
  const average = vertices.reduce((sum, [x, y]) => [sum[0] + x / vertices.length, sum[1] + y / vertices.length], [0, 0]);
  assert.ok(average[0] > vertices[1][0] && average[1] < vertices[2][1], 'corridor fixture deliberately puts the naive vertex centre in its concave cutout');
  const captionMetrics = () => page.locator('.trace-completed-room').evaluateAll(rooms => rooms.map(room => {
    const label = room.querySelector('.trace-room-label');
    return {
      name: [...label.querySelectorAll('.trace-room-name')].map(text => text.textContent).join('').replace(/\s+/g, ''),
      nameSize: Number.parseFloat(getComputedStyle(label.querySelector('.trace-room-name')).fontSize),
      areaSize: Number.parseFloat(getComputedStyle(label.querySelector('.trace-room-area')).fontSize),
      textScales: [...label.querySelectorAll('text')].map(text => {
        const transform = text.getScreenCTM();
        return { x: Math.hypot(transform.a, transform.b), y: Math.hypot(transform.c, transform.d), textLength: text.getAttribute('textLength') };
      }),
    };
  }));
  const normalCaptions = await captionMetrics();
  const sourceRooms = await page.evaluate(() => JSON.stringify(window.__traceResults));
  await assertContained(page);
  await page.screenshot({ path: path.join(output, `labels-busy-${viewport.width}.png`) });
  assert.equal(await page.locator('.trace-saved-geometry .trace-vertex').count(), 0, 'saved rooms have no vertex circles or letters');
  await page.getByRole('button', { name: 'Вид', exact: true }).tap();
  for (let step = 0; step < 4; step += 1) await page.getByRole('button', { name: 'Уменьшить чертёж', exact: true }).tap();
  assert.equal(await page.locator('.trace-saved-geometry .appearance-node').count(), 0, 'distant saved rooms retain clean contours without circles');
  assert.equal(await page.locator('.trace-saved-geometry .appearance-vertex-label').count(), 0, 'saved room vertex letters are absent at every zoom');
  assert.equal(await page.locator('.trace-canvas-surface img').evaluate(element => getComputedStyle(element).opacity), '0.75', 'zoom never fades the underlying plan');
  await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  assert.equal(await page.locator('.trace-room-label').count(), namedPlanRooms.length, 'distant zoom retains every room caption instead of hiding small rooms');
  const overviewCaptions = await captionMetrics();
  await page.screenshot({ path: path.join(output, `labels-overview-${viewport.width}.png`) });
  await fs.writeFile(path.join(output, `labels-sizes-${viewport.width}.json`), JSON.stringify({ normal: normalCaptions, overview: overviewCaptions }, null, 2));
  for (let index = 0; index < namedPlanRooms.length; index += 1) {
    const caption = overviewCaptions[index];
    assert.equal(caption.name, namedPlanRooms[index].name, 'overview captions preserve the complete visible room name');
    assert.doesNotMatch(caption.name, /…|\.\.\./);
    assert.ok(caption.nameSize > 0 && caption.nameSize < normalCaptions[index].nameSize, 'small overview rooms reduce the name font to fit');
    assert.ok(caption.areaSize > 0 && caption.areaSize < normalCaptions[index].areaSize, 'small overview rooms reduce the area font to fit');
    for (const scale of caption.textScales) {
      assert.ok(Math.abs(scale.x - scale.y) < 1e-6, 'overview text scales equally in both directions without distortion');
      assert.equal(scale.textLength, null, 'overview captions use smaller type instead of forced horizontal compression');
    }
    await assertCompletedLabelContained(page, index);
  }
  assert.equal(await page.evaluate(() => JSON.stringify(window.__traceResults)), sourceRooms, 'adapting caption sizes never changes source room geometry');
  const overviewChrome = await page.evaluate(() => ({
    header: document.querySelector('.z-trace-header').getBoundingClientRect().toJSON(),
    footer: document.querySelector('.z-trace-footer').getBoundingClientRect().toJSON(),
    shell: document.querySelector('.z-trace-shell').getBoundingClientRect().toJSON(),
    viewport: { width: innerWidth, height: innerHeight, scale: visualViewport?.scale, offsetTop: visualViewport?.offsetTop, offsetLeft: visualViewport?.offsetLeft },
    scroll: { x: scrollX, y: scrollY },
  }));
  await fs.writeFile(path.join(output, `labels-overview-layout-${viewport.width}.json`), JSON.stringify(overviewChrome, null, 2));
  for (const [name, bounds] of Object.entries({ header: overviewChrome.header, footer: overviewChrome.footer })) {
    assert.ok(bounds.top >= -1 && bounds.bottom <= viewport.height + 1, `${name} stays fully visible after distant zoom`);
    assert.ok(bounds.left >= -1 && bounds.right <= viewport.width + 1, `${name} stays within the phone width after distant zoom`);
  }
  await page.getByRole('button', { name: 'Вид', exact: true }).tap();
  await page.getByRole('button', { name: 'Вписать в экран', exact: true }).tap();
  await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).tap();
  assert.equal(await page.locator('.trace-saved-geometry .trace-vertex').count(), 0, 'zooming back does not restore saved-room vertex markers');
  assert.equal(await page.locator('.trace-room-label').count(), 3, 'full room captions return at a readable zoom');
  const restoredCaptions = await captionMetrics();
  restoredCaptions.forEach((caption, index) => {
    assert.ok(Math.abs(caption.nameSize - normalCaptions[index].nameSize) < 0.001, 'zooming back restores normal name sizing');
    assert.ok(Math.abs(caption.areaSize - normalCaptions[index].areaSize) < 0.001, 'zooming back restores normal area sizing');
  });
  await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).tap();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore));
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`Full room labels on a busy concave plan passed at ${viewport.width} × ${viewport.height}`);
}

async function verifyPdfPicker(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.MagicTrace?.open === 'function' && Array.isArray(window.__zamer?.state.projects));
  await page.evaluate(() => {
    window.__traceProjectBefore = JSON.stringify(window.__zamer.state.projects);
    window.__pdfPageRenders = [];
    // Keep the parser deterministic/offline. This exercises the real picker,
    // preview rendering calls, page selection and tracing handoff, not a mock UI.
    window.pdfjsLib = {
      GlobalWorkerOptions: { workerSrc: 'local-test-parser' },
      getDocument: () => ({ promise: Promise.resolve({
        numPages: 70,
        getPage: async number => ({
          getViewport: ({ scale }) => ({ width: 780 * scale, height: 580 * scale, scale }),
          render: ({ canvasContext, viewport: pageViewport }) => {
            window.__pdfPageRenders.push({ number, scale: pageViewport.scale });
            canvasContext.fillStyle = '#fff';
            canvasContext.fillRect(0, 0, pageViewport.width, pageViewport.height);
            canvasContext.fillStyle = '#36475d';
            canvasContext.font = `${32 * pageViewport.scale}px sans-serif`;
            canvasContext.fillText(`PDF PAGE ${number}`, 40 * pageViewport.scale, 80 * pageViewport.scale);
            return { promise: Promise.resolve() };
          },
        }),
      }) }),
    };
    let handle;
    handle = window.MagicTrace.open({
      file: new File(['%PDF-1.4 local synthetic parser fixture'], 'trace-70-pages.pdf', { type: 'application/pdf' }),
      onRoom: () => {},
      onDone: () => handle.close(),
    });
    window.__traceTestHandle = handle;
  });
  const strip = page.locator('.trace-page-strip');
  await strip.waitFor();
  assert.equal(await strip.getByRole('button').count(), 70, 'every PDF page is offered, not just the first group');
  const first = page.getByRole('button', { name: 'Лист 1', exact: true });
  const last = page.getByRole('button', { name: 'Лист 70', exact: true });
  await first.tap();
  await page.getByText('Лист 1 выбран', { exact: true }).waitFor();
  assert.equal(await first.getAttribute('aria-pressed'), 'true');

  const cdp = await context.newCDPSession(page);
  const swipe = async direction => {
    const box = await strip.boundingBox();
    const from = { x: direction === 'left' ? box.x + box.width - 24 : box.x + 24, y: box.y + box.height / 2 };
    const to = { x: direction === 'left' ? box.x + 24 : box.x + box.width - 24, y: from.y };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 0, radiusX: 1, radiusY: 1, force: 1 }] });
    for (let step = 1; step <= 8; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 8, y: from.y, id: 0, radiusX: 1, radiusY: 1, force: 1 }] });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(120);
  };
  const startScroll = await strip.evaluate(element => element.scrollLeft);
  await swipe('left');
  assert.ok(await strip.evaluate(element => element.scrollLeft) > startScroll + 10, 'a leftward finger swipe moves the horizontal PDF page strip');
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const visible = await last.evaluate(element => {
      const item = element.getBoundingClientRect(), container = element.closest('.trace-page-strip').getBoundingClientRect();
      return item.left >= container.left - 1 && item.right <= container.right + 1;
    });
    if (visible) break;
    await swipe('left');
  }
  const lastBox = await last.boundingBox(), stripBox = await strip.boundingBox();
  assert.ok(lastBox.x >= stripBox.x - 1 && lastBox.x + lastBox.width <= stripBox.x + stripBox.width + 1, 'page 70 is reachable by horizontal swiping');
  await last.tap();
  await page.getByText('Лист 70 выбран', { exact: true }).waitFor();
  assert.equal(await last.getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => window.__pdfPageRenders.some(render => render.number === 70 && render.scale === 0.6));
  const beforeReverse = await strip.evaluate(element => element.scrollLeft);
  await swipe('right');
  assert.ok(await strip.evaluate(element => element.scrollLeft) < beforeReverse - 10, 'a rightward finger swipe moves back through the page list');
  await last.tap();
  const confirm = page.getByRole('button', { name: 'Выбрать лист 70 →', exact: true });
  const confirmBox = await confirm.boundingBox();
  const contentBox = await page.locator('.trace-page-content').boundingBox();
  assert.ok(stripBox.y >= contentBox.y + contentBox.height - 1, 'the horizontal page list sits below the preview');
  assert.ok(confirmBox.y >= 0 && confirmBox.y + confirmBox.height <= viewport.height + 1, 'selection confirmation stays visible above the phone bottom');
  assert.ok(stripBox.y + stripBox.height < confirmBox.y, 'the footer cannot cover the horizontal page list');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'PDF picker has no horizontal page overflow');
  await page.screenshot({ path: path.join(output, `pdf-picker-70-${viewport.width}.png`) });
  await confirm.tap();
  await page.locator('.trace-canvas-surface img').waitFor();
  assert.ok(await page.evaluate(() => window.__pdfPageRenders.some(render => render.number === 70 && render.scale === 3)), 'confirm renders the selected final page, not page one');
  await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).tap();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore));
  assert.deepEqual(errors, []);
  await cdp.detach();
  await context.close();
  console.log(`70-page mobile PDF picker passed at ${viewport.width} × ${viewport.height}`);
}

try {
  if (mode === 'workflow' || mode === 'all') for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openTestPlan(page);
    await assertContained(page);
    assert.equal(await page.locator('.trace-canvas-surface img').evaluate(element => getComputedStyle(element).opacity), '0.75', 'the original plan retains its default visibility');
    for (const [x, y] of [[100, 100], [300, 100], [300, 300], [100, 300]]) {
      await tapImagePoint(page, x, y);
    }
    assert.equal(await marker(page, 'D').count(), 1, 'each tap creates exactly one vertex');
    const first = await markerStyle(page, 'A');
    const second = await markerStyle(page, 'B');
    assert.equal(first.fill, 'rgb(20, 97, 238)', 'the explicit closure point uses the manual builder selection accent');
    assert.equal(first.radius, 4.2);
    assert.equal(second.fill, 'rgb(255, 255, 255)', 'regular vertices use the manual builder paper fill');
    assert.equal(second.stroke, 'rgb(53, 111, 192)', 'regular vertices use the blue tracing outline');
    assert.equal(second.radius, 3);
    assert.ok(Math.abs(first.width - first.height) < 0.01, 'vertex markers are round, allowing subpixel browser rounding');
    const contour = page.locator('.trace-active-contour');
    assert.equal(await contour.getAttribute('fill'), 'none');
    assert.equal(await contour.evaluate(element => getComputedStyle(element).stroke), 'rgb(53, 111, 192)');
    assert.equal(await contour.getAttribute('stroke-width'), '1.6');
    assert.match(await contour.getAttribute('stroke-dasharray'), /8[, ]+4/);
    await page.screenshot({ path: path.join(output, `open-${viewport.width}.png`) });

    const draftGeometry = await contour.getAttribute('points');
    await page.getByRole('button', { name: 'Вид', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: 'Точки контура', exact: true }).count(), 0, 'the removed point-visibility option is not offered');
    assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 4, 'open drawing keeps its editable vertex markers');
    const opacity = page.getByRole('slider', { name: 'Видимость плана', exact: true });
    await opacity.press('Home');
    for (let step = 0; step < 5; step += 1) await opacity.press('ArrowRight');
    assert.equal(await opacity.inputValue(), '25');
    assert.equal(await page.locator('.trace-canvas-surface img').evaluate(image => getComputedStyle(image).opacity), '0.25');
    assert.equal(await contour.getAttribute('points'), draftGeometry, 'plan opacity preserves draft coordinates');
    await opacity.press('End');
    assert.equal(await opacity.inputValue(), '100');
    await assertContained(page);
    await page.screenshot({ path: path.join(output, `view-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).click();

    // Undo removes the last vertex; replacing it does not change the other ones.
    await page.locator('.trace-canvas-toolbar').getByRole('button', { name: 'Отменить последнюю точку', exact: true }).click();
    assert.equal(await marker(page, 'D').count(), 0);
    assert.equal(await marker(page, 'C').count(), 1);
    await tapImagePoint(page, 100, 300);

    // The marker size is measured in screen pixels, independent of plan zoom.
    const beforeZoom = await markerStyle(page, 'B');
    await page.getByRole('button', { name: 'Вид', exact: true }).click();
    await page.getByRole('button', { name: '100%', exact: true }).click();
    const afterZoom = await markerStyle(page, 'B');
    assert.ok(Math.abs(afterZoom.width - beforeZoom.width) < 0.01);
    assert.ok(Math.abs(afterZoom.height - beforeZoom.height) < 0.01);
    await page.getByRole('button', { name: 'Вписать в экран', exact: true }).click();
    for (let step = 0; step < 2; step += 1) await page.getByRole('button', { name: 'Уменьшить чертёж', exact: true }).click();
    assert.ok((await markerStyle(page, 'B')).radius < beforeZoom.radius, 'distant draft vertices shrink instead of crowding the plan');
    const draftLetters = await page.locator('.trace-current-geometry .trace-vertex[data-index="1"] .appearance-vertex-label').evaluateAll(elements => elements.filter(element => getComputedStyle(element).display !== 'none').length);
    assert.equal(draftLetters, 0, 'unselected letters hide at an overview zoom');
    assert.equal(await page.locator('.trace-current-geometry .trace-vertex[data-index="0"] .appearance-vertex-label').evaluateAll(elements => elements.filter(element => getComputedStyle(element).display !== 'none').length), 1, 'the draft start A stays identifiable');
    assert.equal(await page.locator('.trace-canvas-surface img').evaluate(element => getComputedStyle(element).opacity), '1', 'user-selected plan visibility persists through zoom and redraw');
    await page.getByRole('button', { name: 'Вписать в экран', exact: true }).click();
    assert.equal((await markerStyle(page, 'B')).radius, beforeZoom.radius, 'zooming back restores vertex size');
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).click();

    // A canvas can briefly collapse during viewport/keyboard transitions.
    // View controls must not poison the camera with an invalid scale or pan.
    const beforeCollapse = await contour.getAttribute('points');
    await page.getByRole('button', { name: 'Вид', exact: true }).click();
    const surface = page.locator('.trace-canvas-surface');
    const originalStyle = await surface.getAttribute('style');
    await surface.evaluate(element => {
      element.style.flex = 'none';
      element.style.height = '0px';
    });
    await page.waitForFunction(() => document.querySelector('.trace-canvas-surface').getBoundingClientRect().height === 0);
    await page.getByRole('button', { name: 'Вписать в экран', exact: true }).click();
    await page.getByRole('button', { name: 'Увеличить чертёж', exact: true }).click();
    await surface.evaluate((element, style) => element.setAttribute('style', style), originalStyle);
    await page.waitForFunction(() => document.querySelector('.trace-canvas-surface').getBoundingClientRect().height > 0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const camera = await page.locator('.trace-canvas-surface img').evaluate(image => ({
      transform: image.style.transform, left: Number.parseFloat(image.style.left), top: Number.parseFloat(image.style.top),
    }));
    assert.ok(!/NaN|Infinity/.test(camera.transform) && Number.isFinite(camera.left) && Number.isFinite(camera.top), 'camera remains finite after a collapsed canvas');
    assert.equal(await contour.getAttribute('points'), beforeCollapse, 'collapsed view controls preserve the restored draft geometry');
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).click();

    await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
    await page.getByPlaceholder('длина в см', { exact: true }).waitFor();
    assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 4, 'closed unsaved contours retain vertices for selecting the known side');
    const closedLetters = page.locator('.trace-current-geometry .trace-vertex .appearance-vertex-label');
    assert.deepEqual(await closedLetters.allTextContents(), ['A', 'B', 'C', 'D'], 'calibration keeps each side identifiable by its endpoint letters');
    assert.equal(await closedLetters.evaluateAll(elements => elements.filter(element => getComputedStyle(element).display !== 'none').length), 4);
    await page.screenshot({ path: path.join(output, `closed-calibration-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Отменить последнюю точку', exact: true }).tap();
    await marker(page, 'A').waitFor();
    assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 4, 'undo reopens the contour and keeps its editable markers');
    await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
    await page.getByPlaceholder('длина в см', { exact: true }).waitFor();
    assert.equal(await page.locator('.trace-current-geometry .trace-vertex').count(), 4, 'reclosing preserves calibration markers until the room is added');
    assert.equal((await contour.getAttribute('fill')).replace(/\s+/g, ''), 'rgba(20,97,238,0.04)', 'closed rooms have a subtle blue fill without changing the plan opacity');
    assert.equal(await contour.getAttribute('stroke-dasharray'), 'none');
    const dimensions = page.locator('.trace-current-geometry .trace-dimension .appearance-label');
    assert.equal(await dimensions.count(), 4);
    await page.getByRole('button', { name: 'Вид', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Размеры сторон', exact: true }).uncheck();
    assert.equal(await dimensions.count(), 0, 'dimensions can be hidden without reopening the contour');
    await page.getByRole('checkbox', { name: 'Размеры сторон', exact: true }).check();
    assert.equal(await dimensions.count(), 4);
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).click();
    const controls = page.locator('.trace-canvas-controls');
    await controls.getByRole('button', { name: 'BC', exact: true }).click();
    await page.getByPlaceholder('длина в см', { exact: true }).fill('500');
    await controls.getByRole('button', { name: 'OK', exact: true }).click();
    const finish = controls.getByRole('button', { name: /^Добавить / });
    await finish.waitFor();
    assert.deepEqual(await dimensions.allTextContents(), ['500', '500', '500', '500'], 'wall labels use centimetres without side names or metre suffixes');
    await assertContained(page);
    await page.screenshot({ path: path.join(output, `scaled-${viewport.width}.png`) });
    await finish.click();
    await page.waitForFunction(() => window.__traceResults.length === 1);
    const result = await page.evaluate(() => window.__traceResults[0]);
    assert.equal(result.area, 25, '500 cm square produces 25 square metres');
    assert.equal(result.perim, 20, '500 cm square produces 20 metres perimeter');
    assert.equal(result.verts.length, 4);
    assert.equal(await page.locator('.trace-canvas-surface svg polygon').count(), 1, 'finished room remains visible');
    assert.equal(await marker(page, 'A').count(), 0, 'finishing clears draft markers');
    assert.equal(await page.locator('.trace-saved-geometry .trace-vertex').count(), 0, 'saved rooms never render vertex circles or letters');
    await page.screenshot({ path: path.join(output, `saved-clean-${viewport.width}.png`) });
    await assertCompletedLabelContained(page);
    await page.getByRole('button', { name: 'Вид', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Готовые помещения', exact: true }).uncheck();
    assert.equal(await page.locator('.trace-canvas-surface svg polygon').count(), 0);
    assert.equal(await page.evaluate(() => window.__traceResults.length), 1, 'hidden finished rooms are not deleted');
    await page.getByRole('checkbox', { name: 'Готовые помещения', exact: true }).check();
    assert.equal(await page.locator('.trace-canvas-surface svg polygon').count(), 1);
    await page.getByRole('checkbox', { name: 'Названия помещений', exact: true }).uncheck();
    assert.equal(await page.locator('.trace-room-label').count(), 0);
    await page.getByRole('checkbox', { name: 'Названия помещений', exact: true }).check();
    assert.equal(await page.locator('.trace-room-label').count(), 1);
    assert.match(await page.locator('.trace-room-label title').textContent(), /Помещение 1.*25 м²/);
    await page.getByRole('button', { name: 'Закрыть настройки вида', exact: true }).click();

    // A later room uses the saved scale without asking for another known length.
    for (const [x, y] of [[430, 100], [630, 100], [630, 300], [430, 300]]) {
      await tapImagePoint(page, x, y);
    }
    await page.getByRole('button', { name: 'Замкнуть контур', exact: true }).tap();
    await controls.getByRole('button', { name: /^Добавить / }).waitFor();
    assert.equal(await page.getByPlaceholder('длина в см', { exact: true }).count(), 0);
    await assertCompletedLabelContained(page);
    await page.screenshot({ path: path.join(output, `second-room-${viewport.width}.png`) });
    await controls.getByRole('button', { name: /^Добавить / }).click();
    await page.waitForFunction(() => window.__traceResults.length === 2);
    const secondResult = await page.evaluate(() => window.__traceResults[1]);
    assert.equal(secondResult.area, 25);
    assert.equal(secondResult.perim, 20);
    const savedStrokes = await page.locator('.trace-canvas-surface svg polygon').evaluateAll(elements => elements.map(element => ({ stroke: getComputedStyle(element).stroke, width: getComputedStyle(element).strokeWidth })));
    assert.deepEqual(savedStrokes, [{ stroke: 'rgb(53, 111, 192)', width: '1.6px' }, { stroke: 'rgb(53, 111, 192)', width: '1.6px' }], 'saved rooms retain the reduced blue tracing contour');
    await assertNoMagnet(page, context, viewport.width);
    assert.equal(await page.evaluate(() => window.__traceResults.length), 3, 'the skewed test room stays within the isolated trace callback');
    await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).click();
    assert.equal(await page.locator('.z-trace-shell').count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer?.state.projects)), await page.evaluate(() => window.__traceProjectBefore), 'test trace must not modify application projects');
    assert.deepEqual(errors, [], 'tracing causes no browser exceptions');
    await context.close();
    console.log(`Mobile tracing workflow passed at ${viewport.width} × ${viewport.height}`);
  }
  if (mode === 'picker' || mode === 'all') {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) await verifyPdfPicker(viewport);
  }
  if (mode === 'labels' || mode === 'all') {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
      if (process.env.TRACE_WIDTH && viewport.width !== Number(process.env.TRACE_WIDTH)) continue;
      await verifyFullRoomLabels(viewport);
    }
  }
  if (mode === 'orthogonal' || mode === 'all') {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
      if (process.env.TRACE_WIDTH && viewport.width !== Number(process.env.TRACE_WIDTH)) continue;
      await verifyOptionalOrthogonal(viewport);
    }
  }
  if (mode === 'fractional') {
    await verifyFractionalCalibration({ width: 390, height: 844 });
  }
  if (mode === 'recalibration') {
    await verifySheetRecalibration({ width: 390, height: 844 });
  }
  if (mode === 'precision') {
    await verifyLoupePrecision({ width: 390, height: 844 });
  }
  if (mode === 'angle-menu') {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) await captureCurrentAngleMenu(viewport);
  }
  if (mode === 'closing') {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await openTestPlan(page);
      await assertNoMagnet(page, context, viewport.width, { baseRooms: 0, verifyLoupe: false });
      await page.getByRole('button', { name: 'Закрыть обводку чертежа', exact: true }).tap();
      assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), await page.evaluate(() => window.__traceProjectBefore));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Exact-A closure passed at ${viewport.width} × ${viewport.height}`);
    }
  }
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
