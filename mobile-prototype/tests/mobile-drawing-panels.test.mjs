import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawEditor } from '../src/design-bridge/drawEditor/editor.js';
import { mount } from './drawing-editor-runtime.mjs';

const rectangle = { verts: [[0, 0], [4, 0], [4, 3], [0, 3]] };
const mobile = { mobileWorkflow: true };
const values = ui => Object.fromEntries(ui.node('#sheet').querySelectorAll('input.in').map(input => [input.dataset.k ?? input.dataset.i, input.value]));
const next = ui => ui.clickContainer('#inputAccessory', 'nextField');
const plain = value => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const actionTarget = act => ({
  dataset: { act }, disabled: false, tagName: 'BUTTON',
  closest(selector) {
    const actions = [...selector.matchAll(/\[data-act="([^"]+)"\]/g)].map(match => match[1]);
    return actions.length ? actions.includes(act) ? this : null : /^(?:button)?\[data-act\]$|^button$/.test(selector) ? this : null;
  },
});
const formPointer = (ui, act, type = 'pointerdown') => ui.node('#sheet').dispatch(type, actionTarget(act), {
  pointerType: 'touch', pointerId: 1, button: 0, isPrimary: true, detail: type === 'click' ? 1 : 0,
});
const vertices = ui => ui.node('#cv').firstChild.children
  .filter(element => element.attributes.get('data-hit') === 'v' && !element.attributes.has('data-h'))
  .sort((a, b) => Number(a.attributes.get('data-i')) - Number(b.attributes.get('data-i')))
  .map(element => ({ x: Number(element.attributes.get('cx')), y: Number(element.attributes.get('cy')) }));
const heading = (ui, index) => {
  const points = vertices(ui), a = points[index], b = points[(index + 1) % points.length];
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 360) % 360;
};
const assertHeading = (ui, index, expected) => {
  const difference = (heading(ui, index) - expected + 540) % 360 - 180;
  assert.ok(Math.abs(difference) < 1e-6, `wall ${index} has heading ${heading(ui, index)}°, expected ${expected}°`);
};

for (const [kind, fields, target] of [
  ['len', ['len'], 'canvas'],
  ['shift', ['d'], 'chip'],
  ['bump', ['off', 'w', 'dp'], 'canvas'],
  ['arc', ['h'], 'chip'],
  ['add', ['d'], 'canvas'],
  ['fillet', ['r'], 'chip'],
]) {
  test(`mobile tools: choosing ${kind} before its ${target} target opens the matching form without a keyboard`, t => {
    const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
    ui.click('toggleTools');
    assert.match(ui.node('#sheet').innerHTML, new RegExp(`data-act="chooseTool"[^>]*data-k="${kind}"`));
    ui.click('chooseTool', { k: kind });
    const pending = ui.node('#sheet').innerHTML;
    assert.match(pending, /class="mobile-tool-pick"/);
    assert.doesNotMatch(pending, /data-act="finish"|id="roomName"|data-in="op"/, 'the target step leaves only selection controls');
    const vertex = kind === 'fillet', action = vertex ? 'selectVertex' : 'selectSide';
    assert.match(pending, new RegExp(`data-act="${action}"`));
    assert.doesNotMatch(pending, new RegExp(`data-act="${vertex ? 'selectSide' : 'selectVertex'}"`), 'only suitable targets are listed');
    if (target === 'chip') ui.click(action, { i: '1' });
    else if (vertex) ui.selectVertex(1);
    else ui.selectSide(1);
    assert.doesNotMatch(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
    assert.deepEqual(Object.keys(values(ui)), fields);
    assert.match(ui.node('#sheet').innerHTML, /data-act="apply"/);
    assert.equal(ui.activeInput(), null);
    ui.click('cancel');
    assert.deepEqual(ui.save(), before, 'choosing a tool and target does not change any measurements');
  });
}

test('mobile tools: corner and blank taps keep a pending wall tool until a wall is selected', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
  ui.click('toggleTools');
  ui.click('chooseTool', { k: 'shift' });
  for (const tap of [() => ui.selectVertex(0), () => ui.sketchPoint(760, 560)]) {
    tap();
    assert.match(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
    assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-in="op"|data-act="del"/);
  }
  const finishes = ui.finishCount();
  assert.equal(ui.save(), undefined, 'a pending target cannot save the drawing');
  assert.equal(ui.finishCount(), finishes);
  ui.click('cancelTool');
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-operation-menu"/);
  assert.deepEqual(ui.save(), before, 'leaving target selection preserves the entire room');
});

test('mobile tools: wall taps keep a pending corner tool and selecting the corner opens rounding', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.click('toggleTools');
  ui.click('chooseTool', { k: 'fillet' });
  ui.selectSide(0);
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
  ui.selectVertex(0);
  assert.deepEqual(Object.keys(values(ui)), ['r']);
  ui.fill('r', '25', 'op');
  ui.click('apply');
  const result = ui.save();
  assert.deepEqual(result.draw.ops, [{ kind: 'fillet', i: 0, r: .25 }]);
  assert.ok(result.area < 12);
});

test('mobile tools: the operation-first length edit applies once and one undo restores the room', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
  ui.click('toggleTools');
  ui.click('chooseTool', { k: 'len' });
  ui.selectSide(0);
  ui.fill('len', '450', 'op');
  ui.click('apply');
  const after = ui.save();
  assert.equal(after.area, 13.5);
  assert.equal(after.draw.ops.length, 1);
  assert.deepEqual(after.draw.ops[0], { kind: 'len', i: 0, end: 'end', len: 4.5 });
  assert.deepEqual(after.verts, [[0, 0], [4.5, 0], [4.5, 3], [0, 3]]);
  assert.doesNotMatch(JSON.stringify(after), /toolPick|chooseTool|mobile-tool-pick/, 'temporary selection state is absent from saved geometry');
  ui.history('undo');
  assert.deepEqual(ui.save(), before);
  ui.history('redo');
  assert.deepEqual(ui.save(), after);
});

for (const route of ['canvas', 'chip']) {
  test(`mobile tools: ${route} targets keep the selected internal cutout instead of editing the outer wall`, t => {
    const ui = mount(t, createDrawEditor, { ...rectangle, holes: [[[1, 1], [2, 1], [2, 2], [1, 2]]] }, mobile);
    ui.click('toggleTools');
    ui.click('chooseTool', { k: 'len' });
    assert.match(ui.node('#sheet').innerHTML, /data-act="selectSide"[^>]*data-i="0"[^>]*data-h="0"/);
    if (route === 'canvas') ui.selectSide(0, 0);
    else ui.click('selectSide', { i: '0', h: '0' });
    assert.equal(values(ui).len, '100');
    ui.fill('len', '120', 'op');
    ui.click('apply');
    const result = ui.save();
    assert.deepEqual(result.verts, rectangle.verts);
    assert.deepEqual(result.holes[0], [[1, 1], [2.2, 1], [2.2, 2], [1, 2]]);
    assert.ok(Math.abs(result.area - 10.8) < 1e-9);
    assert.deepEqual(result.draw.ops[0], { kind: 'len', i: 0, h: 0, end: 'end', len: 1.2 });
  });
}

test('mobile tools: selecting a cutout corner on the canvas rounds that corner without changing outer vertices', t => {
  const ui = mount(t, createDrawEditor, { ...rectangle, holes: [[[1, 1], [2, 1], [2, 2], [1, 2]]] }, mobile);
  ui.click('toggleTools');
  ui.click('chooseTool', { k: 'fillet' });
  assert.match(ui.node('#sheet').innerHTML, /data-act="selectVertex"[^>]*data-i="0"[^>]*data-h="0"/);
  ui.selectVertex(0, 0);
  ui.fill('r', '50', 'op');
  ui.click('apply');
  const result = ui.save();
  assert.deepEqual(result.verts, rectangle.verts);
  assert.deepEqual(result.draw.ops[0], { kind: 'fillet', i: 0, h: 0, r: .5 });
  assert.ok(result.area > 11 && result.area < 11.1, 'rounding a cutout removes less ceiling area while preserving the outer contour');
});

test('mobile tools: canvas taps without a pending tool still expose contextual wall and corner actions', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
  ui.selectSide(2);
  assert.match(ui.node('#sheet').innerHTML, /selection-card/);
  assert.match(ui.node('#sheet').innerHTML, /data-act="op" data-k="len"/);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="chooseTool"/);
  ui.click('op', { k: 'len' });
  assert.equal(values(ui).len, '400');
  ui.click('cancel');
  ui.click('deselect');
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-operation-menu"/);
  ui.selectVertex(1);
  assert.match(ui.node('#sheet').innerHTML, /data-act="op" data-k="fillet"/);
  assert.match(ui.node('#sheet').innerHTML, /data-act="del"/);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="op" data-k="shift"/);
  assert.deepEqual(ui.save(), before);
});

test('mobile footer: renaming the room survives opening and closing tools and reaches the saved drawing', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile), input = ui.node('#roomName');
  assert.ok(input.getAttribute('aria-label'), 'the compact field retains an accessible name');
  input.value = ' Кухня ';
  ui.node('#sheet').dispatch('input', input);
  ui.click('toggleTools');
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-operation-menu"/);
  assert.equal(ui.node('#roomName').value, ' Кухня ');
  ui.click('toggleTools');
  const result = ui.save();
  assert.equal(result.name, 'Кухня');
  assert.deepEqual(result.draw.ops, []);
});

test('mobile tools: undo, redo and stage changes clear a pending target instead of reviving its operation', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
  ui.selectSide(0);
  ui.click('op', { k: 'len' });
  ui.fill('len', '450', 'op');
  ui.click('apply');
  const edited = ui.save();
  ui.click('chooseTool', { k: 'shift' });
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
  ui.history('undo');
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
  assert.deepEqual(ui.save(), before);
  ui.click('chooseTool', { k: 'fillet' });
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
  ui.history('redo');
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
  assert.deepEqual(ui.save(), edited);
  ui.click('chooseTool', { k: 'add' });
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
  ui.click('back2');
  assert.equal(ui.node('#app').dataset.stage, 2);
  ui.click('done');
  ui.selectSide(0);
  assert.match(ui.node('#sheet').innerHTML, /selection-card/);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-in="op"/, 'returning to Details does not retain the abandoned add-point tool');
});

test('mobile tools: cancelling target selection or collapsing tools leaves later canvas taps contextual', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.click('toggleTools');
  ui.click('chooseTool', { k: 'arc' });
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"/);
  ui.click('cancelTool');
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-operation-menu"/);
  ui.click('chooseTool', { k: 'bump' });
  ui.click('toggleTools');
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /class="mobile-tool-pick"|data-act="chooseTool"/);
  ui.selectSide(0);
  assert.match(ui.node('#sheet').innerHTML, /selection-card/);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-in="op"/);
});

test('mobile tools: the operation catalog keeps diameter editing for a built oval', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-oval');
  ui.click('qmode', { v: 'ellipse' });
  ui.fill('rx', '400', 'q');
  ui.fill('ry', '300', 'q');
  ui.click('quickBuild');
  const before = ui.save();
  ui.click('toggleTools');
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-operation-menu"/);
  assert.match(ui.node('#sheet').innerHTML, /data-act="editQuick"/);
  ui.click('editQuick');
  assert.deepEqual(values(ui), { rx: '400', ry: '300' });
  assert.equal(ui.activeInput(), null);
  ui.click('quickCancel');
  assert.deepEqual(ui.save(), before);
});

function helpReferences(ui) {
  const detail = ui.node('#operationHelp');
  assert.ok(detail, 'the operation exposes its native measurement-help disclosure');
  for (const input of ui.node('#sheet').querySelectorAll('input[data-in="op"]')) {
    const description = input.getAttribute('aria-describedby');
    assert.match(input.getAttribute('aria-label'), /сантиметров/);
    assert.ok(description, 'each active numeric field retains its accessible measuring help');
    for (const id of description ? description.split(/\s+/) : []) {
      assert.ok(detail.innerHTML.includes(`id="${id}"`), 'the referenced help exists inside the disclosure');
      assert.equal(ui.node('#sheet').innerHTML.split(`id="${id}"`).length - 1, 1, 'help IDs stay unique after configuration changes');
    }
  }
  return detail;
}

function toggleHelp(ui, open) {
  const detail = helpReferences(ui);
  detail.open = open;
  ui.node('#sheet').dispatch('toggle', detail);
}

for (const operation of ['shift', 'arc', 'bump']) {
  test(`mobile panels: opening ${operation} shows its scheme without opening the keyboard`, t => {
    const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
    ui.selectSide(0);
    ui.click('op', { k: operation });
    assert.equal(ui.activeInput(), null);
    assert.match(ui.node('#opguide').innerHTML, /<svg\b/);
    assert.ok(ui.node('#sheet').querySelectorAll('input[data-in="op"]').length > 0);
    ui.click('cancel');
    assert.deepEqual(ui.save(), before);
  });
}

test('mobile panels: changing the cutout origin keeps entered values and leaves the keyboard closed', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.click('hole');
  assert.equal(ui.activeInput(), null);
  assert.match(ui.node('#sheet').innerHTML, /<svg class="scheme"/);
  for (const [key, value] of [['d1', '100'], ['d2', '100'], ['w', '50'], ['hh', '50']]) ui.fill(key, value, 'op');
  ui.focus('d1', 'op');
  ui.click('seg', { n: 'c', v: 'c1' });
  assert.equal(ui.activeInput(), null);
  assert.deepEqual(values(ui), { d1: '100', d2: '100', w: '50', hh: '50' });
  ui.click('apply');
  const result = ui.save();
  assert.equal(result.area, 11.75);
  assert.equal(result.holes.length, 1);
  assert.equal(result.draw.ops[0].c, 1);
});

test('mobile panels: cutout navigation reaches its last native field without an intermediate review action', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
  ui.click('hole');
  ui.focus('d1', 'op');
  const firstAccessory = ui.node('#inputAccessory').innerHTML;
  assert.match(plain(firstAccessory), /1 из 4/);
  assert.match(plain(firstAccessory), /Далее/);
  assert.match(plain(firstAccessory), /Схема/);
  assert.doesNotMatch(firstAccessory, /Внутренний вырез:|От A вдоль AB, сантиметров/);
  for (const [index, [key, value]] of [['d1', '100'], ['d2', '100'], ['w', '50'], ['hh', '50']].entries()) {
    assert.equal(ui.activeInput().key, key);
    ui.fill(key, value, 'op');
    if (index === 3) {
      assert.equal(ui.node('#inputAccessory').hidden, true);
      assert.equal(ui.node('#inputAccessory').innerHTML, '', 'the last input leaves no additional review button');
    } else next(ui);
  }
  assert.deepEqual(ui.activeInput(), { kind: 'op', key: 'hh', value: '50' }, 'the native keyboard stays on the final value until Apply or Cancel');
  assert.equal(ui.node('#inputAccessory').hidden, true);
  ui.click('cancel');
  assert.deepEqual(ui.save(), before, 'cancelling the completed form leaves the ceiling unchanged');
  ui.click('hole');
  for (const [key, value] of [['d1', '100'], ['d2', '100'], ['w', '50'], ['hh', '50']]) ui.fill(key, value, 'op');
  ui.click('apply');
  assert.equal(ui.save().area, 11.75, 'only Apply commits the cutout');
});

test('mobile panels: rectangle entry waits for explicit focus and Build after keyboard navigation', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-rect');
  assert.equal(ui.activeInput(), null);
  ui.focus('a', 'q');
  ui.fill('a', '400', 'q');
  next(ui);
  assert.equal(ui.activeInput().key, 'b');
  ui.fill('b', '300', 'q');
  assert.equal(ui.node('#inputAccessory').hidden, true);
  assert.equal(ui.node('#inputAccessory').innerHTML, '');
  assert.deepEqual(ui.activeInput(), { kind: 'q', key: 'b', value: '300' });
  assert.equal(ui.node('#app').dataset.stage, 0);
  assert.equal(ui.save(), undefined, 'entering the last value does not build the room');
  formPointer(ui, 'quickBuild');
  formPointer(ui, 'quickBuild', 'click');
  assert.equal(ui.activeInput(), null);
  assert.equal(ui.save().area, 12);
});

test('mobile panels: oval mode changes and editing diameters preserve values without autofocus', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-oval');
  assert.equal(ui.activeInput(), null);
  ui.focus('r', 'q');
  ui.fill('r', '400', 'q');
  ui.click('qmode', { v: 'ellipse' });
  assert.equal(ui.activeInput(), null);
  ui.fill('rx', '400', 'q');
  ui.fill('ry', '300', 'q');
  ui.click('qmode', { v: 'circle' });
  assert.equal(ui.activeInput(), null);
  assert.equal(values(ui).r, '400');
  ui.click('qmode', { v: 'ellipse' });
  assert.equal(ui.activeInput(), null);
  assert.deepEqual(values(ui), { rx: '400', ry: '300' });
  ui.click('quickBuild');
  const before = ui.save();
  ui.click('editQuick');
  assert.equal(ui.activeInput(), null);
  assert.deepEqual(values(ui), { rx: '400', ry: '300' });
  ui.click('quickCancel');
  assert.deepEqual(ui.save(), before);
});

test('embedded panels retain automatic numeric focus', t => {
  const ui = mount(t, createDrawEditor, rectangle, { embedded: true });
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  assert.deepEqual(ui.activeInput(), { kind: 'op', key: 'd', value: '' });
});

test('mobile panels: changing wall length keeps the first corner fixed without a corner selector', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.selectSide(0);
  ui.click('op', { k: 'len' });
  assert.equal(ui.activeInput(), null);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="seg"[^>]*data-n="end"/);
  assert.equal(values(ui).len, '400');
  ui.fill('len', '450', 'op');
  ui.click('apply');
  const result = ui.save();
  assert.equal(result.area, 13.5);
  assert.deepEqual(result.verts, [[0, 0], [4.5, 0], [4.5, 3], [0, 3]]);
  assert.equal(result.draw.ops[0].end, 'end');
  assert.equal(result.draw.ops[0].len, 4.5);
});

for (const [kind, key, value, expectedArea] of [['len', 'len', '450', 13.5], ['fillet', 'r', '50', 11.95]]) {
  test(`mobile panels: a single ${kind} field goes directly from native input to one Apply or Cancel touch`, t => {
    const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
    const open = () => {
      if (kind === 'fillet') ui.selectVertex(0);
      else ui.selectSide(0);
      ui.click('op', { k: kind });
      ui.focus(key, 'op');
      assert.equal(ui.node('#inputAccessory').hidden, true);
      assert.equal(ui.node('#inputAccessory').innerHTML, '');
      assert.equal(ui.activeInput().key, key);
    };
    open();
    ui.fill(key, value, 'op');
    assert.equal(formPointer(ui, 'apply').defaultPrevented, true);
    formPointer(ui, 'apply', 'click');
    const result = ui.save();
    assert.equal(result.area, expectedArea);
    assert.equal(result.draw.ops.length, 1);
    assert.equal(result.draw.ops[0].kind, kind);
    assert.equal(ui.activeInput(), null);
    ui.history('undo');
    assert.deepEqual(ui.save(), before);
    open();
    ui.fill(key, '25', 'op');
    assert.equal(formPointer(ui, 'cancel').defaultPrevented, true);
    formPointer(ui, 'cancel', 'click');
    assert.equal(ui.activeInput(), null);
    assert.deepEqual(ui.save(), before, 'Cancel leaves the original geometry and history intact');
  });
}

for (const [height, maximum, accepted] of [[2.2 - 1e-8, '220', '220'], [2.199, '219,9', '219.9']]) {
  test(`mobile fillet: a ${height} m wall displays its true limit and applies the supported radius`, t => {
    const room = { verts: [[0, 0], [4, 0], [4, height], [0, height]] };
    const ui = mount(t, createDrawEditor, room, mobile), before = ui.save();
    ui.selectVertex(0);
    ui.click('op', { k: 'fillet' });
    assert.ok(ui.node('#opnote').textContent.includes(`максимум R ${maximum} см`));
    ui.focus('r', 'op');
    ui.fill('r', height < 2.1999 ? '220' : '221', 'op');
    formPointer(ui, 'apply');
    assert.ok(ui.node('#toast').textContent.includes(`Максимальный радиус ${maximum} см`));
    assert.ok(ui.node('#sheet').querySelector('input[data-k="r"]'), 'an excessive radius leaves the form available for correction');
    assert.deepEqual(ui.save(), before);
    ui.fill('r', accepted, 'op');
    formPointer(ui, 'apply');
    formPointer(ui, 'apply', 'click');
    const result = ui.save();
    assert.deepEqual(result.draw.ops, [{ kind: 'fillet', i: 0, r: Number(accepted) / 100 }]);
    assert.ok(result.area < before.area);
    assert.ok(result.verts.length > 4, 'the accepted radius produces the visible arc');
  });
}

test('embedded panels: wall length still permits moving the first corner instead', t => {
  const ui = mount(t, createDrawEditor, rectangle, { embedded: true });
  ui.selectSide(0);
  ui.click('op', { k: 'len' });
  assert.match(ui.node('#sheet').innerHTML, /data-act="seg"[^>]*data-n="end"[^>]*data-v="start"/);
  ui.click('seg', { n: 'end', v: 'start' });
  ui.fill('len', '450', 'op');
  ui.click('apply');
  const result = ui.save();
  assert.equal(result.area, 13.5);
  assert.deepEqual(result.verts, [[0, 0], [4.5, 0], [4.5, 3], [0, 3]], 'saved room coordinates are normalized to their bounding box');
  assert.equal(result.draw.ops[0].end, 'start');
  assert.equal(result.draw.ops[0].len, 4.5);
});

test('mobile panels: the all-right-angle switch appears only with angle controls and still changes constraints', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.click('back2');
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="(?:allOrtho|freeAngles)"/);
  ui.click('tab2', { v: 'diags' });
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="(?:allOrtho|freeAngles)"/);
  ui.click('tab2', { v: 'angles' });
  assert.match(ui.node('#sheet').innerHTML, /data-act="freeAngles"/);
  ui.click('freeAngles');
  assert.ok(ui.save().draw.m.vert.every(vertex => vertex.kind === 'free'));
  ui.click('allOrtho');
  assert.ok(ui.save().draw.m.vert.every(vertex => vertex.kind === 'ortho' && vertex.deg === 90));
  assert.equal(ui.activeInput(), null);
});

test('mobile panels: the drawing header reports the current area and perimeter after edits', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  const stats = () => {
    const node = ui.node('#canvasMeta'), text = plain(node.innerHTML || node.textContent);
    assert.match(text, /Площадь/);
    assert.match(text, /Периметр/);
    assert.doesNotMatch(text, /угл/);
    return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map(match => Number(match[0].replace(',', '.')));
  };
  assert.deepEqual(stats(), [12, 14]);
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  ui.fill('d', '20', 'op');
  ui.click('apply');
  assert.deepEqual(stats(), [12.8, 14.4]);
});

test('mobile panels: Align first makes the selected wall horizontal and then cycles by ninety degrees', t => {
  const ui = mount(t, createDrawEditor, { verts: [[0, 0], [4, 1], [3, 4], [-1, 3]] }, mobile);
  const before = ui.save();
  ui.selectSide(1);
  for (const expected of [0, 90, 180, 270, 0]) {
    ui.click('viewAlign');
    assertHeading(ui, 1, expected);
    assert.deepEqual(ui.save(), before);
  }
});

test('mobile panels: manual rotation, slider input and a different selected wall reset the Align cycle', t => {
  const ui = mount(t, createDrawEditor, { verts: [[0, 0], [4, 1], [3, 4], [-1, 3]] }, mobile);
  const before = ui.save();
  ui.selectSide(1);
  ui.click('viewAlign');
  ui.click('viewAlign');
  ui.click('viewRotateRight');
  ui.click('viewAlign');
  assertHeading(ui, 1, 0);
  ui.click('viewAlign');
  assertHeading(ui, 1, 90);
  ui.click('viewToggle');
  const range = ui.node('#viewRotation');
  range.value = '17';
  ui.node('#viewPanel').dispatch('input', range);
  ui.click('viewAlign');
  assertHeading(ui, 1, 0);
  ui.click('viewAlign');
  ui.selectSide(0);
  ui.click('viewAlign');
  assertHeading(ui, 0, 0);
  assert.deepEqual(ui.save(), before);
});

test('mobile panels: entering a different stage resets the Align cycle', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.selectSide(0);
  ui.click('viewAlign');
  ui.click('viewAlign');
  assertHeading(ui, 0, 90);
  ui.click('back2');
  ui.selectSide(0);
  ui.click('viewAlign');
  assertHeading(ui, 0, 0);
  ui.click('viewAlign');
  assertHeading(ui, 0, 90);
  ui.click('done');
  ui.click('viewAlign');
  assertHeading(ui, 0, 0);
});

test('mobile panels: compact cutout fields retain accessible help after changing their reference corner', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.click('hole');
  assert.equal(helpReferences(ui).open, false, 'measurement explanations start collapsed');
  for (const [key, value] of [['d1', '100'], ['d2', '100'], ['w', '50'], ['hh', '50']]) ui.fill(key, value, 'op');
  ui.click('seg', { n: 'c', v: 'c1' });
  assert.equal(helpReferences(ui).open, false);
  assert.match(ui.node('#sheet').querySelector('input[data-k="d1"]').getAttribute('aria-label'), /От B вдоль BC/);
  assert.equal(ui.activeInput(), null);
  assert.deepEqual(values(ui), { d1: '100', d2: '100', w: '50', hh: '50' });
  ui.click('apply');
  assert.equal(ui.save().area, 11.75);
});

test('mobile panels: measurement-help disclosure state survives input and arc configuration changes', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
  ui.selectSide(0);
  ui.click('op', { k: 'arc' });
  assert.equal(helpReferences(ui).open, false);
  assert.equal(ui.node('#sheet').querySelector('input[data-k="h"]').getAttribute('aria-describedby'), 'op-help-h');
  toggleHelp(ui, true);
  ui.focus('h', 'op');
  ui.fill('h', '25', 'op');
  assert.equal(helpReferences(ui).open, true);
  ui.click('seg', { n: 'mode', v: 's' });
  assert.equal(ui.activeInput(), null);
  assert.equal(helpReferences(ui).open, true, 'changing the active field preserves the open disclosure');
  assert.equal(ui.node('#sheet').querySelector('input[data-k="s"]').getAttribute('aria-describedby'), 'op-help-s');
  ui.fill('s', '500', 'op');
  ui.click('seg', { n: 'mode', v: 'h' });
  assert.equal(helpReferences(ui).open, true);
  assert.equal(values(ui).h, '25');
  toggleHelp(ui, false);
  ui.click('seg', { n: 'dir', v: 'in' });
  assert.equal(helpReferences(ui).open, false);
  assert.equal(values(ui).h, '25');
  ui.click('cancel');
  assert.deepEqual(ui.save(), before, 'opening measuring help does not alter or commit the operation');
});

test('mobile panels: compact visible control labels stay included in their accessible names', t => {
  const ui = mount(t, createDrawEditor, { ...rectangle, holes: [[[1, 1], [2, 1], [2, 2], [1, 2]]] }, mobile);
  const normalized = value => plain(value).toLowerCase();
  const assertButtonName = (name, value) => {
    const button = [...ui.node('#sheet').innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .find(([, attributes]) => attributes.includes('data-act="seg"') && attributes.includes(`data-n="${name}"`) && attributes.includes(`data-v="${value}"`));
    assert.ok(button, 'the configured operation control is rendered');
    const accessible = button[1].match(/aria-label="([^"]*)"/)[1];
    assert.ok(normalized(accessible).includes(normalized(button[2])), 'the accessible name includes the visible button text');
  };
  ui.selectSide(0);
  ui.click('op', { k: 'arc' });
  assertButtonName('mode', 'h');
  assertButtonName('mode', 's');
  ui.click('cancel');
  ui.click('hole');
  const input = ui.node('#sheet').querySelector('input[data-k="d1"]');
  const label = ui.node('#sheet').innerHTML.match(new RegExp(`<label\\b[^>]*for="${input.id}"[^>]*>([\\s\\S]*?)<\\/label>`))[1];
  assert.ok(normalized(input.getAttribute('aria-label')).includes(normalized(label)), 'the full numeric-field name includes its compact visible label');
  ui.click('cancel');
  ui.click('selectSide', { i: '0', h: '0' });
  ui.click('op', { k: 'bump' });
  assertButtonName('dir', 'in');
});

for (const [operation, entries, expectedArea] of [
  ['shift', [['d', '20']], 12.8],
  ['hole', [['d1', '100'], ['d2', '100'], ['w', '50'], ['hh', '50']], 11.75],
]) {
  test(`mobile panels: native ${operation} input and Next keep the complete form in place`, t => {
    const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
    if (operation === 'hole') ui.click('hole');
    else { ui.selectSide(0); ui.click('op', { k: operation }); }
    const sheet = ui.node('#sheet'), inputs = sheet.querySelectorAll('input[data-in="op"]'), camera = vertices(ui);
    const assertSameForm = () => {
      assert.equal(ui.node('#sheet'), sheet);
      const current = sheet.querySelectorAll('input[data-in="op"]');
      assert.equal(current.length, entries.length);
      current.forEach((input, index) => assert.equal(input, inputs[index], 'native focus does not replace another form field'));
      assert.equal(sheet.classList.contains('kb'), false, 'the complete form remains in its ordinary layout');
      assert.equal(ui.node('#app').classList.contains('kb'), false);
    };
    ui.focus(entries[0][0], 'op');
    assertSameForm();
    assert.deepEqual(vertices(ui), camera, 'focusing a parameter does not move the drawing camera');
    for (const [index, [key, value]] of entries.entries()) {
      assert.equal(ui.activeInput().key, key);
      assert.equal(ui.node('#inputAccessory').hidden, index === entries.length - 1);
      ui.fill(key, value, 'op');
      if (index < entries.length - 1) next(ui);
      assertSameForm();
      if (index < entries.length - 1) assert.equal(ui.activeInput().key, entries[index + 1][0]);
    }
    assert.equal(ui.activeInput().key, entries.at(-1)[0]);
    assert.equal(ui.node('#inputAccessory').hidden, true);
    assert.equal(ui.node('#inputAccessory').innerHTML, '');
    assert.deepEqual(ui.save(), before, 'entering the last value does not apply the operation');
    assert.equal(formPointer(ui, 'apply').defaultPrevented, true);
    formPointer(ui, 'apply', 'click');
    const result = ui.save();
    assert.equal(ui.activeInput(), null);
    assert.equal(result.area, expectedArea);
    assert.equal(result.draw.ops.length, 1, 'Apply commits once without an intermediate review step');
  });
}

test('mobile panels: native quick-shape input keeps both original fields and waits for Build', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-rect');
  const sheet = ui.node('#sheet'), inputs = sheet.querySelectorAll('input[data-in="q"]');
  ui.focus('a', 'q');
  assert.equal(sheet.classList.contains('kb'), false);
  assert.equal(ui.node('#app').classList.contains('kb'), false);
  assert.equal(ui.node('#inputAccessory').hidden, false);
  ui.fill('a', '400', 'q');
  next(ui);
  assert.deepEqual(ui.activeInput(), { kind: 'q', key: 'b', value: '' });
  const current = sheet.querySelectorAll('input[data-in="q"]');
  assert.equal(current.length, 2);
  current.forEach((input, index) => assert.equal(input, inputs[index]));
  assert.equal(sheet.classList.contains('kb'), false);
  ui.fill('b', '300', 'q');
  assert.equal(ui.node('#inputAccessory').hidden, true);
  assert.equal(ui.node('#inputAccessory').innerHTML, '');
  assert.deepEqual(ui.activeInput(), { kind: 'q', key: 'b', value: '300' });
  assert.equal(ui.save(), undefined);
  assert.equal(formPointer(ui, 'quickBuild').defaultPrevented, true);
  formPointer(ui, 'quickBuild', 'click');
  const result = ui.save();
  assert.equal(ui.activeInput(), null);
  assert.equal(result.area, 12);
  assert.deepEqual(result.draw.ops, []);
});

test('mobile panels: sequential wall measurement still uses compact keyboard mode and focuses the selected side', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.click('back2');
  ui.selectSide(2);
  assert.deepEqual(ui.activeInput(), { kind: 'side', key: '2', value: '400' });
  assert.equal(ui.node('#sheet').classList.contains('kb'), true);
  assert.equal(ui.node('#app').classList.contains('kb'), true);
  assert.equal(ui.node('#inputAccessory').hidden, false);
  ui.fill(2, '400', 'side');
  next(ui);
  assert.deepEqual(ui.activeInput(), { kind: 'side', key: '3', value: '300' });
  assert.equal(ui.node('#sheet').classList.contains('kb'), true);
  assert.equal(ui.node('#app').classList.contains('kb'), true);
  assert.equal(ui.node('#inputAccessory').hidden, false, 'sequential wall measurements retain their final Done action');
  next(ui);
  assert.equal(ui.activeInput(), null);
  assert.equal(ui.node('#inputAccessory').hidden, true);
});

test('mobile panels: queued keyboard animation work is harmless after destroying the editor', t => {
  const ui = mount(t, createDrawEditor, rectangle, { ...mobile, manualRAF: true });
  ui.click('hole');
  ui.focus('d1', 'op');
  assert.ok(ui.pendingAnimationFrames() > 0);
  ui.destroy();
  assert.equal(ui.node('#app'), null);
  assert.doesNotThrow(() => ui.flushAnimationFrames(16, 3));
  assert.equal(ui.pendingAnimationFrames(), 0);
  assert.equal(ui.node('#app'), null, 'a delayed keyboard callback cannot recreate the destroyed interface');
});

test('mobile panels: cancelling a focused operation immediately closes its keyboard accessory without applying it', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile), before = ui.save();
  ui.click('hole');
  ui.focus('d1', 'op');
  ui.fill('d1', '100', 'op');
  assert.equal(ui.node('#inputAccessory').hidden, false);
  ui.click('cancel');
  assert.equal(ui.activeInput(), null);
  assert.equal(ui.node('#inputAccessory').hidden, true);
  assert.equal(ui.node('#app').classList.contains('kb'), false);
  assert.deepEqual(ui.save(), before);
});

test('mobile panels: cancelling a focused quick form closes its keyboard accessory without building a room', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-rect');
  ui.focus('a', 'q');
  ui.fill('a', '400', 'q');
  assert.equal(ui.node('#inputAccessory').hidden, false);
  ui.click('quickCancel');
  assert.equal(ui.activeInput(), null);
  assert.equal(ui.node('#inputAccessory').hidden, true);
  assert.equal(ui.node('#app').classList.contains('kb'), false);
  assert.equal(ui.save(), undefined);
});

for (const [operation, latest, expectedArea] of [['add', '150', 12], ['shift', '20', 12.8]]) {
  test(`mobile panels: the first Apply touch commits the latest focused ${operation} value exactly once`, t => {
    const ui = mount(t, createDrawEditor, rectangle, mobile);
    ui.selectSide(0);
    ui.click('op', { k: operation });
    ui.focus('d', 'op');
    ui.fill('d', '10', 'op');
    ui.fill('d', latest, 'op');
    const event = formPointer(ui, 'apply');
    assert.equal(event.defaultPrevented, true, 'the action runs before native blur can move its button');
    assert.equal(ui.activeInput(), null);
    assert.equal(ui.node('#inputAccessory').hidden, true);
    formPointer(ui, 'apply', 'click');
    const result = ui.save();
    assert.equal(result.area, expectedArea);
    assert.equal(result.draw.ops.length, 1);
    assert.equal(result.draw.ops[0].kind, operation);
    assert.equal(operation === 'add' ? result.draw.ops[0].d : result.draw.ops[0].off, Number(latest) / 100);
  });
}

test('mobile panels: an invalid first Apply touch keeps the focused field and immediately accepts a corrected retry', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  ui.focus('d', 'op');
  const field = ui.node('#sheet').querySelector('input[data-k="d"]');
  ui.fill('d', '0', 'op');
  formPointer(ui, 'apply');
  assert.deepEqual(ui.activeInput(), { kind: 'op', key: 'd', value: '0' });
  assert.equal(ui.node('#sheet').querySelector('input[data-k="d"]'), field);
  assert.match(ui.node('#toast').textContent, /Введите/);
  assert.equal(ui.finishCount(), 0);
  ui.fill('d', '20', 'op');
  formPointer(ui, 'apply');
  const result = ui.save();
  assert.equal(result.area, 12.8);
  assert.equal(result.draw.ops.length, 1, 'a new physical tap is not delayed by the compatibility-click guard');
});

test('mobile panels: a compatibility click retargeted to Finish cannot save, while keyboard and new physical taps still can', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  ui.focus('d', 'op');
  ui.fill('d', '20', 'op');
  formPointer(ui, 'apply');
  assert.equal(ui.finishCount(), 0);
  formPointer(ui, 'finish', 'click');
  assert.equal(ui.finishCount(), 0, 'the same touch cannot activate the new Finish button after the form disappears');
  ui.click('finish');
  assert.equal(ui.finishCount(), 1, 'a detail-zero keyboard click remains a deliberate save');
  formPointer(ui, 'finish');
  formPointer(ui, 'finish', 'click');
  assert.equal(ui.finishCount(), 2, 'a new pointerdown permits the next physical tap immediately');
  const result = ui.save();
  assert.equal(result.area, 12.8);
  assert.equal(result.draw.ops.length, 1);
});

test('mobile panels: an immediate second physical tap can save even when no compatibility click was emitted', t => {
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  ui.focus('d', 'op');
  ui.fill('d', '20', 'op');
  formPointer(ui, 'apply');
  formPointer(ui, 'finish');
  formPointer(ui, 'finish', 'click');
  assert.equal(ui.finishCount(), 1, 'the next pointerdown clears protection belonging to the previous touch');
  const result = ui.save();
  assert.equal(result.area, 12.8);
  assert.equal(result.draw.ops.length, 1);
});

test('mobile panels: holding Apply for more than a second cannot retarget its release click to Finish', t => {
  let now = 10_000;
  t.mock.method(Date, 'now', () => now);
  const ui = mount(t, createDrawEditor, rectangle, mobile);
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  ui.focus('d', 'op');
  ui.fill('d', '20', 'op');
  formPointer(ui, 'apply');
  now += 1_000;
  formPointer(ui, 'finish', 'click');
  assert.equal(ui.finishCount(), 0, 'a held touch still belongs to Apply until a new pointerdown occurs');
  const result = ui.save();
  assert.equal(result.area, 12.8);
  assert.equal(result.draw.ops.length, 1);
});

test('mobile panels: the first Build touch uses the current quick-form value and cannot also save the new drawing', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-rect');
  ui.fill('a', '400', 'q');
  ui.focus('b', 'q');
  ui.fill('b', '200', 'q');
  ui.fill('b', '300', 'q');
  assert.equal(formPointer(ui, 'quickBuild').defaultPrevented, true);
  assert.equal(ui.node('#app').dataset.stage, 3);
  assert.equal(ui.activeInput(), null);
  assert.equal(ui.finishCount(), 0);
  formPointer(ui, 'finish', 'click');
  assert.equal(ui.finishCount(), 0);
  const result = ui.save();
  assert.equal(result.area, 12);
  assert.deepEqual(result.draw.ops, []);
});

for (const quick of [false, true]) {
  test(`mobile panels: the first ${quick ? 'quick Cancel' : 'operation Cancel'} touch closes the form without a retargeted click acting`, t => {
    const ui = mount(t, createDrawEditor, quick ? undefined : rectangle, mobile);
    if (quick) ui.click('q-rect');
    else { ui.selectSide(0); ui.click('op', { k: 'shift' }); }
    ui.focus(quick ? 'a' : 'd', quick ? 'q' : 'op');
    ui.fill(quick ? 'a' : 'd', '20', quick ? 'q' : 'op');
    assert.equal(formPointer(ui, quick ? 'quickCancel' : 'cancel').defaultPrevented, true);
    assert.equal(ui.activeInput(), null);
    assert.equal(ui.node('#inputAccessory').hidden, true);
    assert.doesNotThrow(() => formPointer(ui, quick ? 'quickBuild' : 'finish', 'click'));
    assert.equal(ui.finishCount(), 0);
    if (quick) {
      assert.equal(ui.node('#app').dataset.stage, 0);
      assert.equal(ui.save(), undefined);
    } else {
      const result = ui.save();
      assert.equal(result.area, 12);
      assert.deepEqual(result.draw.ops, []);
    }
  });
}

test('embedded panels: pointerdown leaves the operation to the ordinary click handler', t => {
  const ui = mount(t, createDrawEditor, rectangle, { embedded: true });
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  ui.fill('d', '20', 'op');
  assert.equal(formPointer(ui, 'apply').defaultPrevented, false);
  assert.deepEqual(ui.activeInput(), { kind: 'op', key: 'd', value: '20' });
  assert.equal(ui.save().area, 12);
  formPointer(ui, 'apply', 'click');
  const result = ui.save();
  assert.equal(result.area, 12.8);
  assert.equal(result.draw.ops.length, 1);
});
