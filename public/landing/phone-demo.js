import { applyGroupAdjustments, normalizePercent } from './group-adjustments.js';

const currency = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const percentage = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 10 });
const groupNames = { materials: 'Материалы', works: 'Работы', equipment: 'Оборудование' };
const groupKeys = Object.keys(groupNames);
const blockNames = { canvas: 'Полотно', profile: 'Основной профиль', extra: 'Доп. профиль', light: 'Светильники' };
const presetNames = {
  canvas: { evolution: 'MSD Evolution', fabric: 'Ткань' },
  profile: { shadow: 'Теневой профиль', strong: 'EUROKRAAB STRONG' },
  extra: { fenix: 'Парящий Феникс' },
  light: { standard: 'Светильник стандарт', chandelier: 'Люстра стандарт' },
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#p-${name}`);
  svg.append(use);
  return svg;
}

const money = (value) => `${currency.format(value)} ₽`;
const qty = (value, unit) => `${quantity.format(value)} ${unit}`;
const initialRoom = (values = {}) => ({
  name: 'Гостиная', area: 24, perimeter: 20, innerAngles: 5, outerAngles: 1,
  canvas: null, profile: null, extra: null, extraQuantity: 3, deductExtra: false,
  light: null, lights: 6, adjustmentRates: { materials: 0, works: 0, equipment: 0 }, ...values,
});

function calculate(room) {
  const rows = [];
  const add = (id, block, group, name, amount, unit, rate) => {
    if (amount <= 0) return;
    rows.push({ id, block, group, name, quantity: amount, unit, rate, cost: Math.round(Number((amount * rate).toFixed(2))) });
  };
  const mainLength = Math.max(0, room.perimeter - (room.extra && room.deductExtra ? room.extraQuantity : 0));
  if (room.canvas) {
    const fabric = room.canvas === 'fabric';
    add('canvas-material', 'canvas', 'materials', 'Полотно', room.area, 'м²', fabric ? 950 : 420);
    add('canvas-stretch', 'canvas', 'works', 'Натяжка полотна', room.area, 'м²', fabric ? 550 : 350);
    add('canvas-cut', 'canvas', 'works', 'Раскрой угла', room.innerAngles + room.outerAngles, 'шт.', 150);
  }
  if (room.profile) {
    add('profile-material', 'profile', 'materials', 'Теневой профиль', mainLength, 'м', room.profile === 'strong' ? 800 : 650);
    add('profile-install', 'profile', 'works', 'Установка профиля', mainLength, 'м', room.profile === 'strong' ? 350 : 300);
    add('profile-outer', 'profile', 'works', 'Монтаж внешнего угла', room.outerAngles, 'шт.', 450);
    add('profile-inner', 'profile', 'works', 'Монтаж внутреннего угла', room.innerAngles, 'шт.', 300);
  }
  if (room.extra) {
    add('extra-material', 'extra', 'materials', 'Профиль Феникс', room.extraQuantity, 'м', 850);
    add('extra-install', 'extra', 'works', 'Установка профиля', room.extraQuantity, 'м', 450);
    add('extra-angle', 'extra', 'works', 'Монтаж угла', 2, 'шт.', 350);
    add('extra-led', 'extra', 'works', 'Установка светодиодной ленты', room.extraQuantity, 'м', 300);
  }
  if (room.light) {
    const chandelier = room.light === 'chandelier';
    add('light-platform', 'light', 'materials', chandelier ? 'Закладная для люстры' : 'Закладная светильника', room.lights, 'шт.', chandelier ? 250 : 150);
    add('light-install', 'light', 'works', chandelier ? 'Установка люстры' : 'Установка светильника', room.lights, 'шт.', chandelier ? 700 : 450);
    add('light-equipment', 'light', 'equipment', chandelier ? 'Люстра' : 'Светильник LED', room.lights, 'шт.', chandelier ? 3500 : 1200);
  }
  const groups = Object.fromEntries(groupKeys.map((group) => [group, rows.filter((row) => row.group === group).reduce((sum, row) => sum + row.cost, 0)]));
  return { rows, baseGroups: groups, mainLength, ...applyGroupAdjustments(groups, room.adjustmentRates) };
}

function normalizeQuantity(raw, previous, minimum, maximum) {
  const fallback = Number.isFinite(previous) ? previous : minimum;
  const parsed = typeof raw === 'string' && raw.trim() === '' ? fallback : Number(raw);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

const phoneRoom = initialRoom();
const scrollArea = document.querySelector('#phone-scroll');
const blocksRoot = document.querySelector('#phone-blocks');
const quoteRoot = document.querySelector('#phone-quote');
const adjustmentSettings = document.querySelector('#phone-adjustments');
const adjustmentInputs = [...document.querySelectorAll('[data-adjustment-group]')];
const status = document.querySelector('#phone-status');
const totalRoot = document.querySelector('#phone-total');
const totalAccessible = document.querySelector('#phone-total-accessible');
const totalDisplay = document.querySelector('#phone-total-display');
const totalReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const tabs = [...document.querySelectorAll('[data-phone-tab]')];
const scrollPositions = { calculation: 0, estimate: 0 };
let openBlock = 'canvas';
let currentTab = 'calculation';
let freshBlock = null;
let totalFrame = 0;
let displayedTotal = null;
let targetTotal = 0;

function say(message, confirmed = false) {
  status.textContent = message;
  status.classList.toggle('is-confirmed', confirmed);
}

function restoreFocus(key) {
  if (!key) return;
  const target = document.querySelector(`[data-phone-focus="${key}"]`);
  if (!target) return;
  if (target.matches(':disabled')) {
    const stepper = target.closest('.phone-stepper');
    const alternative = stepper?.querySelector('button:not(:disabled)');
    if (alternative) alternative.focus({ preventScroll: true });
    else {
      stepper?.querySelector('input')?.focus({ preventScroll: true });
    }
    return;
  }
  target.focus({ preventScroll: true });
}

function button(label, className, action, focusKey) {
  const element = node('button', className, label);
  element.type = 'button';
  if (focusKey) element.dataset.phoneFocus = focusKey;
  element.addEventListener('click', action);
  return element;
}

function makeLine(row, highlight = false, quote = false) {
  const line = node('div', `line-item${highlight ? ' is-new' : ''}`);
  const label = node('span', '', row.name);
  const context = quote && row.block === 'extra' ? ' · Феникс' : '';
  label.append(node('small', '', `${qty(row.quantity, row.unit)}${context}`));
  line.append(label, node('b', '', money(row.cost)));
  return line;
}

function refresh(focusKey) {
  const position = scrollArea.scrollTop;
  render();
  scrollArea.scrollTop = position;
  restoreFocus(focusKey);
}

function choosePreset(block, value, focusKey) {
  const previous = phoneRoom[block];
  phoneRoom[block] = value;
  freshBlock = block;
  const count = calculate(phoneRoom).rows.filter((row) => row.block === block).length;
  refresh(focusKey);
  const noun = count === 1 ? 'позиция' : count < 5 ? 'позиции' : 'позиций';
  say(previous ? `Пресет обновлён: ${count} ${noun}` : `В смету добавлено ${count} ${noun}`, true);
}

function makePresets(block) {
  const container = node('div', 'phone-presets');
  Object.entries(presetNames[block]).forEach(([value, label]) => {
    const focusKey = `preset-${block}-${value}`;
    const chip = button(label, 'phone-preset', () => choosePreset(block, value, focusKey), focusKey);
    chip.setAttribute('aria-pressed', String(phoneRoom[block] === value));
    container.append(chip);
  });
  return container;
}

function makeStepper(label, value, minimum, maximum, key, onChange) {
  const container = node('div', 'quantity-row');
  container.append(node('span', '', label));
  const stepper = node('div', 'phone-stepper');
  const minusKey = `${key}-minus`;
  const plusKey = `${key}-plus`;
  let committed = normalizeQuantity(value, minimum, minimum, maximum);
  const input = node('input');
  input.id = `phone-quantity-${key}`;
  input.type = 'number';
  input.min = String(minimum);
  input.max = String(maximum);
  input.step = '1';
  input.inputMode = 'numeric';
  input.value = String(committed);
  input.dataset.phoneFocus = `${key}-input`;
  input.setAttribute('aria-label', label);
  const updateButtons = () => {
    const draft = normalizeQuantity(input.value, committed, minimum, maximum);
    minus.disabled = draft <= minimum;
    plus.disabled = draft >= maximum;
  };
  const commit = (raw, focusKey) => {
    committed = normalizeQuantity(raw, committed, minimum, maximum);
    input.value = String(committed);
    updateButtons();
    onChange(committed);
    if (focusKey) restoreFocus(focusKey);
  };
  const minus = button('−', '', () => commit(normalizeQuantity(input.value, committed, minimum, maximum) - 1, minusKey), minusKey);
  minus.setAttribute('aria-label', `Уменьшить: ${label}`);
  const plus = button('+', '', () => commit(normalizeQuantity(input.value, committed, minimum, maximum) + 1, plusKey), plusKey);
  plus.setAttribute('aria-label', `Увеличить: ${label}`);
  input.addEventListener('input', updateButtons);
  input.addEventListener('change', () => commit(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commit(input.value, `${key}-input`);
  });
  updateButtons();
  stepper.append(minus, input, plus);
  container.append(stepper);
  return container;
}

function makeExtraControls() {
  const container = node('div');
  const deduction = node('div', 'phone-deduction');
  const label = node('label', 'deduction-switch');
  const checkbox = node('input');
  checkbox.type = 'checkbox';
  checkbox.checked = phoneRoom.deductExtra;
  checkbox.dataset.phoneFocus = 'deduct-extra';
  checkbox.addEventListener('change', () => {
    phoneRoom.deductExtra = checkbox.checked;
    freshBlock = 'profile';
    refresh('deduct-extra');
    say(phoneRoom.deductExtra ? 'Вычет из основного профиля включён' : 'Вычет из основного профиля отключён', true);
  });
  label.append(checkbox, node('span', '', 'Вычесть из основного профиля'));
  deduction.append(label);
  container.append(deduction);
  return container;
}

function renderBlocks(result) {
  blocksRoot.replaceChildren();
  ['canvas', 'profile', 'extra', 'light'].forEach((block) => {
    const card = node('section', 'phone-block');
    const selected = phoneRoom[block];
    const expanded = openBlock === block;
    const rows = result.rows.filter((row) => row.block === block);
    const focusKey = `toggle-${block}`;
    const toggle = button('', 'block-toggle', () => {
      const headerOffset = toggle.getBoundingClientRect().top - scrollArea.getBoundingClientRect().top;
      openBlock = expanded ? null : block;
      freshBlock = null;
      render();
      const updatedToggle = document.querySelector(`#phone-toggle-${block}`);
      const updatedOffset = updatedToggle.getBoundingClientRect().top - scrollArea.getBoundingClientRect().top;
      scrollArea.scrollTop += updatedOffset - headerOffset;
      restoreFocus(focusKey);
    }, focusKey);
    toggle.id = `phone-toggle-${block}`;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-controls', `phone-body-${block}`);
    toggle.append(icon(block === 'light' ? 'light' : 'layers'));
    const heading = node('span', 'block-heading');
    heading.append(node('b', '', blockNames[block]), node('span', '', selected ? presetNames[block][selected] : 'Выберите пресет'));
    const value = block === 'canvas' ? qty(phoneRoom.area, 'м²') : block === 'profile' ? qty(result.mainLength, 'м') : block === 'extra' ? qty(phoneRoom.extraQuantity, 'м') : qty(phoneRoom.lights, 'шт.');
    const price = node('span', 'block-price');
    price.append(node('b', '', money(rows.reduce((sum, row) => sum + row.cost, 0))), node('span', '', value));
    toggle.append(heading, price, icon('chevron', 'chevron'));
    const body = node('div', 'block-body');
    body.id = `phone-body-${block}`;
    body.hidden = !expanded;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-labelledby', toggle.id);
    body.append(node('p', 'preset-instruction', 'Нажмите на пресет — весь его состав появится в смете.'), makePresets(block));
    if (block === 'extra') {
      body.append(makeStepper('Длина, м', phoneRoom.extraQuantity, 1, phoneRoom.perimeter, 'extra-length', (value) => updateQuantity('extra', value)));
    }
    if (block === 'light') {
      body.append(makeStepper('Количество, шт.', phoneRoom.lights, 1, 24, 'light-count', (value) => updateQuantity('light', value)));
    }
    if (selected) {
      if (block === 'extra') body.append(makeExtraControls());
      const composition = node('div', 'phone-composition');
      composition.append(node('p', 'composition-note', `В смете: ${rows.length} позиции`));
      rows.forEach((row) => composition.append(makeLine(row, freshBlock === block)));
      body.append(composition);
      if (block === 'extra' || block === 'light') {
        const removeKey = `remove-${block}`;
        body.append(button('Убрать из расчёта', 'remove-preset', () => {
          phoneRoom[block] = null;
          if (block === 'extra') phoneRoom.deductExtra = false;
          freshBlock = null;
          refresh(`toggle-${block}`);
          say('Пресет убран из расчёта');
        }, removeKey));
      }
    }
    card.append(toggle, body);
    blocksRoot.append(card);
  });
}

function renderQuote(result) {
  quoteRoot.replaceChildren();
  adjustmentSettings.hidden = !result.rows.length;
  if (!result.rows.length) {
    const empty = node('div', 'quote-empty');
    empty.append(icon('file'), node('b', '', 'Смета пока пустая'), node('p', '', 'Выберите пресет в расчёте. Его материалы и работы появятся здесь.'));
    empty.append(button('Перейти к расчёту', '', () => setTab('calculation', true)));
    quoteRoot.append(empty);
    return;
  }
  groupKeys.forEach((group) => {
    const rows = result.rows.filter((row) => row.group === group);
    if (!rows.length) return;
    const section = node('section', 'phone-quote-group');
    section.setAttribute('aria-label', groupNames[group]);
    const heading = node('h3', '', groupNames[group]);
    heading.append(node('strong', '', money(result.groups[group])));
    const lines = node('div');
    rows.forEach((row) => lines.append(makeLine(row, row.block === freshBlock, true)));
    const percent = phoneRoom.adjustmentRates[group];
    if (percent) {
      const adjustment = node('div', `quote-adjustment${percent < 0 ? ' is-discount' : ''}`);
      const sign = percent < 0 ? '−' : '+';
      adjustment.append(node('span', '', `${percent < 0 ? 'Скидка' : 'Наценка'} ${sign}${percentage.format(Math.abs(percent))}%`),
        node('strong', '', `${sign}${money(Math.abs(result.adjustments[group]))}`));
      lines.append(adjustment);
    }
    section.append(heading, lines);
    quoteRoot.append(section);
  });
  const total = node('div', 'phone-quote-total');
  total.append(node('span', '', 'Итого по помещению'), node('b', '', money(result.total)));
  quoteRoot.append(total);
  const actions = node('div', 'quote-actions');
  actions.append(button('Начать заново', 'quote-reset', resetDemo));
  quoteRoot.append(actions);
}

function finishTotalAnimation() {
  if (totalFrame) window.cancelAnimationFrame(totalFrame);
  totalFrame = 0;
  displayedTotal = targetTotal;
  totalDisplay.textContent = money(targetTotal);
  totalRoot.classList.remove('is-counting');
}

function renderTotalAmount(total) {
  totalAccessible.textContent = money(total);
  const previousTarget = targetTotal;
  targetTotal = total;
  if (displayedTotal === null || total === 0 || totalReducedMotion.matches || document.hidden) {
    finishTotalAnimation();
    return;
  }
  if (total === previousTarget) return;
  if (totalFrame) window.cancelAnimationFrame(totalFrame);
  const from = displayedTotal;
  const started = window.performance.now();
  totalRoot.classList.add('is-counting');
  const step = (now) => {
    const progress = Math.min(1, Math.max(0, (now - started) / 400));
    displayedTotal = from + (total - from) * (1 - (1 - progress) ** 3);
    // Whole rubles keep intermediate frames calm; never cross either endpoint.
    const amount = Math.min(Math.max(from, total), Math.max(Math.min(from, total), Math.round(displayedTotal)));
    totalDisplay.textContent = money(amount);
    if (progress < 1) totalFrame = window.requestAnimationFrame(step);
    else finishTotalAnimation();
  };
  totalFrame = window.requestAnimationFrame(step);
}

function renderTotals(result) {
  renderTotalAmount(result.total);
  const badge = document.querySelector('#phone-quote-badge');
  badge.textContent = String(result.rows.length);
  badge.classList.toggle('has-items', result.rows.length > 0);
}

function updateQuantity(block, value) {
  const position = scrollArea.scrollTop;
  if (block === 'extra') phoneRoom.extraQuantity = value;
  else phoneRoom.lights = value;
  freshBlock = block;
  const result = calculate(phoneRoom);
  ['canvas', 'profile', 'extra', 'light'].forEach((key) => {
    const rows = result.rows.filter((row) => row.block === key);
    const price = document.querySelector(`#phone-toggle-${key} .block-price`);
    price.querySelector('b').textContent = money(rows.reduce((sum, row) => sum + row.cost, 0));
    const amount = key === 'canvas' ? qty(phoneRoom.area, 'м²') : key === 'profile' ? qty(result.mainLength, 'м') : key === 'extra' ? qty(phoneRoom.extraQuantity, 'м') : qty(phoneRoom.lights, 'шт.');
    price.querySelector('span').textContent = amount;
    const composition = document.querySelector(`#phone-body-${key} .phone-composition`);
    if (composition) {
      composition.replaceChildren(node('p', 'composition-note', `В смете: ${rows.length} позиции`));
      rows.forEach((row) => composition.append(makeLine(row, key === freshBlock)));
    }
  });
  renderQuote(result);
  renderTotals(result);
  scrollArea.scrollTop = position;
  say(block === 'extra' ? 'Длина Феникса обновлена' : 'Количество светильников обновлено', true);
}

function render() {
  const result = calculate(phoneRoom);
  renderBlocks(result);
  renderQuote(result);
  renderTotals(result);
}

function setTab(name, focus = false) {
  scrollPositions[currentTab] = scrollArea.scrollTop;
  currentTab = name;
  tabs.forEach((tab) => {
    const selected = tab.dataset.phoneTab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus({ preventScroll: true });
  });
  document.querySelector('#phone-calculation').hidden = name !== 'calculation';
  document.querySelector('#phone-estimate').hidden = name !== 'estimate';
  scrollArea.scrollTop = scrollPositions[name];
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => setTab(tab.dataset.phoneTab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].dataset.phoneTab, true);
  });
});

function resetDemo() {
  Object.assign(phoneRoom, initialRoom());
  adjustmentInputs.forEach((input) => { input.value = '0'; });
  adjustmentSettings.open = false;
  openBlock = 'canvas';
  freshBlock = null;
  scrollPositions.calculation = 0;
  scrollPositions.estimate = 0;
  render();
  setTab('calculation');
  scrollPositions.calculation = 0;
  scrollPositions.estimate = 0;
  scrollArea.scrollTop = 0;
  document.querySelector('#phone-reset').focus({ preventScroll: true });
  say('Пример настроенных пресетов. Выберите полотно');
}

document.querySelector('#phone-reset').addEventListener('click', resetDemo);
totalReducedMotion.addEventListener('change', () => {
  if (displayedTotal !== null) finishTotalAnimation();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && displayedTotal !== null) finishTotalAnimation();
});

adjustmentInputs.forEach((input) => {
  const group = input.dataset.adjustmentGroup;
  const apply = (commit) => {
    const previous = phoneRoom.adjustmentRates[group];
    const percent = normalizePercent(input.value, previous);
    phoneRoom.adjustmentRates[group] = percent;
    freshBlock = null;
    if (commit) input.value = String(percent).replace('.', ',');
    if (percent !== previous) {
      const position = scrollArea.scrollTop;
      const result = calculate(phoneRoom);
      renderQuote(result);
      renderTotals(result);
      scrollArea.scrollTop = position;
    }
    if (commit) say(`${groupNames[group]}: ${percent ? `${percent < 0 ? 'скидка' : 'наценка'} ${percentage.format(Math.abs(percent))}%` : 'без скидки и наценки'}`, true);
  };
  input.addEventListener('input', () => apply(false));
  input.addEventListener('change', () => apply(true));
  document.querySelector(`[data-adjustment-sign="${group}"]`).addEventListener('click', () => {
    input.value = String(-normalizePercent(input.value, phoneRoom.adjustmentRates[group])).replace('.', ',');
    apply(true);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    apply(true);
  });
});

render();

