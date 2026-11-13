import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, readTemplate } from './design-runtime.mjs';

test('native account contains only the original four actions and opens actual destinations', async () => {
  const r = await runtime(), app = r.component;
  app.go('account');
  let settings = 0, destination;
  app.openAccountSettings = () => { settings++; };
  r.ctx.MagicDocuments = { openMenuDestination: options => { destination = options.id; return { close() {} }; } };
  const rows = app.nativeAccountVals().naRows;
  assert.deepEqual(Array.from(rows, row => row.label), ['Настройки аккаунта', 'Написать в поддержку', 'Обучение', 'Выйти из аккаунта']);
  rows[0].pick(); assert.equal(settings, 1);
  rows[1].pick(); assert.equal(destination, 'support');
  rows[2].pick(); assert.equal(destination, 'training');
  const projects = JSON.stringify(app.state.projects), plan = app.state.plan;
  rows[3].pick(); assert.equal(destination, 'logout');
  assert.equal(JSON.stringify(app.state.projects), projects);
  assert.equal(app.state.plan, plan);
  const template = readTemplate(), begin = template.indexOf('<sc-if value="{{ isAccount }}"');
  const account = template.slice(begin, template.indexOf('<sc-if value="{{ isNomEd }}"', begin));
  assert.match(account, /z-native-account/);
  assert.doesNotMatch(account, /acGroups|Команда|Роли и доступ|acToggleTheme|Резервная копия/);
});

test('side menu mirrors original sections and only actual admin receives Appeals', async () => {
  const { component: app } = await runtime();
  app.setState({ screen: 'dash', profile: { role: 'USER' } });
  const labels = () => Array.from(app.mobileHomeVals().mhMenuGroups, group => Array.from(group.items, item => item.label));
  assert.deepEqual(labels(), [
    ['Главная', 'Проекты', 'Задачи', 'Аналитика'],
    ['Редактор пресетов', 'Номенклатуры', 'Шаблон документов'],
    ['Настройки', 'Написать в поддержку'],
  ]);
  let templatesOpened = 0;
  app.openContractTpl = () => { templatesOpened++; };
  app.setState({ mobileMenuOpen: true });
  app.mobileHomeVals().mhMenuGroups[1].items[2].pick();
  assert.equal(templatesOpened, 1, 'the single document entry opens its working text editor');
  assert.equal(app.state.mobileMenuOpen, false);
  app.setState({ profile: { role: 'ADMIN' } });
  assert.deepEqual(labels()[2], ['Настройки', 'Написать в поддержку', 'Обращения']);
  app.setState({ profile: { role: 'Владелец' } });
  assert.deepEqual(labels()[2], ['Настройки', 'Написать в поддержку']);
});

test('uploaded avatar and edited identity appear in home, drawer and account', async () => {
  const { component: app } = await runtime();
  const avatar = 'data:image/png;base64,AA==';
  app.setState({ profile: { name: 'Иван Петров', company: 'Моя студия', avatar }, screen: 'dash' });
  assert.equal(app.mobileHomeVals().mhName, 'Иван Петров');
  assert.equal(app.mobileHomeVals().mhInitials, 'ИП');
  assert.equal(app.mobileHomeVals().mhAvatar, avatar);
  app.go('account');
  assert.equal(app.nativeAccountVals().naName, 'Иван Петров');
  assert.equal(app.nativeAccountVals().naDetail, 'Моя студия');
  assert.equal(app.nativeAccountVals().naAvatar, avatar);
  app.setState({ profile: { name: '  ', phone: '+7 999 1234567', avatar: 'https://external.invalid/avatar.png' } });
  assert.equal(app.nativeAccountVals().naName, '+7 999 1234567');
  assert.equal(app.nativeAccountVals().naHasAvatar, false);
});

test('server-dependent menu destinations never silently open Account or change subscription', async () => {
  const r = await runtime(), app = r.component;
  app.go('dash');
  const opened = [];
  r.ctx.MagicDocuments = { openMenuDestination: options => { opened.push(options.id); return { close() {} }; } };
  const rows = app.mobileHomeVals().mhMenuGroups.flatMap(group => group.items);
  assert.equal(rows.some(row => row.label === 'Дизайнеры'), false);
  app.openNativeMenuDestination('designers');
  rows.find(row => row.label === 'Написать в поддержку').pick();
  assert.equal(app.state.screen, 'dash');
  assert.deepEqual(opened, ['support']);
  app.openNativeMenuDestination('appeals');
  assert.deepEqual(opened, ['support']);
  app.go('account');
  const plan = app.state.plan;
  app.nativeAccountVals().naManage();
  app.nativeAccountVals().naCancel();
  assert.deepEqual(opened.slice(-2), ['subscription', 'cancelSubscription']);
  assert.equal(app.state.plan, plan);
});
