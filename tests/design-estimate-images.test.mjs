import test from 'node:test';
import assert from 'node:assert/strict';
import { withEstimateImages } from '../src/design-bridge/estimate-images.js';

test('export photos match selected names and room-suffixed canvas names without changing amounts', () => {
  const estimate = {
    mats: [
      { n: 'Выбранный профиль', k: 'Старый профиль', q: 10, p: 500, t: 5000 },
      { n: 'Полотно (Гостиная)', k: 'Полотно|room-1', q: 12, p: 700, t: 8400 },
      { n: 'Без фото', k: 'Старый профиль|room-1', q: 1, p: 20, t: 20 },
    ], works: [], equipment: [], total: 13420,
  };
  const before = JSON.stringify(estimate);
  const result = withEstimateImages(estimate, [
    { n: 'Старый профиль', img: 'old.jpg' },
    { n: 'Выбранный профиль', img: 'selected.jpg' },
    { n: 'Полотно', img: 'canvas.png' },
  ]);
  assert.equal(result.mats[0].img, '/design/nom/selected.jpg');
  assert.equal(result.mats[1].img, '/design/nom/canvas.png');
  assert.equal(result.mats[2].img, undefined);
  assert.equal(result.total, estimate.total);
  assert.deepEqual(result.mats.map(({ img, ...line }) => line), estimate.mats);
  assert.equal(JSON.stringify(estimate), before);
});
