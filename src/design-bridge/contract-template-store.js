import { DEFAULT_CONTRACT_TPL } from '../data/contract.js';

export const DESIGN_CONTRACT_TEMPLATE_KEY = 'zamer.contractTpl';

export function loadDesignContractTemplate(storage) {
  try {
    const source = storage ?? globalThis.localStorage;
    const raw = source.getItem(DESIGN_CONTRACT_TEMPLATE_KEY);
    if (raw != null) {
      const saved = JSON.parse(raw);
      return saved ? { ...DEFAULT_CONTRACT_TPL, ...saved, head: { ...DEFAULT_CONTRACT_TPL.head, ...(saved.head || {}) } } : DEFAULT_CONTRACT_TPL;
    }
    const main = JSON.parse(source.getItem('magicapp_v2_4_autosave_v1') || 'null');
    const head = main?.contract?.head;
    return head && typeof head === 'object' && !Array.isArray(head)
      ? { ...DEFAULT_CONTRACT_TPL, head: { ...DEFAULT_CONTRACT_TPL.head, ...head } }
      : DEFAULT_CONTRACT_TPL;
  } catch {
    return DEFAULT_CONTRACT_TPL;
  }
}

export function saveDesignContractTemplate(template, storage) {
  try { (storage ?? globalThis.localStorage).setItem(DESIGN_CONTRACT_TEMPLATE_KEY, JSON.stringify(template)); } catch { /* private mode */ }
}

/** Reuse actual main-app document details only until this prototype has its own saved header. */
export function loadCompanyHeader(storage) {
  return loadDesignContractTemplate(storage).head;
}
