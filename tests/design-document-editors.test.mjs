import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './design-runtime.mjs';
import { estimateHtml } from '../src/utils/estimate-html.js';
import { getCompanyDetails } from '../src/design-bridge/company-profile.js';
import { companyContractFields } from '../src/data/contract.js';

test('visible legal form names retain native requisites and readable contract placeholders', () => {
  for (const [input, value] of [['ООО', 'ooo'], ['ИП', 'ip'], ['Самозанятый', 'self_employed']]) {
    const company = getCompanyDetails({ legalForm: input, signerName: 'Иванов И.И.', kpp: '123456789' });
    assert.equal(company.legalForm, value);
    assert.equal(companyContractFields(company).форма, input);
    assert.equal(companyContractFields(company).подпись_фио, 'Иванов И.И.');
    assert.equal(company.kpp, '123456789');
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
    type: 'rooms', cols: { photo: true, price: false }, showAdjustmentByScope: { mats: true, works: false, equipment: true },
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

test('photo column and signature affect the rendered document without changing totals', () => {
  const est = { mats: [{ n: 'Полотно', q: 2, p: 100, u: 'м²', img: 'data:image/png;base64,AA==' }] };
  const withPhotos = estimateHtml({ est, cols: { photo: true }, company: { sign: 'data:image/png;base64,AQ==' } });
  assert.match(withPhotos, /<th>Фото<\/th>/);
  assert.match(withPhotos, /class="estimate-item-photo" src=/);
  assert.match(withPhotos, /alt="Подпись исполнителя"/);
  const withoutPhotos = estimateHtml({ est, cols: { photo: false } });
  assert.doesNotMatch(withoutPhotos, /class="estimate-item-photo" src=/);
  for (const html of [withPhotos, withoutPhotos]) assert.match(html, /data-estimate-grand-total>200 ₽/);
  assert.doesNotMatch(estimateHtml({ est, company: { sign: 'javascript:alert(1)' } }), /alt="Подпись исполнителя"/);
});
