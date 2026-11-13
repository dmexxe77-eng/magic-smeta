import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.DESIGN_ORIGIN || 'http://127.0.0.1:5173';
const artifacts = 'artifacts/login';
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1050 }, deviceScaleFactor: 2 });
const page = await context.newPage(), errors = [], requests = [];
page.setDefaultTimeout(10000);
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
const frame = page.frameLocator('#preview-frame');
const authFrame = () => page.frames().find(candidate => /\/design\/(?:login|register|app)\.html/.test(candidate.url()));
const hostScreen = screen => page.waitForFunction(expected => new URL(location.href).searchParams.get('screen') === expected, screen);
const phone = () => frame.getByLabel('Номер телефона', { exact: true });
const password = () => frame.getByLabel('Пароль', { exact: true });

async function dismissNotice() { await frame.getByRole('alertdialog').getByRole('button', { name: 'Понятно', exact: true }).click(); }
async function assertNoOverflow() {
  const metrics = await authFrame().evaluate(() => ({ document: document.documentElement.scrollWidth, width: innerWidth, stage: document.querySelector('[data-zamer-app-stage]')?.scrollWidth }));
  assert.equal(metrics.document, metrics.width);
  assert.ok(metrics.stage <= metrics.width + 1, JSON.stringify(metrics));
}
async function logout() {
  await frame.getByRole('button', { name: 'Аккаунт', exact: true }).click();
  await frame.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await frame.getByRole('alertdialog', { name: 'Выйти из аккаунта?', exact: true }).getByRole('button', { name: 'Выйти', exact: true }).click();
  await frame.getByRole('heading', { name: 'Вход', exact: true }).waitFor();
  await hostScreen('login');
}

try {
  await page.goto(origin + '/design/index.html?preview=1&previewDevice=galaxy-s', { waitUntil: 'networkidle' });
  await frame.getByRole('heading', { name: 'Вход', exact: true }).waitFor();
  await page.waitForFunction(() => document.getElementById('preview-status').hidden);
  assert.equal(new URL(authFrame().url()).pathname, '/design/login.html');
  const initialHost = page.url();
  await page.evaluate(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'zamer:prototype-screen', screen: 'app' }, origin: location.origin, source: window }));
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'zamer:prototype-screen', screen: 'app' }, origin: 'https://untrusted.example', source: document.getElementById('preview-frame').contentWindow }));
  });
  assert.equal(page.url(), initialHost, 'messages from another source or origin do not change the route');
  await assertNoOverflow();
  const initialStorage = await authFrame().evaluate(() => {
    localStorage.setItem('auth-flow-sentinel', 'keep');
    return JSON.stringify({ ...localStorage });
  });
  await page.locator('#preview-frame').screenshot({ path: `${artifacts}/login-preview.png` });
  await frame.getByRole('button', { name: 'Войти', exact: true }).click();
  assert.match(await frame.getByRole('alertdialog').innerText(), /телефон|номер/i);
  await dismissNotice();
  await phone().fill('a');
  await frame.getByRole('button', { name: 'Войти', exact: true }).click();
  assert.match(await frame.getByRole('alertdialog').innerText(), /пароль/i);
  await dismissNotice();
  await password().fill('1');
  await frame.getByRole('button', { name: 'Показать пароль', exact: true }).click();
  assert.equal(await password().getAttribute('type'), 'text');
  await frame.getByRole('button', { name: 'Скрыть пароль', exact: true }).click();
  assert.equal(await password().getAttribute('type'), 'password');

  const frameSrc = await page.locator('#preview-frame').getAttribute('src');
  await phone().fill('unique-auth-draft-phone');
  await password().fill('unique-auth-draft-password');
  await page.getByLabel('Устройство', { exact: true }).selectOption('iphone-pro-max');
  assert.equal(await phone().inputValue(), 'unique-auth-draft-phone');
  assert.equal(await password().inputValue(), 'unique-auth-draft-password');
  await page.locator('#preview-rotate').click();
  await assertNoOverflow();
  assert.equal(await phone().inputValue(), 'unique-auth-draft-phone');
  assert.equal(await page.locator('#preview-frame').getAttribute('src'), frameSrc);
  await page.locator('#preview-rotate').click();
  await page.getByLabel('Устройство', { exact: true }).selectOption('iphone-se');
  await frame.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await frame.getByRole('heading', { name: 'Регистрация', exact: true }).waitFor();
  await hostScreen('register');
  assert.equal(await frame.locator('input').count(), 4);
  await assertNoOverflow();
  await page.locator('#preview-frame').screenshot({ path: `${artifacts}/register-preview.png` });

  await frame.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  assert.match(await frame.getByRole('alertdialog').innerText(), /имя/i);
  await dismissNotice();

  await frame.getByLabel('Имя пользователя', { exact: true }).fill('unique-registration-name');
  await frame.getByLabel('Email', { exact: true }).fill('invalid-email-is-accepted');
  await phone().fill('9');
  await password().fill('1');
  await page.getByLabel('Устройство', { exact: true }).selectOption('iphone-pro-max');
  assert.equal(await frame.getByLabel('Имя пользователя', { exact: true }).inputValue(), 'unique-registration-name');
  assert.equal(await frame.getByLabel('Email', { exact: true }).inputValue(), 'invalid-email-is-accepted');
  assert.equal(await phone().inputValue(), '9');
  assert.equal(await password().inputValue(), '1');
  await frame.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await frame.getByRole('heading', { name: 'Вход', exact: true }).waitFor();
  await hostScreen('login');
  assert.equal(await authFrame().evaluate(() => JSON.stringify({ ...localStorage })), initialStorage, 'registration never writes an account or credentials');

  const short = await context.newPage();
  short.on('pageerror', error => errors.push(error.message));
  short.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  await short.setViewportSize({ width: 360, height: 430 });
  await short.goto(origin + '/design/login.html?screen=register', { waitUntil: 'networkidle' });
  await short.getByLabel('Пароль', { exact: true }).fill('1');
  await short.getByRole('button', { name: 'Создать аккаунт', exact: true }).scrollIntoViewIfNeeded();
  const submitBox = await short.getByRole('button', { name: 'Создать аккаунт', exact: true }).boundingBox();
  assert.ok(submitBox.y >= 0 && submitBox.y + submitBox.height <= 431, 'short viewport keeps the submit button reachable by scrolling');
  assert.equal(await short.evaluate(() => document.documentElement.scrollWidth), 360);
  await short.close();

  await phone().fill('a');
  await password().fill('1');
  await frame.getByRole('button', { name: 'Войти', exact: true }).click();
  await frame.locator('[data-zamer-screen="dash"]').waitFor();
  await hostScreen('app');
  assert.equal(new URL(authFrame().url()).pathname, '/design/app.html');
  await authFrame().waitForFunction(() => window.__zamer);
  await authFrame().evaluate(() => {
    const app = window.__zamer;
    app.setState({ projects: [{ id: 'auth-flow-project', name: 'Сохранённый проект', date: '13.11.2026', status: 'order', client: 'Тестовый клиент', phone: '', address: '', paid: 0, rooms: [], ops: [], events: [], installs: [] }] });
  });
  await authFrame().waitForFunction(() => window.__zamer.state.projects[0]?.id === 'auth-flow-project');
  await authFrame().evaluate(() => window.__zamer.saveDesign());
  await page.reload({ waitUntil: 'networkidle' });
  await frame.locator('[data-zamer-screen="dash"]').waitFor();
  await hostScreen('app');
  await authFrame().waitForFunction(() => window.__zamer);
  assert.equal(await authFrame().evaluate(() => window.__zamer.state.projects[0].id), 'auth-flow-project');
  await logout();
  const storedAfterLogout = await authFrame().evaluate(() => ({ ...localStorage }));
  assert.equal(JSON.parse(storedAfterLogout['zamer.design.v1']).projects[0].id, 'auth-flow-project');
  assert.equal(storedAfterLogout['auth-flow-sentinel'], 'keep');
  assert.doesNotMatch(JSON.stringify(storedAfterLogout), /unique-auth-draft-phone|unique-auth-draft-password|unique-registration-name|invalid-email-is-accepted/);
  assert.ok(Object.keys(storedAfterLogout).every(key => !/(?:password|credential|token|session)/i.test(key)));
  await phone().fill('9');
  await password().fill('!');
  await frame.getByRole('button', { name: 'Войти', exact: true }).click();
  await frame.locator('[data-zamer-screen="dash"]').waitFor();
  await hostScreen('app');
  await authFrame().waitForFunction(() => window.__zamer);
  assert.equal(await authFrame().evaluate(() => window.__zamer.state.projects[0].id), 'auth-flow-project');
  assert.ok(requests.every(request => request.method === 'GET'), 'no authentication/database requests');
  assert.deepEqual(errors, []);
  console.log('PASS: default login wrapper, empty-only guards, password eye, arbitrary a/1 and9/! sign-in, four-field arbitrary registration→login, resize/rotate drafts,360/430/shortSE layout, actual app entry + wrapper route/reload, logout→login preserving projects, no credentials/account persistence or POSTs, clean screenshots.');
} catch (error) {
  await page.screenshot({ path: `${artifacts}/failure.png` });
  throw error;
} finally {
  await context.close(); await browser.close();
}
