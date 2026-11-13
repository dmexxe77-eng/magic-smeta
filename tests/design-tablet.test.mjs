import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { transformSync } from 'esbuild';
import { tabletTemplate, tabletManifest } from '../scripts/design-tablet.mjs';
import { runtime, readTemplate } from './design-runtime.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const frameIds = ['579a812e-09ed-4302-a874-ad590f1da99b', 'ce809192-a77c-4dc8-8d46-461e2371d098'];
const manifestFrom = file => JSON.parse(fs.readFileSync(file, 'utf8').match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const decode = entry => (entry.compressed ? gunzipSync(Buffer.from(entry.data, 'base64')) : Buffer.from(entry.data, 'base64')).toString('utf8');

for (const [width, height, tablet, twoColumns] of [[390, 844, false, false], [699, 900, false, false], [700, 900, false, false], [701, 900, true, false], [834, 1194, true, false], [1000, 800, true, true], [1366, 1024, true, true]]) {
  test(`tablet app: ${width}×${height} uses actual viewport dimensions and the matching content layout`, async () => {
    const { component: app } = await runtime({ viewport: { width, height } });
    app.props = { ...app.props, platform: width < 701 ? 'ipad' : 'ios' };
    app.go('calc', { curId: app.state.projects.find(project => project.rooms.length)?.id });
    const values = app.renderVals();
    assert.equal(values.frameW, width);
    assert.equal(values.frameH, height);
    assert.equal(values.statusPad, 0);
    assert.equal(values.bottomPad, 0);
    assert.equal(values.homeCols, tablet ? '1fr 1fr' : '1fr');
    assert.equal(values.roomCardPos, twoColumns ? 'sticky' : 'static');
    assert.equal(values.calcCols.split(' ').filter(part => part === '300px').length, Number(twoColumns));
    assert.ok(values.sidePad >= 16 && values.headPad >= 12, 'narrow tablet widths do not produce negative gutters');
    assert.equal(values.sheetW, tablet ? 560 : 2000);
  });
}

test('tablet app: orientation changes preserve the active project, room, screen, sheet and unfinished project form', async () => {
  const r = await runtime({ viewport: { width: 834, height: 1194, visualHeight: 1194 } }), app = r.component;
  app.componentDidMount();
  const project = app.state.projects.find(value => value.rooms.length), room = project.rooms[0];
  app.go('calc', { curId: project.id, tab: room.id });
  app.setState({ sheet: 'export', nf: { name: 'Черновик', client: 'Иван', phone: '123', designer: '', address: 'Дом', notes: 'Не терять' }, exp: { ...app.state.exp, pct: 17 }, editBuf: '450' });
  const state = copy(app.state), projects = app.state.projects, form = app.state.nf;
  for (const [width, height] of [[1280, 800], [834, 1194], [1194, 834]]) {
    r.resize(width, height);
    assert.equal(app.renderVals().frameW, width);
    assert.equal(app.renderVals().frameH, height);
    assert.equal(app.state.projects, projects, 'orientation changes do not reload or replace projects');
    assert.equal(app.state.nf, form, 'the existing form object and its entered values remain mounted');
    assert.deepEqual(copy({ ...app.state, designViewport: null }), { ...state, designViewport: null });
  }
  r.visualResize(500);
  assert.equal(app.renderVals().frameH, 500, 'the actual visual viewport can shrink independently for native input');
  assert.equal(app.state.screen, 'calc');
  assert.equal(app.state.sheet, 'export');
  app.componentWillUnmount();
});

test('tablet app: resizing an open preset draft preserves its edits while persistence still saves the original until Save', async () => {
  const r = await runtime({ viewport: { width: 834, height: 1194 } }), app = r.component;
  app.componentDidMount();
  const original = r.PRESETS.canvas[0].name;
  app.go('btnEd', { be: { bid: 'canvas', pid: r.PRESETS.canvas[0].id, from: 'account' } });
  app.beVals().beSetName({ target: { value: 'Планшетный черновик' } });
  const draft = app._presetDraft, state = copy(app.state);
  r.resize(1194, 834);
  assert.equal(app._presetDraft, draft);
  assert.equal(app.beVals().beName, 'Планшетный черновик');
  assert.deepEqual(copy({ ...app.state, designViewport: null }), { ...state, designViewport: null });
  app.saveDesign();
  const saved = JSON.parse(r.entries.get('zamer.design.v1'));
  assert.equal(saved.presets.canvas[0].name, original);
  assert.equal('designViewport' in saved, false, 'viewport dimensions do not become project data');
  app.presetEditorVals().peSave();
  assert.equal(JSON.parse(r.entries.get('zamer.design.v1')).presets.canvas[0].name, 'Планшетный черновик');
  app.componentWillUnmount();
});

test('tablet app: viewport listeners are detached on unmount and late resize cannot change the former component', async () => {
  const r = await runtime({ viewport: { width: 834, height: 1194, visualHeight: 1100 } }), app = r.component;
  app.componentDidMount();
  assert.equal(r.listenerCount('resize'), 1);
  assert.equal(r.listenerCount('resize', 'visual'), 1);
  assert.equal(app.renderVals().frameH, 1100);
  const before = copy(app.state);
  app.componentWillUnmount();
  assert.equal(r.listenerCount('resize'), 0);
  assert.equal(r.listenerCount('resize', 'visual'), 0);
  r.resize(1366, 1024);
  r.visualResize(900);
  assert.deepEqual(copy(app.state), before);
});

test('tablet app: absent or invalid viewport values retain safe phone dimensions', async () => {
  for (const viewport of [undefined, { width: 0, height: NaN }, { width: Infinity, height: -100 }]) {
    const { component: app } = await runtime({ viewport });
    const values = app.renderVals();
    assert.equal(values.frameW, 402);
    assert.equal(values.frameH, 874);
  }
});

test('tablet template: the generated app has one explicit overlay stage and retains its business actions and local fonts', () => {
  const template = readTemplate();
  assert.equal((template.match(/<div\b[^>]*data-zamer-app-stage\b[^>]*>/g) || []).length, 1);
  for (const screen of ['home', 'dash', 'calendar', 'project', 'new', 'proj-fin', 'calc', 'opt-ed', 'new-block', 'btn-ed', 'add-room', 'manual', 'account', 'nom-ed', 'profile', 'nom-item', 'analytics', 'nom-picker']) {
    const roots = template.match(new RegExp(`<div\\b[^>]*data-zamer-screen="${screen}"[^>]*>`, 'g')) || [];
    assert.equal(roots.length, 1, screen);
    const opening = roots[0];
    assert.ok(opening?.match(/class="([^"]*)"/)?.[1].split(/\s+/).includes('z-screen'), `${screen}: the screen root owns its layout class`);
  }
  const navigation = [...template.matchAll(/<div\b[^>]*class="([^"]*)"[^>]*>/g)].filter(([, classes]) => classes.split(/\s+/).includes('z-main-nav'));
  assert.equal(navigation.length, 4);
  navigation.forEach(([, classes]) => assert.ok(!classes.split(/\s+/).includes('z-screen'), 'navigation cannot be mistaken for an entire screen'));
  assert.match(template, /@font-face/);
  for (const action of ['arManual', 'arTrace', 'pContract', 'expEC', 'nfSet', 'saveDesign', 'peSave']) assert.ok(template.includes(action), `${action} remains available after the layout transformation`);
  assert.match(template, /<style data-zamer-tablet>/);
});

test('tablet template: malformed or already transformed sources fail exact-anchor guards', () => {
  assert.throws(() => tabletTemplate('<html><head></head><body></body></html>', ''), /tablet: expected 1 matches, got 0/);
  assert.throws(() => tabletTemplate(readTemplate(), ''), /tablet: expected 1 matches, got 0/);
});

test('tablet manifest: only the two device resources change and their JSX remains valid', () => {
  const original = manifestFrom('design-src/prototype.html'), snapshot = copy(original), transformed = tabletManifest(original);
  assert.deepEqual(original, snapshot, 'the original resource manifest is not mutated');
  assert.deepEqual(Object.keys(transformed), Object.keys(original));
  assert.deepEqual(Object.keys(transformed).filter(id => transformed[id].data !== original[id].data), frameIds);
  for (const [id, entry] of Object.entries(original)) {
    if (!frameIds.includes(id)) assert.deepEqual(transformed[id], entry, 'non-frame resources remain byte-identical');
    else {
      assert.deepEqual({ ...transformed[id], data: '' }, { ...entry, data: '' });
      const jsx = decode(transformed[id]);
      assert.match(jsx, /data-zamer-device-frame/);
      assert.match(jsx, /data-zamer-frame-content/);
      assert.match(jsx, /data-zamer-frame-chrome/);
      assert.doesNotThrow(() => transformSync(jsx, { loader: 'jsx', format: 'esm' }));
    }
  }
});

test('tablet manifest: generated resources contain the transformed frames and preserve every unrelated resource', () => {
  const original = manifestFrom('design-src/prototype.html'), nativePath = fs.existsSync('public/design/app.html') ? 'public/design/app.html' : 'public/design/index.html';
  const generated = manifestFrom(nativePath), expected = tabletManifest(original);
  assert.deepEqual(generated, expected);
});

test('tablet manifest: missing device resources are rejected rather than publishing a partially framed app', () => {
  const original = manifestFrom('design-src/prototype.html');
  for (const id of frameIds) {
    const missing = { ...original }; delete missing[id];
    assert.throws(() => tabletManifest(missing), /tablet: missing device resource/);
  }
});
