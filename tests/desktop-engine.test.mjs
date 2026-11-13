import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { roomDrawingPreview } from '../src/design-bridge/room-drawing-preview.js';
import { runtime as mobileRuntime } from './design-runtime.mjs';
import { DCLogic, createDesktopStorage, desktopToday, desktopDisplayDate, desktopPeriodStart, desktopTodayLabel } from '../src/desktop/engine-base.js';
import { openProjectCalculation, projectValues, goSection, reconcileInstallationStatus } from '../src/desktop/ui-actions.js';
import {nomKey, resolveNom, withEstimateImages} from '../src/desktop/nomenclature-identity.js';
import {instanceLines as desktopInstanceLines} from '../src/desktop/quantity-adapter.js';
import {createDesktopDesignStorage, desktopMigrationMetadata} from '../src/desktop/desktop-storage.js';
import * as projectCatalog from '../src/desktop/project-catalog.js';
import { estimatePresetTemplate } from '../src/utils/estimate-template.js';

const copy = value => JSON.parse(JSON.stringify(value));
const fixedDate = new Date(2026, 10, 1, 12);

async function desktopRuntime({ mobileSaved, desktopSaved, mainDataPatch } = {}) {
  const entries = new Map();
  if (mobileSaved) entries.set('zamer.design.v1', mobileSaved);
  if (desktopSaved) entries.set('zamer.desktop.v1', desktopSaved);
  const localStorage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
  const timers = new Map();
  let timerId = 0;
  const ctx = vm.createContext({
    ...projectCatalog,
    DCLogic, createDesktopStorage: () => createDesktopStorage(() => localStorage), createDesktopDesignStorage, desktopMigrationMetadata,
    nomKey, resolveNom, withEstimateImages, desktopInstanceLines,
    desktopToday: () => desktopToday(fixedDate), desktopDisplayDate: () => desktopDisplayDate(fixedDate),
    desktopPeriodStart: period => desktopPeriodStart(period, fixedDate), desktopTodayLabel: () => desktopTodayLabel(fixedDate),
    console, localStorage, MagicDraw: { preview: roomDrawingPreview }, setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id), requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    document: { querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible' },
    addEventListener: () => {}, removeEventListener: () => {},
  });
  vm.runInContext('window=globalThis;', ctx);
  for (const file of ['main-data.js', 'quantity.js', 'storage.js', 'estimate.js']) {
    vm.runInContext(fs.readFileSync('public/design/' + file, 'utf8'), ctx);
  }
  if (mainDataPatch) Object.assign(ctx.MAGIC_MAIN, mainDataPatch(ctx.MAGIC_MAIN));
  const generated = fs.readFileSync('src/desktop/generated/mobile-engine.js', 'utf8');
  const script = generated.replace(/^import .*?;\n/gm, '').replace(/^export \{.*?\};\n/m, '');
  vm.runInContext(script + '\n;globalThis.testAPI={MobileEngine:Component,BLOCKS,PRESETS,NOM,ROOM_OPTS,geom,est,mk,F,RUB,STATUSES,ST,uid,PR,quantityGeom};', ctx);
  return { ...ctx.testAPI, ctx, entries, timers, component: new ctx.testAPI.MobileEngine() };
}

test('desktop shared engine retains every mobile project estimate exactly', async () => {
  const mobile = await mobileRuntime(), desktop = await desktopRuntime();
  assert.equal(desktop.component.state.screen, 'home');
  assert.equal(desktop.component.props.platform, 'ipad');
  const arithmetic = value => JSON.parse(JSON.stringify(value,(key,item)=>['calculationSnapshotVersion','catalogSnapshot','presetSnapshot','_photoFrozen','photoRemoved','imageUrl','img'].includes(key)?undefined:item));
  assert.deepEqual(arithmetic(desktop.component.state.projects), arithmetic(mobile.component.state.projects));
  for (const project of desktop.component.state.projects) {
    const mobileProject = mobile.component.state.projects.find(p => p.id === project.id);
    assert.deepEqual(arithmetic(desktop.est(project.rooms, desktop.component.ed(project.id))), arithmetic(mobile.est(mobileProject.rooms, mobile.component.ed(project.id))), project.name);
  }
});

test('document company settings use the shared form and keep desktop addresses separate from phone data', async () => {
  const r = await desktopRuntime(), app = r.component;
  r.entries.set('zamer.contractTpl', JSON.stringify({ head: { company: 'Телефонная компания' } }));
  app.setState({ profile: {}, contractTemplate: { head: { company: 'Компания desktop' } } });
  let templateOptions, accountOptions, saved = 0;
  r.ctx.MagicContract = { openTemplate: options => { templateOptions = options; return { close() {} }; } };
  r.ctx.MagicDocuments = { openAccountSettings: options => { accountOptions = options; return { close() {} }; } };
  app.saveDesign = () => { saved++; return true; };
  app.openContractTpl();
  assert.equal(templateOptions.company.company, 'Компания desktop');
  templateOptions.onEditCompany();
  assert.equal(accountOptions.profile.company, 'Компания desktop');
  await accountOptions.onChange({ companyAddress: 'Офис, 10', address: 'Юридический адрес, 20' });
  assert.equal(saved, 1);
  assert.equal(app.state.profile.companyAddress, 'Офис, 10');
  assert.equal(app.state.profile.address, 'Юридический адрес, 20');
  accountOptions.onClose();
  assert.equal(templateOptions.company.companyAddress, 'Офис, 10');
  assert.equal(templateOptions.company.address, 'Юридический адрес, 20');
  assert.equal(JSON.parse(r.entries.get('zamer.contractTpl')).head.company, 'Телефонная компания');
});

test('a rejected document company save restores the previous desktop profile', async () => {
  const r = await desktopRuntime(), app = r.component;
  app.setState({ profile: { company: 'Сохранённая компания', address: 'Юр. адрес' } });
  let options;
  r.ctx.MagicDocuments = { openAccountSettings: value => { options = value; return { close() {} }; } };
  app.saveDesign = () => false;
  app.openDocumentCompany();
  await assert.rejects(options.onChange({ company: 'Несохранённая компания' }), /Не удалось сохранить/);
  assert.equal(app.state.profile.company, 'Сохранённая компания');
  assert.equal(app.state.profile.address, 'Юр. адрес');
});

test('desktop estimate appearance saves through the shared company profile and returns from company settings', async () => {
  const r = await desktopRuntime(), app = r.component;
  app.setState({ profile: { company: 'Компания desktop' }, contractTemplate: { head: { company: 'Резервное имя' } } });
  r.entries.set('zamer.contractTpl', JSON.stringify({ head: { company: 'Телефонная компания' } }));
  let header, account, writes = 0;
  r.ctx.MagicDocuments = {
    openEstimateHeader: options => { header = options; return { close() {} }; },
    openAccountSettings: options => { account = options; return { close() {} }; },
  };
  app.saveDesign = () => { writes++; return true; };
  app.openEstimateHeader();
  assert.equal(header.company.company, 'Компания desktop');
  await header.onCompanyChange({ estimateTemplate: estimatePresetTemplate('modern'), logo: '' });
  assert.equal(writes, 1);
  assert.equal(app.documentCompanyDetails().estimateTemplate.background, estimatePresetTemplate('modern').background);
  header.onEditCompany();
  assert.equal(account.profile.company, 'Компания desktop');
  await account.onChange({ companyAddress: 'Офис, 10' });
  account.onClose();
  assert.equal(header.company.companyAddress, 'Офис, 10');
  assert.equal(header.company.estimateTemplate.background, estimatePresetTemplate('modern').background);
  assert.equal(JSON.parse(r.entries.get('zamer.contractTpl')).head.company, 'Телефонная компания');
});

test('document company settings await durable storage and roll back an asynchronous refusal', async () => {
  const r = await desktopRuntime(), app = r.component;
  app.setState({ profile: { company: 'Сохранённая компания' } });
  let options, writes = 0, finish;
  r.ctx.MagicDocuments = { openAccountSettings: value => { options = value; return { close() {} }; } };
  app.saveDesign = () => { writes++; return true; };
  app._persistenceKey = 'desktop-company';
  app._persistence = { flush: key => { assert.equal(key, 'desktop-company'); return new Promise(resolve => { finish = resolve; }); } };
  app.openDocumentCompany();
  let settled = false;
  const save = options.onChange({ company: 'Несохранённая компания' });
  save.then(() => { settled = true; }, () => { settled = true; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(typeof finish, 'function');
  finish(false);
  await assert.rejects(save, /Не удалось сохранить/);
  assert.equal(app.state.profile.company, 'Сохранённая компания');
  assert.equal(writes, 2, 'rollback replaces the rejected snapshot with the previous profile');
});

test('switching projects through estimate always edits a room of the selected project', async () => {
  const desktop = await desktopRuntime(), app = desktop.component;
  const [first, second] = app.state.projects.filter(project => project.rooms.length);
  app.openCalc(first.id);
  const oldRoom = app.state.tab;
  app.openProject(second.id);
  // Also covers a restored UI selection left over from an earlier project.
  app.setState({ tab:oldRoom });
  openProjectCalculation(app, 'estimate');
  assert.equal(app.state.tab, second.rooms[0].id);
  assert.equal(app.state.desktopView, 'estimate');
  openProjectCalculation(app);
  const before = app.cur().rooms[0].canvas.qtyO;
  app.calcVals().blocks[0].inc();
  assert.notEqual(app.cur().rooms[0].canvas.qtyO, before);
  assert.equal(app.state.curId, second.id);
  app.go('calc', { sheet:'status' });
  assert.equal(projectValues(app).steps.length, 7);
  assert.ok(projectValues(app).steps.some(step => step.label === 'На согласовании'));
  assert.equal(projectValues(app).projMenu.length, 3);
  assert.equal(app.state.screen, 'calc', 'reading dialog values preserves the route');
});

test('leaving a preset draft rolls back nomenclature, options and linked estimate edits', async () => {
  const desktop = await desktopRuntime(), app = desktop.component;
  const before = copy(app.designSnapshot());
  app.go('btnEd', { be:{bid:'canvas',pid:desktop.PRESETS.canvas[0].id,brand:'all',from:'home'} });
  desktop.NOM[0].p = 987654;
  desktop.ROOM_OPTS[0].p = 12345;
  app.setState({ estEd:{ changed:{ line:{q:7,p:12} } } });
  app.beVals().beSetName({ target:{value:'Несохранённый пресет'} });
  goSection(app, 'home');
  assert.equal(app._presetDraft, null);
  assert.deepEqual(copy(app.designSnapshot()), before);
  app.go('new', { nf:{name:'После отмены',client:'',designer:'',phone:'',address:'',notes:''} });
  app.newVals().nfCreate();
  assert.equal(app.saveDesign(), true);
  const restored = await desktopRuntime({ desktopSaved:desktop.entries.get('zamer.desktop.v1') });
  assert.ok(restored.component.state.projects.some(project => project.name === 'После отмены'));
});

test('desktop group percentages survive switching, storage and the shared export renderer', async () => {
  const desktop = await desktopRuntime(), app = desktop.component;
  const project = app.state.projects.find(item => item.rooms.length), other = app.state.projects.find(item => item.id !== project.id);
  const otherAdjustment = copy(other.estimateAdjustment ?? null);
  app.openCalc(project.id);
  for (const [scope, value] of [['mats', '-5'], ['works', '10'], ['equipment', '-10']]) {
    app.setEstimateAdjustment(project.id, { scope });
    app.setState({ estimatePctBuffers: { [project.id]: value } });
    app.commitEstimatePercent(project.id);
  }
  app.setEstimateAdjustment(project.id, { scope: 'all' });
  const adjustment = app.cur().estimateAdjustment;
  assert.deepEqual(copy(adjustment.rates), { mats: -5, works: 10, equipment: -10 });
  assert.equal(adjustment.percent, 0, 'mixed groups have no single whole-estimate rate');
  const totals = app.estimateTotals(app.cur(), { mt: 10000, wt: 20000, et: 5000 });
  assert.equal(totals.adjustedTotal, 36000);
  assert.equal(totals.hasAdjustment, true);
  const html = desktop.ctx.MagicEstimate.estimateHtml({
    project: app.cur(), adjustment,
    est: { mats: [{ n: 'Материал', q: 1, p: 10000, t: 10000, u: 'шт' }], works: [{ n: 'Работа', q: 1, p: 20000, t: 20000, u: 'шт' }], equipment: [{ n: 'Оборудование', q: 1, p: 5000, t: 5000, u: 'шт' }] },
  });
  assert.match(html, /Скидка на материалы −5%/);
  assert.match(html, /Наценка на работы \+10%/);
  assert.match(html, /Скидка на оборудование −10%/);
  assert.match(html, /data-estimate-grand-total>36\s*000/);
  assert.deepEqual(copy(other.estimateAdjustment ?? null), otherAdjustment);
  app.saveDesign();
  const restored = await desktopRuntime({ desktopSaved: desktop.entries.get('zamer.desktop.v1') });
  assert.deepEqual(copy(restored.component.state.projects.find(item => item.id === project.id).estimateAdjustment.rates), { mats: -5, works: 10, equipment: -10 });
});

test('a discount remains a text draft until committed and accepts a decimal minus value', async () => {
  const desktop = await desktopRuntime(), app = desktop.component;
  app.openCalc(app.state.projects.find(project => project.rooms.length).id);
  const id = app.cur().id;
  app.setState({estimatePctBuffers:{[id]:'-'}});
  assert.equal(app.state.estimatePctBuffers[id], '-');
  app.setState({estimatePctBuffers:{[id]:'-12,5'}});
  app.commitEstimatePercent(id);
  assert.equal(app.cur().estimateAdjustment.percent, -12.5);
});

test('moving a started installation into the future reconciles only the changed project', async () => {
  const desktop = await desktopRuntime(), app = desktop.component;
  const project = app.state.projects[0], other = app.state.projects[1];
  app.upd(project.id, item => ({ ...item, status:'install', installs:[{id:'stage',date:'2026-11-01',days:1,time:'09:00'}] }));
  const otherStatus = other.status;
  app.openEvent(project.id, { kind:'Монтаж', sid:'stage' });
  app.setState({ inst:{...app.state.inst,date:'2026-11-07',month:'2026-11'} });
  app.installVals().inSave();
  reconcileInstallationStatus(app, project.id, '2026-11-01');
  assert.equal(app.state.projects.find(item => item.id === project.id).status, 'contract');
  assert.equal(app.state.projects.find(item => item.id === other.id).status, otherStatus);
  reconcileInstallationStatus(app, project.id, '2026-11-07');
  assert.equal(app.state.projects.find(item => item.id === project.id).status, 'install');
});

test('desktop overrides remain final values across norms, packaging and other instances', async () => {
  const desktop = await desktopRuntime(), app = desktop.component;
  const project = app.state.projects.find(p => p.rooms.length), room = project.rooms[0];
  const preset = { id: 'manual_test', name: 'Проверка', items: [{ n: 'Тестовый профиль', p: 100, u: 'м.п.', m: 1, k: 2, mult: 3 }] };
  desktop.PRESETS.extra.push(preset);
  room.extra = [{ id: 'first', pid: preset.id, qty: 3, iq: { 'Тестовый профиль': 5 } }, { id: 'second', pid: preset.id, qty: 5 }];
  app.openCalc(project.id);
  const instances = app.calcVals().blocks.find(block => block.id === 'extra').insts;
  instances[0].inc();
  const estimate = desktop.est(app.cur().rooms, {});
  const line = estimate.mats.find(item => item.n === 'Тестовый профиль');
  assert.equal(app.cur().rooms[0].extra[0].qty, 3.5);
  assert.equal(app.cur().rooms[0].extra[0].iq['Тестовый профиль'], 5);
  assert.equal(app.cur().rooms[0].extra[1].qty, 5);
  assert.equal(line.q, 17, '5 final override + ceil(5 × norm 2 / pack 3) × 3');
  const edited = desktop.est(app.cur().rooms, { [line.k]: { q: 0, p: 321 } }).mats.find(item => item.k === line.k);
  assert.equal(edited.q, 0);assert.equal(edited.p, 321);assert.equal(edited.t, 0);
});

test('desktop seeds mobile data once and saves equipment, profile and manual edits independently', async () => {
  const original = await desktopRuntime(), app = original.component;
  const project = app.state.projects.find(p => p.rooms.length), room = project.rooms[0];
  const equipment = { n: 'Desktop controller', p: 1200, u: 'шт', m: 1, category: 'equipment', br: 'Тест' };
  original.NOM.push(equipment);
  room.extraItems = [{ ...equipment, id: 'controller', qty: 2 }];
  app.setState({ profile: { company: 'Компания desktop' }, estEd: { [project.id]: { [equipment.n]: { q: 3, p: 1300 } } } });
  assert.equal(app.saveDesign(), true);
  const mobileSaved = original.entries.get('zamer.desktop.v1');
  const seeded = await desktopRuntime({ mobileSaved });
  const seededProject = seeded.component.state.projects.find(p => p.id === project.id);
  assert.equal(seeded.est(seededProject.rooms, seeded.component.ed(project.id)).equipment.find(l => l.n === equipment.n).t, 3900);
  seeded.component.upd(project.id, p => ({ ...p, name: 'Desktop change' }));
  assert.equal(seeded.component.saveDesign(), true);
  assert.equal(seeded.entries.get('zamer.design.v1'), mobileSaved, 'desktop never overwrites the mobile snapshot');
  const restored = await desktopRuntime({ mobileSaved, desktopSaved: seeded.entries.get('zamer.desktop.v1') });
  assert.equal(restored.component.state.projects.find(p => p.id === project.id).name, 'Desktop change');
  assert.equal(restored.component.state.profile.company, 'Компания desktop');
  assert.equal(restored.NOM.find(n => n.n === equipment.n).category, 'equipment');
  assert.equal(restored.est(restored.component.state.projects.find(p => p.id === project.id).rooms, restored.component.ed(project.id)).equipment.find(l => l.n === equipment.n).t, 3900);
});

test('rendering imported historical projects never changes their statuses', async () => {
  const desktop = await desktopRuntime(), app = desktop.component;
  const before = copy(app.state.projects.map(p => [p.id, p.status]));
  for (const screen of ['home', 'dash', 'calendar', 'analytics']) { app.go(screen);app.renderVals(); }
  assert.deepEqual(copy(app.state.projects.map(p => [p.id, p.status])), before);
  assert.equal(desktop.timers.size, 0, 'rendering does not schedule status migration');
});

test('new project callback opens it and live dates drive calendars and finance', async () => {
  const desktop = await desktopRuntime(), app = desktop.component;
  app.go('new', { nf: { name: 'Сегодня', client: '', designer: '', phone: '', address: '', notes: '' } });
  app.newVals().nfCreate();
  assert.equal(app.state.screen, 'project');
  assert.equal(app.cur().name, 'Сегодня');assert.equal(app.cur().date, '01.11.2026');
  app.projectVals().finIn();app.projectVals().finSetSum({ target: { value: '500' } });app.projectVals().finSave();
  assert.equal(app.cur().ops[0].date, '01.11');
  app.go('calendar');assert.ok(app.calendarVals().calMonthTitle.toLowerCase().includes('ноябрь'));
  app.go('dash');assert.match(app.dashVals().dTodaySub, /1 ноября/);
  assert.doesNotMatch(fs.readFileSync('src/desktop/generated/mobile-engine.js', 'utf8'), /2026-09-06|20260805|20260605|20250905/);
});

test('state host is synchronous, notifies subscribers and schedules one lifecycle update', async () => {
  const host = new DCLogic();host.state = { count: 0 };
  let notifications = 0, updates = 0, callbackValue;
  host.componentDidUpdate = () => { updates += 1; };
  host.mount();const unsubscribe = host.subscribe(() => { notifications += 1; });
  host.setState(state => ({ count: state.count + 1 }), function () { callbackValue = this.state.count; });
  host.setState({ extra: true });
  assert.equal(host.state.count, 1);assert.equal(callbackValue, 1);
  assert.equal(notifications, 2);assert.equal(host.getSnapshot(), 2);assert.equal(updates, 0);
  await Promise.resolve();assert.equal(updates, 1);
  unsubscribe();host.setState({ count: 2 });assert.equal(notifications, 2);host.unmount();
});

test('date helpers retain local dates and clamp rolling months', () => {
  assert.equal(desktopToday(new Date(2026, 10, 1)), '2026-11-01');
  assert.equal(desktopDisplayDate(new Date(2026, 10, 1)), '01.11.2026');
  assert.equal(desktopPeriodStart('month', new Date(2026, 2, 31)), '20260228');
  assert.equal(desktopPeriodStart('quarter', new Date(2026, 10, 1)), '20260801');
  assert.equal(desktopPeriodStart('year', new Date(2024, 1, 29)), '20230228');
});
