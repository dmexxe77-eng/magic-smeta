import { normalizeEstimateTemplate } from '../utils/estimate-template.js';

export function estimateHeaderCompany(company = {}, access) {
  const head = access.load().head;
  return { ...head, ...company, estimateTemplate: normalizeEstimateTemplate(company.estimateTemplate ?? head.estimateTemplate) };
}

/** The host profile is authoritative; standalone SDK consumers use the saved header. */
export async function persistEstimateHeaderPatch({ access, onCompanyChange }, patch) {
  if (typeof onCompanyChange === 'function') {
    if (await onCompanyChange(patch) === false) throw new Error('Не удалось сохранить настройки сметы. Попробуйте ещё раз.');
    return;
  }
  const current = access.load();
  if (await access.save({ ...current, head: { ...current.head, ...patch } }) === false) {
    throw new Error('Не удалось сохранить настройки сметы. Попробуйте ещё раз.');
  }
}

export function estimateHeaderPreview(company) {
  return {
    company, template: company.estimateTemplate,
    project: { name: 'Пример сметы', client: 'Иванов Алексей Сергеевич', address: 'Пример: ул. Садовая, дом 12', phone: '+7 (999) 123-45-67' },
    rooms: [{ name: 'Гостиная', area: 42.6 }],
    est: { mats: [{ n: 'Полотно натяжного потолка', q: 42.6, p: 1500, u: 'м²' }], works: [{ n: 'Монтаж натяжного потолка', q: 1, p: 21100, u: 'компл.' }] },
  };
}
