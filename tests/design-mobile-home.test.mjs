import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, readTemplate } from './design-runtime.mjs';

test('native home keeps menu and account buttons at the top and links to live sections', async () => {
  const r = await runtime(), app = r.component;
  app.go('dash');
  let values = app.mobileHomeVals();
  assert.equal(values.mhMenuOpen, false);
  values.mhOpenMenu();
  values = app.mobileHomeVals();
  assert.equal(values.mhMenuOpen, true);
  values.mhMenuGroups.flatMap(group => group.items).find(row => row.label === 'Проекты').pick();
  assert.equal(app.state.screen, 'home');
  assert.equal(app.state.mobileMenuOpen, false);
  assert.equal(app.state.filter, 'all');
  app.go('dash');
  app.mobileHomeVals().mhMenuAccount();
  assert.equal(app.state.screen, 'account');
  assert.match(readTemplate(), /aria-label="Открыть меню"/);
  assert.match(readTemplate(), /data-mobile-menu role="dialog"/);
});

test('home drawer opens both document editors and uses actual recent projects and totals', async () => {
  const r = await runtime(), app = r.component;
  let contract = 0, header = 0;
  app.openContractTpl = () => contract++;
  app.openEstimateHeader = () => header++;
  app.go('dash');
  const values = app.mobileHomeVals(), rows = values.mhMenuGroups.flatMap(group => group.items);
  rows.find(row => row.label === 'Шаблон договора').pick();
  rows.find(row => row.label === 'Шапка сметы').pick();
  assert.equal(contract, 1);
  assert.equal(header, 1);
  assert.equal(values.mhProjects.length, Math.min(5, app.state.projects.length));
  assert.equal(values.mhStats.find(row => row.label === 'В работе').value,
    String(app.state.projects.filter(p => ['contract', 'install'].includes(p.status)).length));
  values.mhProjects[0].open();
  assert.equal(app.state.screen, 'project');
  assert.equal(app.state.curId, values.mhProjects[0].id);
});

test('home shows current upcoming events and opens their existing event editor', async () => {
  const r = await runtime(), app = r.component;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Vladivostok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const project = { ...app.state.projects[0], installs: [], installDate: null, events: [
    { id: 'current-measure', kind: 'Замер', date: today, time: '12:00' },
    { id: 'historical-measure', kind: 'Замер', date: '2020-01-01', time: '12:00' },
  ] };
  app.setState({ projects: [project], screen: 'dash' });
  let opened;
  app.openEvent = (pid, event) => { opened = { pid, event }; };
  const values = app.mobileHomeVals();
  assert.equal(values.mhEvents.length, 1);
  assert.equal(values.mhEvents[0].when, 'сегодня · 12:00');
  values.mhEvents[0].open();
  assert.equal(opened.pid, project.id);
  assert.equal(opened.event.id, 'current-measure');
});

test('home keeps an ongoing installation visible today and labels a zero-price estimate as calculated', async () => {
  const r = await runtime(), app = r.component;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Vladivostok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const original = app.state.projects.find(project => project.rooms.length);
  const project = { ...original, estimateAdjustment: { scope: 'all', percent: -100 }, events: [],
    installs: [{ id: 'ongoing-install', date: app.addDays(today, -1), time: '09:00', days: 3 }] };
  app.setState({ projects: [project], screen: 'dash' });
  const values = app.mobileHomeVals();
  assert.equal(values.mhEvents.length, 1);
  assert.equal(values.mhEvents[0].date, today);
  assert.equal(values.mhEvents[0].first, false);
  assert.equal(values.mhProjects[0].sum, '0 ₽');
});
