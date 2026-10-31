import { loadCompanyHeader } from './contract-template-store.js';

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
  return {
    company: value(['company']), description: value(['description']),
    legal: value(['legal']), inn: value(['inn']), ogrn: value(['ogrn']),
    address: value(['address']), phone: value(['contractPhone', 'phone'], ['phone']),
    email: value(['email']), website: value(['site', 'website'], ['website', 'site']),
    logo: value(['logo']), bank: value(['bank']),
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
