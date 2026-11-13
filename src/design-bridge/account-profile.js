import { normalizeContractLegalForm } from '../data/contract.js';
import { normalizeEstimateTemplate } from '../utils/estimate-template.js';

/** Native profile options; switching form never erases hidden requisites. */
export const LEGAL_FORMS = [
  { id: 'ip', label: 'ИП', nameLabel: 'ФИО', namePlaceholder: 'Иванов Иван Иванович', showInn: true, innLength: 12, showKpp: false, showOgrn: true, ogrnLabel: 'ОГРНИП', ogrnLength: 15, showLegalAddress: true, addressLabel: 'Адрес регистрации' },
  { id: 'ooo', label: 'ООО', nameLabel: 'Наименование', namePlaceholder: 'ООО «Название»', showInn: true, innLength: 10, showKpp: true, showOgrn: true, ogrnLabel: 'ОГРН', ogrnLength: 13, showLegalAddress: true, addressLabel: 'Юр. адрес' },
  { id: 'self_employed', label: 'Самозанятый', nameLabel: 'ФИО', namePlaceholder: 'Иванов Иван Иванович', showInn: true, innLength: 12, showKpp: false, showOgrn: false, ogrnLabel: 'ОГРН', showLegalAddress: true, addressLabel: 'Адрес для документов' },
];

/** Previously saved AO details remain readable, but AO cannot be selected anew. */
export function accountLegalForm(value) {
  const id = normalizeContractLegalForm(typeof value === 'object' ? value?.legalForm : value);
  return LEGAL_FORMS.find(form => form.id === id) || (id === 'ao' ? { ...LEGAL_FORMS.find(form => form.id === 'ooo'), id, label: 'АО (сохранено)', namePlaceholder: 'АО «Название»' } : null);
}

const text = value => typeof value === 'string' ? value.trim() : '';
const BANK_FIELDS = ['bankAccount', 'bankBik', 'bankName', 'bankCorrAccount'];
const FIELDS = ['name', 'company', 'phone', 'email', 'city', 'companyAddress', 'legal', 'inn', 'kpp', 'ogrn', 'address', ...BANK_FIELDS, 'contractPhone', 'signerName', 'site'];

export function bankDetailsText(parts = {}) {
  const accountLabel = normalizeContractLegalForm(parts.legalForm) === 'self_employed' ? 'Счёт ' : 'Р/с ';
  return [parts.bankAccount && accountLabel + text(parts.bankAccount), parts.bankBik && 'БИК ' + text(parts.bankBik), text(parts.bankName), parts.bankCorrAccount && 'К/с ' + text(parts.bankCorrAccount)].filter(Boolean).join('\n');
}

function phoneDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits.length === 10 && digits.startsWith('9')) digits = '7' + digits;
  if (digits && !digits.startsWith('7')) digits = '7' + digits;
  return digits.slice(0, 11);
}

export function formatProfilePhone(value) {
  const digits = phoneDigits(value);
  if (!digits) return '';
  const rest = digits.slice(1);
  if (!rest) return '+7';
  let result = '+7 (' + rest.slice(0, 3);
  if (rest.length <= 3) return result;
  result += ') ' + rest.slice(3, 6);
  if (rest.length <= 6) return result;
  result += '-' + rest.slice(6, 8);
  if (rest.length <= 8) return result;
  return result + '-' + rest.slice(8, 10);
}

export function accountProfile(input = {}) {
  const profile = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const fields = Object.fromEntries(FIELDS.map(key => [key, text(profile[key])]));
  const vat = !!profile.vat;
  const rate = profile.vatRate == null || profile.vatRate === '' ? (vat ? '20' : '') : String(profile.vatRate).replace('.', ',');
  return { ...profile, ...fields,
    ...(Object.hasOwn(profile, 'estimateTemplate') ? { estimateTemplate: normalizeEstimateTemplate(profile.estimateTemplate) } : {}),
    legalForm: normalizeContractLegalForm(profile.legalForm),
    phone: formatProfilePhone(profile.phone), contractPhone: formatProfilePhone(profile.contractPhone),
    bank: bankDetailsText(profile) || text(profile.bank),
    avatar: text(profile.avatar), logo: text(profile.logo), sign: text(profile.sign),
    vat, vatRate: rate, bio: profile.bio !== false, pin: profile.pin === true,
  };
}

export function validateProfileField(key, value, profile = {}) {
  const next = String(value ?? '').trim();
  const form = accountLegalForm(profile);
  if (key === 'name' && next.length > 0 && next.length < 2) return 'Имя должно быть не менее 2 символов';
  if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return 'Укажите корректный email';
  if (key === 'phone' && phoneDigits(next).length !== 11) return 'Укажите корректный номер телефона';
  if (key === 'contractPhone' && !['', '7'].includes(phoneDigits(next)) && phoneDigits(next).length !== 11) return 'Укажите корректный номер телефона';
  if (next && key === 'inn' && !(form?.innLength ? new RegExp('^\\d{' + form.innLength + '}$') : /^\d{10}(\d{2})?$/).test(next)) return 'ИНН должен содержать ' + (form?.innLength || '10 или 12') + ' цифр';
  if (next && key === 'kpp' && !/^\d{9}$/.test(next)) return 'КПП должен содержать 9 цифр';
  if (next && key === 'ogrn' && !(form?.ogrnLength ? new RegExp('^\\d{' + form.ogrnLength + '}$') : /^\d{13}(\d{2})?$/).test(next)) return (form?.ogrnLabel || 'ОГРН / ОГРНИП') + ' должен содержать ' + (form?.ogrnLength || '13 или 15') + ' цифр';
  if (next && ['bankAccount', 'bankCorrAccount'].includes(key) && !/^\d{20}$/.test(next)) return 'Номер счёта должен содержать 20 цифр';
  if (next && key === 'bankBik' && !/^\d{9}$/.test(next)) return 'БИК должен содержать 9 цифр';
  if (key === 'vatRate') {
    const rate = next ? Number(next.replace(',', '.')) : NaN;
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 'Укажите размер НДС от 0 до 100';
  }
  return null;
}

export function profileFieldPatch(key, value, profile = {}) {
  const canonical = key === 'legalAddress' ? 'address' : key;
  if (![...FIELDS, 'vatRate'].includes(canonical)) throw new Error('Неизвестное поле профиля');
  const error = validateProfileField(canonical, value, profile);
  if (error) throw new Error(error);
  const next = String(value ?? '').trim();
  return { [canonical]: canonical === 'email' ? next.toLowerCase() : canonical === 'vatRate' ? String(Number(next.replace(',', '.'))).replace('.', ',') : ['phone', 'contractPhone'].includes(canonical) ? (phoneDigits(next).length === 11 ? formatProfilePhone(next) : '') : next };
}

/** Keep local account edits limited to profile fields; credentials never enter backups. */
export function mergeAccountProfilePatch(current = {}, patch = {}) {
  const next = { ...current };
  const allowed = [...FIELDS, 'legalForm', 'bank', 'avatar', 'logo', 'sign', 'estimateTemplate', 'vat', 'vatRate', 'bio', 'pin'];
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    if (key === 'estimateTemplate') {
      if (!patch[key] || typeof patch[key] !== 'object' || Array.isArray(patch[key])) throw new Error('Некорректное оформление сметы');
      next[key] = normalizeEstimateTemplate(patch[key]);
    } else if (['vat', 'bio', 'pin'].includes(key)) {
      if (typeof patch[key] !== 'boolean') throw new Error('Некорректное значение настройки');
      next[key] = patch[key];
    } else {
      if (typeof patch[key] !== 'string') throw new Error('Некорректное значение поля');
      next[key] = patch[key].trim();
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'legalForm')) {
    next.legalForm = normalizeContractLegalForm(next.legalForm);
    if (!LEGAL_FORMS.some(form => form.id === next.legalForm)) throw new Error('Выберите форму из списка');
  }
  if (BANK_FIELDS.some(key => Object.prototype.hasOwnProperty.call(patch, key))) next.bank = bankDetailsText(next);
  if (next.vat && (next.vatRate == null || next.vatRate === '')) next.vatRate = '20';
  return next;
}
