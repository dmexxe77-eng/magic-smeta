import { loadCompanyHeader } from './contract-template-store.js';
import { normalizeContractLegalForm } from '../data/contract.js';
import { accountLegalForm, bankDetailsText, validateProfileField } from './account-profile.js';
import { normalizeEstimateTemplate } from '../utils/estimate-template.js';

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const text = value => typeof value === 'string' ? value.trim() : '';

/** Only entered values are exported; an explicitly cleared profile field stays empty. */
export function getCompanyDetails(profile, storage) {
  const saved = record(profile), head = record(loadCompanyHeader(storage));
  const value = (keys, fallbackKeys = keys) => {
    const key = keys.find(key => owns(saved, key));
    if (key !== undefined) return text(saved[key]);
    const fallback = fallbackKeys.find(key => owns(head, key));
    return fallback === undefined ? '' : text(head[fallback]);
  };
  const legalForm = normalizeContractLegalForm(value(['legalForm']));
  const form = accountLegalForm(legalForm);
  const identifier = key => {
    const entered = value([key]);
    return form && validateProfileField(key, entered, { legalForm }) ? '' : entered;
  };
  const legalName = value(['legal']);
  const prefix = ({ ip: 'ИП', self_employed: 'Самозанятый' })[legalForm];
  const legal = prefix && legalName && !legalName.toLocaleLowerCase('ru').startsWith(prefix.toLocaleLowerCase('ru')) ? prefix + ' ' + legalName : legalName;
  const bank = bankDetailsText({ ...saved, legalForm }) || value(['bank']);
  const estimateTemplate = owns(saved, 'estimateTemplate') ? saved.estimateTemplate : head.estimateTemplate;
  return {
    ...(estimateTemplate && typeof estimateTemplate === 'object' && !Array.isArray(estimateTemplate) ? { estimateTemplate: normalizeEstimateTemplate(estimateTemplate) } : {}),
    company: value(['company']), description: value(['description']), companyAddress: value(['companyAddress']),
    legal, legalForm, inn: identifier('inn'), kpp: form && !form.showKpp ? '' : value(['kpp']), ogrn: form && !form.showOgrn ? '' : identifier('ogrn'),
    address: value(['address']), city: value(['city']), phone: value(['contractPhone', 'phone'], ['phone']),
    email: value(['email']), website: value(['site', 'website'], ['website', 'site']),
    logo: value(['logo']), sign: value(['sign', 'signature']), signerName: value(['signerName']), bank,
  };
}

/** Profile fields inherit existing document details without storing a stale copy of them. */
export function getCompanyProfile(profile, storage) {
  const saved = record(profile), company = getCompanyDetails(saved, storage);
  return {
    name: '', phone: '', city: '',
    notif: { tg: true, push: true, email: false }, pin: false, bio: true, vat: false, pricesMode: 'retail',
    ...company, contractPhone: company.phone, site: company.website,
    ...saved,
  };
}
