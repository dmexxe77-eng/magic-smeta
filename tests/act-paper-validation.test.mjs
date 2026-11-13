import test from 'node:test';
import assert from 'node:assert/strict';
import { createContractDraft, createContractSnapshot, createActSnapshot, validateActDraft } from '../src/data/contract-documents.js';

const act = { number: 'А-12', date: '2026-11-22', completionDate: '2026-11-21', scope: 'Монтаж потолка, 12 м²', total: 12000, paid: '', acceptance: '', remarks: '', remedyDate: '' };

test('an act can be exported with acceptance and remarks left for handwriting', () => {
  const draft = createContractDraft({ project: { client: 'Заказчик', address: 'Объект' }, total: 12000, today: '2026-11-13' });
  Object.assign(draft, { startDate: '2026-11-20', endDate: '2026-11-21' });
  const contract = createContractSnapshot({ draft });
  for (const acceptance of ['', 'remarks']) {
    const value = { ...act, acceptance };
    assert.deepEqual(validateActDraft(value), {});
    const snapshot = createActSnapshot({ contract, act: value });
    assert.match(snapshot.html, /Замечания при приёмке/);
    assert.match(snapshot.html, /data-document-signatures/);
    assert.doesNotMatch(snapshot.html, /не заполнены|не указано|без заявленных при осмотре замечаний/);
    assert.equal(snapshot.total, 12000);
    assert.equal(snapshot.remarks, '');
  }
});

test('handwriting blanks do not allow malformed dates, unknown status or invalid amounts', () => {
  assert.ok(validateActDraft({ ...act, acceptance: 'unknown' }).acceptance);
  assert.ok(validateActDraft({ ...act, acceptance: 'remarks', remedyDate: '2026-02-30' }).remedyDate);
  assert.ok(validateActDraft({ ...act, acceptance: 'remarks', remedyDate: '2026-11-21' }).remedyDate);
  assert.ok(validateActDraft({ ...act, acceptance: 'none', remedyDate: '2026-02-30' }).remedyDate);
  assert.ok(validateActDraft({ ...act, completionDate: '2026-11-23' }).completionDate);
  assert.ok(validateActDraft({ ...act, total: -1 }).total);
  assert.ok(validateActDraft({ ...act, total: 'ошибка' }).total);
  assert.equal(validateActDraft({ ...act, total: 0 }).total, undefined);
});

test('an exported act preserves entered remarks exactly as its preview does', () => {
  const draft = createContractDraft({ project: { client: 'Заказчик', address: 'Объект' }, total: 12000, today: '2026-11-13' });
  Object.assign(draft, { startDate: '2026-11-20', endDate: '2026-11-21' });
  const contract = createContractSnapshot({ draft });
  const snapshot = createActSnapshot({ contract, act: { ...act, acceptance: 'none', remarks: 'Проверить примыкание', remedyDate: '2026-11-25' } });
  assert.equal(snapshot.remarks, 'Проверить примыкание');
  assert.equal(snapshot.remedyDate, '2026-11-25');
  assert.match(snapshot.html, /Проверить примыкание/);
  assert.match(snapshot.html, /25\.11\.2026/);
});
