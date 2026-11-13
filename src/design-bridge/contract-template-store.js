import { normalizeContractTemplate } from '../data/contract.js';

export const DESIGN_CONTRACT_TEMPLATE_KEY = 'zamer.contractTpl';

export function loadDesignContractTemplate(storage) {
  try {
    const source = storage ?? globalThis.localStorage;
    const raw = source.getItem(DESIGN_CONTRACT_TEMPLATE_KEY);
    if (raw != null) {
      const saved = JSON.parse(raw);
      return normalizeContractTemplate(saved);
    }
    const main = JSON.parse(source.getItem('magicapp_v2_4_autosave_v1') || 'null');
    const head = main?.contract?.head;
    return head && typeof head === 'object' && !Array.isArray(head)
      ? normalizeContractTemplate({ head })
      : normalizeContractTemplate();
  } catch {
    return normalizeContractTemplate();
  }
}

export function saveDesignContractTemplate(template, storage) {
  try { (storage ?? globalThis.localStorage).setItem(DESIGN_CONTRACT_TEMPLATE_KEY, JSON.stringify(template)); } catch { /* private mode */ }
}

/** A host may supply its own persistence without reading the mobile template key. */
export function contractTemplateAccess(store) {
  if (store == null) return { load: loadDesignContractTemplate, save: saveDesignContractTemplate };
  return {
    load() {
      const saved = store.load();
      return normalizeContractTemplate(saved);
    },
    save(template) { store.save(template); },
  };
}

/** Reuse actual main-app document details only until this prototype has its own saved header. */
export function loadCompanyHeader(storage) {
  return loadDesignContractTemplate(storage).head;
}
