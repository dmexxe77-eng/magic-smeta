import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { projectFieldsTemplate } from '../scripts/design-project-fields.mjs';

const source = fs.readFileSync('design-src/prototype.html', 'utf8');
const original = JSON.parse(source.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
function app() {
  class DCLogic {
    props = { platform: 'ios', theme: 'light', startScreen: 'home' };
    setState(change, callback) { this.state = { ...this.state, ...(typeof change === 'function' ? change(this.state) : change) }; callback?.(); }
  }
  const context = vm.createContext({ DCLogic, console, setTimeout: () => 1, clearTimeout() {}, document: { querySelector: () => null } });
  vm.runInContext('window=globalThis;', context);
  const template = projectFieldsTemplate(original);
  const code = template.match(/<script\b(?=[^>]*\bdata-dc-script\b)[^>]*>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(code + '\n;globalThis.App=Component;', context);
  const instance = new context.App();
  instance.state.projects = [
    { id: 'first', name: 'Объект', client: 'Клиент', phone: '123', address: '', notes: 'Заметка', designer: 'Анна', rooms: [{ id: 'room', v: [[0, 0], [4, 0], [4, 3]], canvas: { pid: 'test' } }], paid: 1200, status: 'order' },
    { id: 'other', name: 'Другой', client: 'Другой клиент', designer: 'Борис', rooms: [], paid: 0, status: 'order' },
  ];
  instance.openProject('first');
  return { instance, template };
}
const input = value => ({ target: { value } });
const row = (instance, label) => instance.projectVals().pRows.find(value => value.label === label);

test('project fields save each edit immediately and preserve unrelated project and calculation data', () => {
  const { instance } = app(), beforeRooms = JSON.stringify(instance.state.projects[0].rooms), beforeOther = JSON.stringify(instance.state.projects[1]);
  for (const [label, key, value] of [['Клиент', 'client', 'Новый клиент'], ['Телефон', 'phone', '+7 999 123-45-67'], ['Адрес', 'address', 'Новый адрес'], ['Заметки', 'notes', 'Первая строка\nВторая строка']]) {
    row(instance, label).change(input(value));
    assert.equal(instance.state.projects[0][key], value);
    assert.equal(row(instance, label).value, value);
  }
  assert.equal(JSON.stringify(instance.state.projects[0].rooms), beforeRooms);
  assert.equal(JSON.stringify(instance.state.projects[1]), beforeOther);
  assert.equal(instance.state.projects[0].paid, 1200);
  assert.equal(instance.state.projects[0].status, 'order');
  assert.equal(instance.state.projects[0].designer, 'Анна', 'existing designer data is preserved');
  assert.equal(row(instance, 'Дизайнер'), undefined);
  assert.equal(instance.state.sheet, null);
});

test('typing preserves spaces, insertion positions, composition values and explicit clearing', () => {
  const { instance } = app();
  for (const value of ['И', 'Ив', 'Иван ', 'Иван П', 'Иван Пе', 'Иван 中', 'Иван 中村']) {
    const event = { target: { value, selectionStart: 2, selectionEnd: 2 }, nativeEvent: { isComposing: true } };
    row(instance, 'Клиент').change(event);
    assert.equal(row(instance, 'Клиент').value, value);
    assert.equal(event.target.selectionStart, 2);
    assert.equal(event.target.selectionEnd, 2);
  }
  row(instance, 'Телефон').change(input(''));
  assert.equal(instance.state.projects[0].phone, '');
  assert.equal(instance.state.projects[0].designer, 'Анна');
});

test('blur flushes current values through the existing save path and old field handlers cannot edit another project', () => {
  const { instance } = app();
  let saved;
  instance.saveDesign = () => { saved = JSON.stringify(instance.state.projects); return true; };
  const oldField = row(instance, 'Клиент');
  oldField.change(input('Сохранённый клиент'));
  oldField.blur();
  assert.equal(JSON.parse(saved)[0].client, 'Сохранённый клиент');
  instance.openProject('other');
  oldField.change(input('Старое поле'));
  assert.equal(instance.state.projects[0].client, 'Сохранённый клиент');
  assert.equal(instance.state.projects[1].client, 'Другой клиент');
});

test('new projects use direct contact fields without designer controls', () => {
  const { instance, template } = app();
  instance.go('new', { nf: { name: '', client: '', phone: '', address: '', designer: '', notes: '' } });
  const entered = { name: 'Новый объект', client: 'Анна', phone: '+7 999 555-11-22', address: 'Примерная, 5', notes: 'Два помещения' };
  for (const [key, value] of Object.entries(entered)) instance.newVals().nfSet[key](input(value));
  instance.newVals().nfCreate();
  for (const [key, value] of Object.entries(entered)) assert.equal(instance.state.projects[0][key], value);
  assert.equal(instance.state.projects[0].designer, '');
  assert.equal(instance.state.screen, 'project');
  assert.equal(instance.state.sheet, null);
  assert.doesNotMatch(template, /aria-label="Дизайнер"|>Дизайнер<|sheetProjectField|sheetProjectDesigner|openProjectField|pfSave|nfOpenDesigner|nfNewDesigner/);
});
