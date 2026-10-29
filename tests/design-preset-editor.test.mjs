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
  const before = await runtime({ saved: r.entries.get('zamer.design.v1') });
  assert.equal(before.PRESETS.canvas[0].name, original);
  app.presetEditorVals().peSave();
  const after = await runtime({ saved: r.entries.get('zamer.design.v1') });
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
  assert.equal(r.PRESETS.canvas.filter(p => !p.archived).length, n);
});

test('failed storage write keeps the editor open and allows another save attempt', async () => {
  const r = await runtime({ storageError: true }), app = r.component;
  app.go('btnEd', { be: { bid: 'canvas', pid: r.PRESETS.canvas[0].id, from: 'account' } });
  app.beVals().beSetName({ target: { value: 'Несохранённый пресет' } });
  app.presetEditorVals().peSave();
  assert.equal(app.state.screen, 'btnEd');
  assert.equal(app.beVals().beName, 'Несохранённый пресет');
});

test('deleting a preset preserves estimates where it was already selected', async () => {
  const r = await runtime(), app = r.component;
  const project = app.state.projects.find(p => p.rooms.length && p.rooms[0].canvas.pid);
  const pid = project.rooms[0].canvas.pid, total = app.pSum(project);
  app.go('btnEd', { be: { bid: 'canvas', pid, from: 'account' } });
  app.presetEditorVals().peAskDelete();
  app.presetEditorVals().peConfirmDelete();
  assert.equal(app.pSum(project), total);
  assert.equal(r.PRESETS.canvas.find(p => p.id === pid).archived, true);
  assert.ok(!app.presetEditorVals().peChips.some(ch => ch.name === r.PRESETS.canvas.find(p => p.id === pid).name));
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

test('applying a norm uses the main quantity even for a row previously tied to corners', async () => {
  const r = await runtime(), app = r.component;
  const preset = r.PRESETS.main.find(p => p.items.length);
  const item = { n: 'Внешние углы', p: 100, u: 'шт', m: 1, src: 'outer', mult: 7 };
  preset.items = [item];
  app.go('btnEd', { be: { bid: 'main', pid: preset.id, from: 'account' } });
  app.presetEditorVals().peItems[0].openNorm();
  assert.equal(app.presetEditorVals().peNormBasis, 'На 1 единицу основного количества');
  app.presetEditorVals().peSetNorm({ target: { value: '10' } });
  app.presetEditorVals().peApplyNorm();
  const line = r.instLines('main', { pid: preset.id, qtyO: 15 }, 15, { a: 30, p: 40, inn: 4, out: 2 })[0];
  assert.equal(line.q, 150);
  assert.equal(item.src, undefined);
  app.beVals().beItems[0].cycleSrc();
  app.beVals().srcOptions.find(option => option.label === 'Внешние углы').pick();
  assert.equal(item.k, 1, 'an explicit geometric source switches out of the block norm');
});

test('norm uses a common basis label and the block unit in its calculation example', async () => {
  for (const [bid, unit] of [['light', 'шт'], ['custom_length', 'м.п.'], ['custom_area', 'м²'], ['custom_set', 'компл.']]) {
    const r = await runtime({ mainDataPatch: main => ({ blocks: bid === 'light' ? [] : [{ id: bid, title: bid, source: 'manual', unit }], presets: { ...main.presets, [bid]: [{ id: 'test', name: 'Тест', items: [{ n: 'Угол', p: 10, u: 'шт', m: 1 }] }] } }) });
    r.component.go('btnEd', { be: { bid, pid: 'test', from: 'account' } });
    r.component.presetEditorVals().peItems[0].openNorm();
    assert.equal(r.component.presetEditorVals().peNormBasis, 'На 1 единицу основного количества');
    assert.equal(r.component.presetEditorVals().peNormExample, 'Пример: 15 '+unit+' × 1 = 15 шт');
  }
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
  const restored = await runtime({ saved: r.entries.get('zamer.design.v1') });
  assert.equal(restored.PRESETS.canvas[0].items[0].variants[1].n, alternative.n);
});
