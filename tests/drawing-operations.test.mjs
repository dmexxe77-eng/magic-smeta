import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawEditor as bridgeEditor } from '../src/design-bridge/drawEditor/editor.js';
import { createDrawEditor as mainEditor } from '../src/components/builders/drawEditor/editor.js';
import { mount } from './drawing-editor-runtime.mjs';

const rectangle = { verts: [[0, 0], [4, 0], [4, 3], [0, 3]] };

for (const [name, editor] of [['desktop/mobile', bridgeEditor], ['main', mainEditor]]) {
  for (const from of ['start', 'end']) {
    test(`${name}: a zero offset builds a one-sided bump from ${from}`, t => {
      const ui = mount(t, editor, rectangle);
      ui.selectSide();
      ui.click('op', { k: 'bump' });
      ui.click('seg', { n: 'from', v: from });
      ui.fill('off', '0', 'op');
      ui.fill('w', '100', 'op');
      ui.fill('dp', '20', 'op');
      ui.click('apply');
      const result = ui.save();
      assert.equal(result.area, 11.8);
      assert.equal(result.draw.ops.length, 1);
      assert.equal(result.draw.ops[0].off, 0);
      assert.equal(result.draw.ops[0].from, from);
      assert.equal(result.draw.ops[0].kind, 'bump');
      assert.equal(result.draw.base.v.length, 4);
      assert.equal(result.verts.length, 6, 'one shoulder gives six corners');
    });
  }

  test(`${name}: missing or negative offset and zero width/depth remain invalid`, t => {
    const ui = mount(t, editor, rectangle);
    ui.selectSide();
    ui.click('op', { k: 'bump' });
    for (const [off, width, depth] of [['', '100', '20'], ['-1', '100', '20'], ['0', '0', '20'], ['0', '100', '0']]) {
      ui.fill('off', off, 'op');
      ui.fill('w', width, 'op');
      ui.fill('dp', depth, 'op');
      ui.click('apply');
      const result = ui.save();
      assert.equal(result.area, 12);
      assert.equal(result.draw.ops.length, 0);
    }
  });
}
