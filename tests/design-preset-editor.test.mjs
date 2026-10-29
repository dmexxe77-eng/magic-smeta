import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './design-runtime.mjs';

async function editor() {
  const r = await runtime();
  r.component.go('btnEd', { be: { bid: 'canvas', pid: r.PRESETS.canvas[0].id, from: 'account' } });
  return r;
}

test('editor keeps changes in a draft until Save', async () => {
  const r = await editor(), app = r.component;
  const original = r.PRESETS.canvas[0].name;
  app.beVals().beSetName({ target: { value: 'Черновик' } });
  app.saveDesign();
  const before = await runtime({ saved: JSON.parse(r.entries.get('zamer.design.v1')) });
  assert.equal(before.PRESETS.canvas[0].name, original);
  app.presetEditorVals().peSave();
  const after = await runtime({ saved: JSON.parse(r.entries.get('zamer.design.v1')) });
  assert.equal(after.PRESETS.canvas[0].name, 'Черновик');
  assert.equal(app.state.screen, 'account');
});

test('Close restores presets and newly created custom blocks', async () => {
  const r = await editor(), app = r.component;
  const original = JSON.stringify(r.PRESETS), blocks = r.BLOCKS.length;
  app.beVals().beDup();
  app.beVals().beAddBlock();
  app.blockFormVals().nbSetName({ target: { value: 'Черновой блок' } });
  app.blockFormVals().nbSave();
  assert.equal(r.BLOCKS.length, blocks + 1);
  app.presetEditorVals().peClose();
  assert.equal(r.BLOCKS.length, blocks);
  assert.equal(JSON.stringify(r.PRESETS), original);
  assert.equal(app.state.screen, 'account');
});

test('settings menu exposes visibility, duplication and confirmed deletion', async () => {
  const r = await editor(), app = r.component;
  app.presetEditorVals().peOpenSettings();
  assert.equal(app.presetEditorVals().peSettings, true);
  app.presetEditorVals().peToggleVisibility();
  assert.equal(app.presetEditorVals().peVisible, false);
  const n = r.PRESETS.canvas.length;
  app.presetEditorVals().peDuplicate();
  assert.equal(r.PRESETS.canvas.length, n + 1);
  assert.match(app.beVals().beName, /копия$/);
  app.presetEditorVals().peAskDelete();
  assert.equal(r.PRESETS.canvas.length, n + 1);
  assert.equal(app.presetEditorVals().peDeleteConfirm, true);
  app.presetEditorVals().peConfirmDelete();
  assert.equal(r.PRESETS.canvas.length, n);
});

test('norm is a per-position multiplier and can be reset to one', async () => {
  const r = await editor(), app = r.component;
  const first = r.PRESETS.canvas[0].items[0];
  app.presetEditorVals().peItems[0].openNorm();
  assert.equal(app.presetEditorVals().peNorm, true);
  app.presetEditorVals().peSetNorm({ target: { value: '10' } });
  app.presetEditorVals().peApplyNorm();
  assert.equal(first.k, 10);
  const lines = r.instLines('canvas', { pid: r.PRESETS.canvas[0].id, qtyO: 3 }, 3, { a: 3, p: 8, inn: 4, out: 0 });
  assert.equal(lines[0].q, 30);
  app.presetEditorVals().peItems[0].openNorm();
  app.presetEditorVals().peResetNorm();
  assert.equal(first.k, 1);
});

test('norm rejects empty, zero and invalid input without closing its sheet', async () => {
  const r = await editor(), app = r.component;
  const first = r.PRESETS.canvas[0].items[0], original = first.k;
  app.presetEditorVals().peItems[0].openNorm();
  for (const value of ['', '0', '-1', 'abc']) {
    app.presetEditorVals().peSetNorm({ target: { value } });
    app.presetEditorVals().peApplyNorm();
    assert.equal(first.k, original);
    assert.equal(app.presetEditorVals().peNorm, true);
  }
  app.presetEditorVals().peSetNorm({ target: { value: '1,5' } });
  app.presetEditorVals().peApplyNorm();
  assert.equal(first.k, 1.5);
});

test('list editor adds alternatives to one row and persists them with the preset', async () => {
  const r = await editor(), app = r.component;
  const first = r.PRESETS.canvas[0].items[0], count = r.PRESETS.canvas[0].items.length;
  app.presetEditorVals().peItems[0].openList();
  assert.equal(app.presetEditorVals().peList, true);
  app.presetEditorVals().peAddVariants();
  const alternative = r.NOM.find(n => n.n !== first.n && !r.PRESETS.canvas[0].items.some(i => i.n === n.n));
  app.setState({ be: { ...app.state.be, sel: [alternative.n] } });
  app.beVals().nomAdd();
  assert.equal(r.PRESETS.canvas[0].items.length, count);
  assert.deepEqual(Array.from(first.variants, n => n.n), [first.n, alternative.n]);
  app.presetEditorVals().peSave();
  const restored = await runtime({ saved: JSON.parse(r.entries.get('zamer.design.v1')) });
  assert.equal(restored.PRESETS.canvas[0].items[0].variants[1].n, alternative.n);
});
