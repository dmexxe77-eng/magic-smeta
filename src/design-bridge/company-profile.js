import { loadCompanyHeader } from './contract-template-store.js';
import { normalizeContractLegalForm } from '../data/contract.js';
import { bankDetailsText } from './account-profile.js';

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
  const legalName = value(['legal']);
  const prefix = ({ ip: 'ИП', self_employed: 'Самозанятый' })[legalForm];
  const legal = prefix && legalName && !legalName.toLocaleLowerCase('ru').startsWith(prefix.toLocaleLowerCase('ru')) ? prefix + ' ' + legalName : legalName;
  const bank = bankDetailsText(saved) || value(['bank']);
  return {
    company: value(['company']), description: value(['description']),
    legal, legalForm, inn: value(['inn']), kpp: value(['kpp']), ogrn: value(['ogrn']),
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
