import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// A fresh browser context contains only synthetic projects and profile data.
const base = process.env.PROJECT_PROFILE_URL || 'http://127.0.0.1:5173/design/app.html?screen=app';
const output = path.resolve(process.env.PROJECT_PROFILE_ARTIFACT_DIR || 'artifacts/contract-example/inline-project-20261113');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const settings = page.locator('.z-account-settings');
const modal = name => page.getByRole('dialog', { name, exact: true });
const current = () => page.evaluate(() => window.__zamer.state.projects.find(project => project.id === 'fields-fixture'));
const profile = () => page.evaluate(() => window.__zamer.state.profile);
const details = () => page.evaluate(() => window.MagicEstimate.getCompanyDetails(window.__zamer.state.profile));

async function ready() {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__zamer?.openProject && window.MagicDocuments?.openAccountSettings && window.MagicContract?.open, null, { timeout: 30000 });
}

async function openProject() {
  await page.evaluate(() => window.__zamer.go('dash'));
  await page.getByText('Проверка контактов проекта', { exact: true }).click();
  await page.getByLabel('Клиент', { exact: true }).waitFor();
}

async function editProject(label, key, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill('');
  await input.press('Tab');
  assert.equal((await current())[key], '', `${label} can be cleared directly`);
  await input.fill(value);
  assert.equal((await current())[key], value, `${label} updates while typing`);
  await input.press('Tab');
  assert.equal(await page.getByRole('dialog', { name: label, exact: true }).count(), 0, 'inline edits do not open a dialog');
}

async function chooseForm(name) {
  await settings.getByRole('button', { name: 'Изменить Форма', exact: true }).click();
  const form = modal('Форма');
  assert.deepEqual((await form.getByRole('radio').allTextContents()).map(label => label.replace('✓', '').trim()), ['ИП', 'ООО', 'Самозанятый'], 'only the supported legal forms can be selected');
  await form.getByRole('radio', { name, exact: true }).click();
  await form.waitFor({ state: 'hidden' });
}

async function editProfile(label, value) {
  await settings.getByRole('button', { name: 'Изменить ' + label, exact: true }).click();
  const dialog = modal(label);
  await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}

async function layout(selector, screenshot) {
  await page.waitForFunction(selector => {
    const element = document.querySelector(selector);
    if (!element) return false;
    const box = element.getBoundingClientRect();
    return box.left >= -1 && box.right <= innerWidth + 1;
  }, selector);
  const metrics = await page.locator(selector).evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(metrics.left >= -1 && metrics.right <= metrics.width + 1 && metrics.scroll <= metrics.width + 1, JSON.stringify(metrics));
  await page.screenshot({ path: path.join(output, screenshot) });
}

try {
  await ready();
  await page.evaluate(() => {
    const app = window.__zamer;
    const original = app.state.projects.find(project => project.rooms.length) || app.state.projects[0];
    const room = { ...structuredClone(original.rooms[0]), id: 'fields-room', name: 'Тестовая гостиная', on: true, v: [[0, 0], [4, 0], [4, 3], [0, 3]], holes: [] };
    const project = { ...structuredClone(original), id: 'fields-fixture', name: 'Проверка контактов проекта', client: 'Исходный клиент', phone: '', address: '', notes: '', designer: 'Архивный дизайнер', status: 'estimate', paid: 0, contract: null, rooms: [room], ops: [], events: [], installs: [] };
    app.setState({ screen: 'dash', sheet: null, curId: project.id, projects: [project, { ...project, id: 'designer-fixture', name: 'Справочник дизайнеров', designer: 'Анна дизайнер', rooms: [] }], profile: { name: 'Тестовый мастер', company: 'Студия тестовых потолков', email: 'fixture@example.test', phone: '+7 (999) 000-00-00', city: 'Хабаровск', legalForm: 'ooo', legal: 'ООО «Тестовый пример»', inn: '1234567890', kpp: '123456789', ogrn: '1234567890123', bankAccount: '', bankBik: '', bankName: '', bankCorrAccount: '', bank: '', address: 'Тестовый юридический адрес' } }, () => app.saveDesign());
  });
  await page.waitForFunction(() => window.__zamer.state.projects[0].id === 'fields-fixture');
  await openProject();
  assert.equal(await page.getByLabel('Дизайнер', { exact: true }).count(), 0, 'designer is absent from the project card');
  assert.equal(await page.getByRole('button', { name: 'Дизайнер', exact: true }).count(), 0);
  const client = page.getByLabel('Клиент', { exact: true });
  await client.fill('Иван Петров');
  for (let index = 0; index < 'Петров'.length; index++) await client.press('ArrowLeft');
  for (const letter of 'Тест ') {
    const before = await client.evaluate(element => element.selectionStart);
    await client.pressSequentially(letter);
    assert.equal(await client.evaluate(element => element.selectionStart), before + 1, 'typing keeps the caret in the middle of the same input');
    assert.equal(await client.evaluate(element => document.activeElement === element), true, 'typing keeps input focus');
  }
  assert.equal(await client.inputValue(), 'Иван Тест Петров');
  await client.press('Tab');
  await editProject('Телефон', 'phone', '+7 999 222-33-44');
  await editProject('Адрес', 'address', 'г. Хабаровск, ул. Тестовая, д. 8, корпус 12, подъезд 4, этаж 17, квартира 123456789012345678901234567890');
  await editProject('Заметки', 'notes', 'Нужна стремянка\nСогласовать время звонком');
  await client.fill(''); await client.press('Tab');
  assert.equal((await current()).client, '');
  await client.pressSequentially('Иван Тест Петров'); await client.press('Tab');
  const expected = await current();
  assert.equal(expected.designer, 'Архивный дизайнер', 'editing visible fields preserves legacy hidden designer data');
  assert.equal(expected.notes, 'Нужна стремянка\nСогласовать время звонком');
  await layout('[data-zamer-screen="project"]', 'project-fields-390.png');
  await page.setViewportSize({ width: 375, height: 667 });
  await layout('[data-zamer-screen="project"]', 'project-fields-375-long-address.png');
  for (const label of ['Клиент', 'Телефон', 'Адрес', 'Заметки']) {
    const box = await page.getByLabel(label, { exact: true }).boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 376, `${label} stays within the 375px card`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await ready();
  await openProject();
  for (const key of ['client', 'phone', 'address', 'notes', 'designer']) assert.equal((await current())[key], expected[key], `${key} persists after reload`);
  await page.evaluate(() => window.__zamer.openContract());
  const contract = page.locator('.z-contract-shell');
  await contract.waitFor();
  for (const [label, key] of [['Заказчик', 'client'], ['Телефон заказчика', 'phone'], ['Адрес объекта', 'address']]) assert.equal(await contract.getByLabel(label, { exact: true }).inputValue(), expected[key], 'contract reads the persisted project contact');
  await contract.getByRole('button', { name: 'Закрыть договор', exact: true }).click();
  await contract.waitFor({ state: 'detached' });

  await page.evaluate(() => window.__zamer.go('dash'));
  await page.locator('[data-zamer-nav="goNew"]:visible').click();
  await page.getByLabel('Название объекта', { exact: true }).fill('Новый проект без дизайнера');
  assert.equal(await page.getByLabel('Дизайнер', { exact: true }).count(), 0, 'designer is absent from project creation');
  const createdFields = { Клиент: 'Клиент нового проекта', Телефон: '+7 999 555-66-77', Адрес: 'Тестовый адрес нового проекта', Заметки: 'Вход со двора' };
  for (const [label, value] of Object.entries(createdFields)) await page.getByLabel(label, { exact: true }).fill(value);
  await layout('[data-zamer-screen="new"]', 'project-creation-390.png');
  await page.getByRole('button', { name: 'Создать без замера', exact: true }).click();
  await page.waitForFunction(() => window.__zamer.cur()?.name === 'Новый проект без дизайнера');
  for (const [label, value] of Object.entries(createdFields)) assert.equal(await page.getByLabel(label, { exact: true }).inputValue(), value, 'creation uses the same editable contact fields');
  await page.getByLabel('Клиент', { exact: true }).focus();
  await page.getByLabel('Клиент', { exact: true }).press('Tab');
  await ready();
  assert.ok(await page.evaluate(() => window.__zamer.state.projects.some(project => project.name === 'Новый проект без дизайнера' && project.client === 'Клиент нового проекта')), 'new project persists after creation and blur');

  await page.evaluate(() => window.__zamer.go('dash'));
  await page.getByRole('button', { name: 'Аккаунт', exact: true }).click();
  await page.getByRole('button', { name: 'Настройки аккаунта', exact: true }).click();
  await settings.waitFor();
  await layout('.z-account-settings', 'profile-ooo-390.png');
  assert.equal(await settings.getByRole('button', { name: 'Изменить КПП', exact: true }).count(), 1);
  assert.equal(await settings.getByRole('button', { name: 'Изменить ОГРН', exact: true }).count(), 1);
  assert.equal(await settings.getByRole('switch', { name: /НДС/ }).count(), 0);
  assert.equal(await settings.getByRole('button', { name: /подпись/i }).count(), 0);
  await chooseForm('ИП');
  assert.equal(await settings.getByRole('button', { name: 'Изменить КПП', exact: true }).count(), 0);
  await settings.getByRole('button', { name: 'Изменить ОГРНИП', exact: true }).waitFor();
  assert.match(await settings.innerText(), /Проверьте ИНН/);
  assert.match(await settings.innerText(), /Проверьте ОГРНИП/);
  assert.equal((await profile()).inn, '1234567890', 'form switching preserves raw entries for correction');
  for (const key of ['inn', 'ogrn', 'kpp']) assert.equal((await details())[key], '', 'incompatible ООО identifiers are not exported as ИП');
  await editProfile('ИНН', '123456789012');
  await editProfile('ОГРНИП', '123456789012345');
  await editProfile('ФИО', 'Иванов Тестовый Мастер');
  assert.equal((await details()).inn, '123456789012');
  assert.match((await details()).legal, /^ИП Иванов/);
  await chooseForm('Самозанятый');
  for (const label of ['КПП', 'ОГРН', 'ОГРНИП']) assert.equal(await settings.getByRole('button', { name: 'Изменить ' + label, exact: true }).count(), 0);
  await settings.getByRole('button', { name: 'Изменить Счёт для оплаты', exact: true }).click();
  const bank = modal('Банковские реквизиты');
  assert.match(await bank.innerText(), /Необязательно/);
  await bank.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await bank.waitFor({ state: 'hidden' });
  await settings.getByRole('button', { name: 'Изменить Счёт для оплаты', exact: true }).click();
  await bank.getByLabel('Номер счёта для оплаты', { exact: true }).fill('40817810000000000001');
  await bank.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await bank.waitFor({ state: 'hidden' });
  assert.equal((await details()).bank, 'Счёт 40817810000000000001', 'self-employed account supports optional personal banking details');
  await layout('.z-account-settings', 'profile-self-employed-390.png');
  await settings.getByRole('button', { name: 'Готово', exact: true }).click();
  await settings.waitFor({ state: 'detached' });
  await ready();
  assert.equal((await profile()).legalForm, 'self_employed');
  assert.equal((await details()).bank, 'Счёт 40817810000000000001');
  for (const key of ['client', 'phone', 'address', 'notes', 'designer']) assert.equal((await current())[key], expected[key], 'profile settings preserve project contacts');
  assert.deepEqual(errors, [], 'no browser exceptions');
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ viewports: [{ width: 390, height: 844 }, { width: 375, height: 667 }], projectFields: ['client', 'phone', 'address', 'notes'], designerHiddenAndPreserved: true, forms: ['ooo', 'ip', 'self_employed'], errors }, null, 2));
  await context.tracing.stop({ path: path.join(output, 'trace.zip') });
  console.log('Inline project contacts, middle caret, clearing/blur/reload, creation without designer, contract source and profile smoke passed at 390px and 375px.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') });
  throw error;
} finally {
  await browser.close();
}
