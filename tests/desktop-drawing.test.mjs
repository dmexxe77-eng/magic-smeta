import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './design-runtime.mjs';
import {openDrawingWorkspace, cancelDrawingWorkspace, finishDrawingWorkspace, goSection} from '../src/desktop/ui-actions.js';

const copy = value => JSON.parse(JSON.stringify(value));
const result = {
  name:'Рабочая комната', verts:[[0,0],[5,0],[5,4],[0,4]],
  holes:[[[1,1],[2,1],[2,2],[1,2]]], draw:null, area:19, perim:22,
};
const metadata = room => {
  const value = copy(room);
  for (const key of ['name','v','holes','draw']) delete value[key];
  return value;
};

async function setup() {
  const shared = await runtime();
  const engine = shared.component;
  const project = engine.state.projects.find(item => item.rooms.length);
  engine.openCalc(project.id);
  return {...shared, engine, project, room:project.rooms[0]};
}

test('cancelling an embedded drawing isolates draft vertices and leaves every project unchanged', async () => {
  const {engine, project, room} = await setup();
  engine.setState({desktopView:'calc'});
  const before = copy(engine.state.projects);
  openDrawingWorkspace(engine, room);
  const session = engine.state.drawingSession;
  assert.equal(engine.state.screen, 'drawing');
  assert.equal(session.projectId, project.id);
  assert.notEqual(session.initial.verts, room.v);
  session.initial.verts[0][0] = 999;
  assert.notEqual(room.v[0][0], 999);
  cancelDrawingWorkspace(engine, session);
  assert.equal(engine.state.screen, 'calc');
  assert.equal(engine.state.tab, room.id);
  assert.equal(engine.state.desktopView, 'calc');
  assert.equal(engine.state.drawingSession, null);
  assert.deepEqual(copy(engine.state.projects), before);
});

test('editing geometry preserves room presets, options and manual quantities while replacing cutouts', async () => {
  const {engine, room, mk} = await setup();
  const before = metadata(room);
  openDrawingWorkspace(engine, room);
  assert.equal(finishDrawingWorkspace(engine, engine.state.drawingSession, result, mk), true);
  const edited = engine.cur().rooms.find(item => item.id === room.id);
  assert.deepEqual(copy(edited.v), result.verts);
  assert.deepEqual(copy(edited.holes), result.holes);
  assert.deepEqual(metadata(edited), before);
  assert.equal(edited.name, result.name);
  assert.equal(engine.state.screen, 'calc');
  assert.equal(engine.state.tab, room.id);
  assert.equal(engine.state.desktopView, 'calc');
  assert.equal(engine.state.drawingSession, null);
});

test('creating a drawing uses shared room defaults and selects it for calculation', async () => {
  const {engine, project, mk, BLOCKS} = await setup();
  engine.upd(project.id, item => ({...item, status:'order'}));
  engine.go('addRoom');
  const before = engine.cur().rooms.length;
  openDrawingWorkspace(engine, null);
  assert.equal(finishDrawingWorkspace(engine, engine.state.drawingSession, result, mk), true);
  const created = engine.cur().rooms.find(item => item.id === engine.state.tab);
  assert.equal(engine.cur().rooms.length, before + 1);
  assert.equal(engine.cur().status, 'estimate');
  assert.equal(created.name, result.name);
  assert.equal(created.on, true);
  assert.equal(created.canvas.pid, BLOCKS.find(block => block.id === 'canvas').def);
  assert.equal(created.main.pid, BLOCKS.find(block => block.id === 'main').def);
  assert.deepEqual(copy(created.holes), result.holes);
  assert.equal(engine.state.screen, 'calc');
});

test('global navigation rejects stale completion and cannot cancel a later drawing', async () => {
  const {engine, room, mk} = await setup();
  openDrawingWorkspace(engine, room);
  const stale = engine.state.drawingSession;
  const before = copy(engine.state.projects);
  goSection(engine, 'home');
  assert.equal(engine.state.drawingSession, null);
  assert.equal(finishDrawingWorkspace(engine, stale, result, mk), false);
  cancelDrawingWorkspace(engine, stale);
  assert.equal(engine.state.screen, 'home');
  assert.deepEqual(copy(engine.state.projects), before);
  engine.openCalc(stale.projectId);
  openDrawingWorkspace(engine, room);
  const current = engine.state.drawingSession;
  cancelDrawingWorkspace(engine, stale);
  assert.equal(engine.state.drawingSession.id, current.id);
  assert.equal(engine.state.screen, 'drawing');
});

test('a room from another project cannot start a drawing in the current project', async () => {
  const {engine, project} = await setup();
  const foreign = engine.state.projects.find(item => item.id !== project.id && item.rooms.length).rooms[0];
  openDrawingWorkspace(engine, foreign);
  assert.equal(engine.state.screen, 'calc');
  assert.equal(engine.state.drawingSession, undefined);
  assert.equal(engine.cur().id, project.id);
});
