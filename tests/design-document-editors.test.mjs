import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './design-runtime.mjs';
import { estimateHtml } from '../src/utils/estimate-html.js';
import { getCompanyDetails } from '../src/design-bridge/company-profile.js';
import { companyContractFields } from '../src/data/contract.js';

test('visible legal form names retain readable placeholders and export only applicable requisites', () => {
  for (const [input, value] of [['ООО', 'ooo'], ['ИП', 'ip'], ['Самозанятый', 'self_employed']]) {
    const company = getCompanyDetails({ legalForm: input, signerName: 'Иванов И.И.', kpp: '123456789' });
    assert.equal(company.legalForm, value);
    assert.equal(companyContractFields(company).форма, input);
    assert.equal(companyContractFields(company).подпись_фио, 'Иванов И.И.');
    assert.equal(company.kpp, value === 'ooo' ? '123456789' : '');
  }
});

test('mobile estimate editor persists document settings with its project and exports actual rows', async () => {
  const r = await runtime(), app = r.component;
  const project = app.state.projects.find(p => p.rooms.length);
  app.openCalc(project.id);
  let editor;
  r.ctx.MagicDocuments = { openEstimateEditor: options => { editor = options; return { close() {} }; } };
  app.openEstimateEditor();
  assert.ok(editor.est.mats.length + editor.est.works.length > 0);
  assert.equal(editor.rooms.length, project.rooms.filter(r => r.on).length);
  editor.onChange({ adjustment: { scope: 'works', rates: { mats: 5, works: -10, equipment: 0 } }, exportOptions: {
    type: 'rooms', columnsDefaultsVersion: 1, cols: { photo: true, price: false }, showAdjustmentByScope: { mats: true, works: false, equipment: true },
  } });
  const saved = app.cur();
  assert.equal(saved.estimateExportOptions.type, 'rooms');
  assert.equal(saved.estimateExportOptions.cols.price, false);
  const restored = await runtime({ saved: r.entries.get('zamer.design.v1') });
  restored.component.openCalc(project.id);
  restored.ctx.MagicDocuments = { openEstimateEditor: options => { editor = options; return { close() {} }; } };
  restored.component.openEstimateEditor();
  assert.equal(editor.exportOptions.type, 'rooms');
  assert.equal(editor.adjustment.rates.works, -10);
  assert.equal(editor.exportOptions.showAdjustmentByScope.works, false);
  editor.onEditRows();
  assert.equal(restored.component.state.sheet, 'estimate');
  assert.equal(restored.component.state.estTab, 'all');
});

test('mobile document media updates the saved profile used by both documents', async () => {
  const r = await runtime(), app = r.component;
  let header;
  r.ctx.MagicDocuments = { openEstimateHeader: options => { header = options; return { close() {} }; } };
  app.openEstimateHeader();
  header.onCompanyChange({ logo: 'data:image/png;base64,AA==', sign: 'data:image/png;base64,AQ==' });
  assert.equal(r.ctx.MagicEstimate.getCompanyDetails(app.state.profile).sign, 'data:image/png;base64,AQ==');
  header.onCompanyChange({ logo: '' });
  assert.equal(r.ctx.MagicEstimate.getCompanyDetails(app.state.profile).logo, '');
  const restored = await runtime({ saved: r.entries.get('zamer.design.v1') });
  assert.equal(restored.component.state.profile.sign, 'data:image/png;base64,AQ==');
});

test('photo visibility affects layout while saved signatures never print or change totals', () => {
  const est = { mats: [{ n: 'Полотно', q: 2, p: 100, u: 'м²', img: 'data:image/png;base64,AA==' }] };
  const withPhotos = estimateHtml({ est, cols: { photo: true }, company: { sign: 'data:image/png;base64,AQ==' } });
  assert.match(withPhotos, /<th>Фото<\/th>/);
  assert.match(withPhotos, /class="estimate-item-photo" src=/);
  assert.doesNotMatch(withPhotos, /Подпись исполнителя|estimate-signature/);
  const withoutPhotos = estimateHtml({ est, cols: { photo: false } });
  assert.doesNotMatch(withoutPhotos, /class="estimate-item-photo" src=/);
  for (const html of [withPhotos, withoutPhotos]) assert.match(html, /data-estimate-grand-total>200 ₽/);
  assert.doesNotMatch(estimateHtml({ est, company: { sign: 'javascript:alert(1)' } }), /alt="Подпись исполнителя"/);
});

test('photo defaults and explicit project visibility override obsolete appearance settings', () => {
  const est = { mats: [{ n: 'Полотно', q: 2, p: 100, u: 'м²', img: 'data:image/png;base64,AA==' }] };
  const input = { est, company: { estimateTemplate: { showItemPhotos: false } } };
  for (const cols of [undefined, { photo: true }]) {
    const html = estimateHtml({ ...input, cols });
    assert.match(html, /<th>Фото<\/th>/);
    assert.match(html, /class="estimate-item-photo"/);
    assert.match(html, /data-estimate-grand-total>200 ₽/);
  }
  const hidden = estimateHtml({ ...input, cols: { photo: false } });
  assert.doesNotMatch(hidden, /<th>Фото<\/th>|class="estimate-item-photo"/);
  assert.match(hidden, /data-estimate-grand-total>200 ₽/);
});

test('all estimate export modes omit legacy signatures without deleting their stored values', () => {
  const company = { sign: 'data:image/png;base64,AQ==', signature: 'data:image/png;base64,Ag==' };
  const before = JSON.stringify(company);
  const est = { mats: [{ n: 'Профиль', q: 2, p: 100, u: 'шт' }] };
  for (const type of ['total', 'rooms', 'draw', 'compact']) {
    const html = estimateHtml({ est, company, type, rooms: [{ id: 1, name: 'Комната', est }] });
    assert.doesNotMatch(html, /estimate-signature|Подпись исполнителя|data:image\/png;base64,AQ==|data:image\/png;base64,Ag==/);
    assert.match(html, /data-estimate-grand-total>200 ₽/);
  }
  assert.equal(JSON.stringify(company), before);
});
