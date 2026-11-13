import assert from 'node:assert/strict';
import test from 'node:test';
import { contractTemplateAccess, saveDesignContractTemplate } from '../src/design-bridge/contract-template-store.js';

test('document settings expose storage failure so the editor can keep the unsaved draft open', () => {
  const storage = { setItem() { throw new Error('QuotaExceededError'); } };
  assert.throws(() => saveDesignContractTemplate({ sections: [] }, storage), /Не удалось сохранить/);
});

test('an explicit rejected host save is not reported as a saved document template', () => {
  const access = contractTemplateAccess({ load: () => null, save: () => false });
  assert.throws(() => access.save({ sections: [] }), /Не удалось сохранить/);
});
