import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.DESIGN_ACCOUNT_URL || 'http://127.0.0.1:5173/design/app.html';
const artifacts = 'artifacts/account-settings';
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const settings = page.getByRole('dialog', { name: 'Настройки аккаунта', exact: true });
const dialog = name => settings.getByRole('dialog', { name, exact: true });
const profile = () => page.evaluate(() => window.__zamer.state.profile);
const ready = () => page.waitForFunction(() => window.__zamer && window.MagicDocuments?.openAccountSettings);

async function openMenu() {
  await page.evaluate(() => window.__zamer.go('dash'));
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  return page.getByRole('dialog', { name: 'Главное меню', exact: true });
}

async function openFromAccount() {
  await page.getByRole('button', { name: 'Аккаунт', exact: true }).click();
  await page.locator('[data-zamer-screen="account"]').waitFor();
  await page.getByRole('button', { name: 'Настройки аккаунта', exact: true }).click();
  await settings.waitFor();
}

async function editField(label, value, modalTitle = label) {
  await settings.getByRole('button', { name: 'Изменить ' + label, exact: true }).click();
  const modal = dialog(modalTitle);
  await modal.getByLabel(modalTitle, { exact: true }).fill(value);
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
}

async function chooseForm(label) {
  await settings.getByRole('button', { name: 'Изменить Форма', exact: true }).click();
  await dialog('Форма').getByRole('radio', { name: label, exact: true }).click();
  await dialog('Форма').waitFor({ state: 'hidden' });
}

async function assertPhone(selector) {
  const metrics = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, width: innerWidth, scroll: element.scrollWidth, client: element.clientWidth, document: document.documentElement.scrollWidth };
  });
  assert.ok(metrics.left >= -1 && metrics.right <= metrics.width + 1, JSON.stringify(metrics));
  assert.ok(metrics.scroll <= metrics.client + 1, JSON.stringify(metrics));
  assert.equal(metrics.document, metrics.width);
}

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await ready();
  await page.evaluate(() => {
    const app = window.__zamer;
    app.setState({ screen: 'dash', projects: [{ id: 'account-e2e-project', name: 'Проверка настроек', client: 'Тестовый клиент', phone: '', address: '', notes: '', status: 'order', date: '13.11.2026', paid: 0, rooms: [], ops: [], events: [], installs: [] }],
      profile: { name: 'Тестовый мастер', company: 'Студия потолков', email: 'test@example.test', phone: '+7 (999) 123-45-67', city: 'Владивосток', legalForm: 'ip', legal: 'Иванов Иван Иванович', inn: '000000000000', kpp: '123456789', ogrn: '123456789012345', signerName: 'Иванов И.И.', bio: true, pin: false, role: 'USER' } });
  });
  await page.waitForFunction(() => window.__zamer.state.profile.name === 'Тестовый мастер');
  const originalProjects = await page.evaluate(() => JSON.stringify(window.__zamer.state.projects));
  await openFromAccount();
  await assertPhone('.z-account-settings');
  await settings.locator('.z-as-scroll').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: `${artifacts}/settings.png` });

  await settings.getByRole('button', { name: 'Изменить Имя', exact: true }).click();
  await dialog('Имя').getByLabel('Имя', { exact: true }).fill('А');
  await dialog('Имя').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await dialog('Имя').getByRole('alert').getByText('Имя должно быть не менее 2 символов').waitFor();
  await dialog('Имя').getByLabel('Имя', { exact: true }).fill('Анна Тестовая');
  await dialog('Имя').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await dialog('Имя').waitFor({ state: 'hidden' });
  assert.equal((await profile()).name, 'Анна Тестовая');
  await settings.getByRole('button', { name: 'Изменить Имя', exact: true }).click();
  await dialog('Имя').getByLabel('Имя', { exact: true }).fill('Несохранённый черновик');
  await dialog('Имя').getByRole('button', { name: 'Отмена', exact: true }).click();
  await dialog('Не сохранять изменения?').getByRole('button', { name: 'Не сохранять', exact: true }).click();
  assert.equal((await profile()).name, 'Анна Тестовая');

  await settings.getByRole('button', { name: 'Изменить E-mail', exact: true }).click();
  await dialog('E-mail').getByLabel('E-mail', { exact: true }).fill('bad');
  await dialog('E-mail').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await dialog('E-mail').getByRole('alert').getByText('Укажите корректный email').waitFor();
  await dialog('E-mail').getByLabel('E-mail', { exact: true }).fill('ANNA@EXAMPLE.TEST');
  await dialog('E-mail').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await dialog('E-mail').waitFor({ state: 'hidden' });
  assert.equal((await profile()).email, 'anna@example.test');
  await editField('Телефон', '89991234567');
  assert.equal((await profile()).phone, '+7 (999) 123-45-67');

  assert.equal(await settings.getByRole('button', { name: 'Изменить КПП', exact: true }).count(), 0);
  await chooseForm('ООО');
  await settings.getByRole('button', { name: 'Изменить Наименование', exact: true }).waitFor();
  await settings.getByRole('button', { name: 'Изменить ОГРН', exact: true }).waitFor();
  await editField('КПП', '987654321');
  await editField('ОГРН', '1234567890123');
  await chooseForm('Самозанятый');
  assert.equal(await settings.getByRole('button', { name: 'Изменить КПП', exact: true }).count(), 0);
  assert.equal(await settings.getByRole('button', { name: 'Изменить ОГРН', exact: true }).count(), 0);
  assert.equal((await profile()).kpp, '987654321');
  assert.equal((await profile()).ogrn, '1234567890123');
  await chooseForm('АО');
  await settings.getByRole('button', { name: 'Изменить КПП', exact: true }).waitFor();
  await chooseForm('ИП');
  await settings.getByRole('button', { name: 'Изменить ОГРНИП', exact: true }).waitFor();
  await settings.getByRole('button', { name: 'Изменить Форма', exact: true }).click();
  assert.deepEqual(await dialog('Форма').getByRole('radio').allTextContents(), ['ИП✓', 'ООО', 'АО', 'Самозанятый']);
  await page.screenshot({ path: `${artifacts}/legal-form.png` });
  await dialog('Форма').getByRole('button', { name: 'Закрыть выбор формы', exact: true }).click();

  await settings.getByRole('button', { name: 'Изменить Банк, р/с', exact: true }).click();
  const bank = dialog('Банк, р/с');
  await bank.getByLabel('Номер расчётного счёта', { exact: true }).fill('40702810000000000001');
  await bank.getByLabel('БИК банка', { exact: true }).fill('040000001');
  await bank.getByLabel('Наименование банка', { exact: true }).fill('Тестовый банк');
  await bank.getByLabel('Корреспондентский счёт', { exact: true }).fill('30101810000000000001');
  await bank.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await bank.waitFor({ state: 'hidden' });
  assert.match((await profile()).bank, /Р\/с 40702810000000000001\nБИК 040000001\nТестовый банк\nК\/с 30101810000000000001/);
  await settings.getByRole('switch', { name: 'Плательщик НДС', exact: true }).click();
  await settings.getByRole('button', { name: 'Изменить Размер НДС %', exact: true }).click();
  await dialog('Размер НДС %').getByLabel('Размер НДС %', { exact: true }).fill('101');
  await dialog('Размер НДС %').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await dialog('Размер НДС %').getByRole('alert').getByText('Укажите размер НДС от 0 до 100').waitFor();
  await dialog('Размер НДС %').getByLabel('Размер НДС %', { exact: true }).fill('22,5');
  await dialog('Размер НДС %').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await dialog('Размер НДС %').waitFor({ state: 'hidden' });
  assert.equal((await profile()).vatRate, '22,5');

  await settings.getByRole('button', { name: 'Логотип и подпись', exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 24;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#1461EE'; ctx.fillRect(0, 0, 24, 24);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  for (const name of ['Загрузить логотип', 'Загрузить подпись']) {
    const chooser = page.waitForEvent('filechooser');
    await dialog('Логотип и подпись').getByRole('button', { name, exact: true }).click();
    await (await chooser).setFiles({ name: 'test-image.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(key => window.__zamer.state.profile[key]?.startsWith('data:image/png;base64,'), name.includes('логотип') ? 'logo' : 'sign');
  }
  await dialog('Логотип и подпись').getByRole('button', { name: 'Закрыть', exact: true }).click();
  await settings.getByRole('switch', { name: 'Вход по Face ID / Touch ID', exact: true }).click();
  await settings.getByRole('switch', { name: 'PIN-код при открытии', exact: true }).click();
  assert.equal((await profile()).bio, false);
  assert.equal((await profile()).pin, true);

  await settings.getByRole('button', { name: 'Сменить пароль', exact: true }).click();
  const password = dialog('Сменить пароль');
  await password.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await password.getByRole('alert').getByText('Укажите текущий пароль').waitFor();
  await password.getByLabel('Текущий пароль', { exact: true }).fill('TestOld123');
  await password.getByLabel('Новый пароль', { exact: true }).fill('ab');
  await password.getByLabel('Подтверждение пароля', { exact: true }).fill('ab');
  await password.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await password.getByText(/Минимум 6 символов/).waitFor();
  await password.getByLabel('Новый пароль', { exact: true }).fill('TestNew456');
  await password.getByLabel('Подтверждение пароля', { exact: true }).fill('TestNew789');
  await password.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await password.getByRole('alert').getByText('Пароли не совпадают').waitFor();
  await password.getByLabel('Подтверждение пароля', { exact: true }).fill('TestNew456');
  await password.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await password.getByRole('alert').getByText('Смена пароля доступна в приложении с аккаунтом').waitFor();
  await password.getByRole('button', { name: 'Отмена', exact: true }).click();
  await dialog('Не сохранять изменения?').getByRole('button', { name: 'Не сохранять', exact: true }).click();
  const stored = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))));
  assert.doesNotMatch(stored, /TestOld123|TestNew456|TestNew789|currentPassword|confirmPassword/);
  await settings.getByRole('button', { name: 'Закрыть настройки аккаунта', exact: true }).click();
  await page.locator('[data-zamer-screen="account"] .z-screen-body').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: `${artifacts}/account.png` });

  const projectsBeforeLogout = await page.evaluate(() => JSON.stringify(window.__zamer.state.projects));
  await page.getByRole('button', { name: 'Обучение', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Обучение', exact: true }).getByText('Раздел появится позже.', { exact: true }).waitFor();
  await page.getByRole('alertdialog', { name: 'Обучение', exact: true }).getByRole('button', { name: 'Понятно', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  const logout = page.getByRole('alertdialog', { name: 'Выйти из аккаунта?', exact: true });
  await logout.getByRole('button', { name: 'Выйти', exact: true }).click();
  await logout.getByRole('status').getByText('В прототипе нет активной сессии. Данные проектов сохранены.', { exact: true }).waitFor();
  assert.equal(await logout.getByRole('button', { name: 'Понятно', exact: true }).evaluate(element => element === document.activeElement), true);
  await logout.getByRole('button', { name: 'Понятно', exact: true }).press('Escape');
  await logout.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => JSON.stringify(window.__zamer.state.projects)), projectsBeforeLogout);
  assert.equal(projectsBeforeLogout, originalProjects);

  await page.reload({ waitUntil: 'networkidle' });
  await ready();
  await openFromAccount();
  const restored = await profile();
  for (const [key, value] of Object.entries({ name: 'Анна Тестовая', email: 'anna@example.test', legalForm: 'ip', kpp: '987654321', ogrn: '1234567890123', vatRate: '22,5', bio: false, pin: true })) assert.equal(restored[key], value, key);
  await page.setViewportSize({ width: 360, height: 800 });
  await assertPhone('.z-account-settings');
  await settings.getByRole('button', { name: 'Закрыть настройки аккаунта', exact: true }).click();
  const menu = await openMenu();
  const labels = (await menu.locator('button').allTextContents()).map(text => text.replace(/\s/g, '').replace(/›$/, ''));
  for (const label of ['Главная', 'Проекты', 'Задачи', 'Аналитика', 'Редактор пресетов', 'Номенклатуры', 'Шаблон договора', 'Шапка сметы', 'Дизайнеры', 'Настройки', 'Написать в поддержку']) assert.ok(labels.includes(label.replace(/\s/g, '')), label);
  assert.equal(await menu.getByRole('button', { name: 'Обращения', exact: true }).count(), 0);
  await page.getByRole('dialog', { name: 'Главное меню', exact: true }).getByRole('button', { name: 'Настройки', exact: true }).click();
  await settings.waitFor();
  await settings.getByRole('button', { name: 'Закрыть настройки аккаунта', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await openMenu();
  await page.screenshot({ path: `${artifacts}/main-menu.png` });
  await menu.getByRole('button', { name: 'Шаблон договора', exact: true }).click();
  const contract = page.locator('.z-contract-mobile-editor');
  await contract.getByText('Тестовый банк', { exact: false }).waitFor();
  assert.match(await contract.innerText(), /40702810000000000001/);
  await page.locator('.z-contract-mobile-editor').getByRole('button', { name: 'Изменить', exact: true }).click();
  await settings.waitFor();
  await settings.getByRole('button', { name: 'Закрыть настройки аккаунта', exact: true }).click();
  await page.locator('.z-contract-header').getByText('Шаблон договора', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Закрыть договор', exact: true }).click();
  const details = await page.evaluate(() => window.MagicEstimate.getCompanyDetails(window.__zamer.state.profile));
  assert.equal(details.bank, restored.bank);
  assert.equal(details.logo, restored.logo);
  assert.equal(details.sign, restored.sign);
  const estimate = await page.evaluate(() => window.MagicEstimate.estimateHtml({ company: window.MagicEstimate.getCompanyDetails(window.__zamer.state.profile), est: {} }));
  assert.match(estimate, /Студия потолков/);
  assert.match(estimate, /alt="Подпись исполнителя"/);
  await page.evaluate(() => window.__zamer.setState(state => ({ profile: { ...state.profile, role: 'ADMIN' } })));
  const adminMenu = await openMenu();
  await adminMenu.getByRole('button', { name: 'Обращения', exact: true }).waitFor();
  await adminMenu.getByRole('button', { name: 'Закрыть главное меню', exact: true }).click();
  assert.deepEqual(errors, []);
  console.log('PASS: settings account/burger navigation, name/email validation + discard, phone formatting, all4 forms/dynamic rows/hidden requisites + reload, bank4parts + document consistency, VAT validation, media uploads, preference flags, password validation/noadapter/no stored credentials, document return path, native menu labels/admin gate, 360/390px/no JS errors.');
} catch (error) {
  await page.screenshot({ path: `${artifacts}/failure.png` });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
