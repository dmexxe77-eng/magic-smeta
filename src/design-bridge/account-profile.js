import { normalizeContractLegalForm } from '../data/contract.js';

/** Native profile options; switching form never erases hidden requisites. */
export const LEGAL_FORMS = [
  { id: 'ip', label: 'ИП', nameLabel: 'ФИО', namePlaceholder: 'Иванов Иван Иванович', showInn: true, showKpp: false, showOgrn: true, ogrnLabel: 'ОГРНИП', showLegalAddress: true },
  { id: 'ooo', label: 'ООО', nameLabel: 'Наименование', namePlaceholder: 'ООО «Название»', showInn: true, showKpp: true, showOgrn: true, ogrnLabel: 'ОГРН', showLegalAddress: true },
  { id: 'ao', label: 'АО', nameLabel: 'Наименование', namePlaceholder: 'АО «Название»', showInn: true, showKpp: true, showOgrn: true, ogrnLabel: 'ОГРН', showLegalAddress: true },
  { id: 'self_employed', label: 'Самозанятый', nameLabel: 'ФИО', namePlaceholder: 'Иванов Иван Иванович', showInn: true, showKpp: false, showOgrn: false, ogrnLabel: 'ОГРН', showLegalAddress: true },
];

const text = value => typeof value === 'string' ? value.trim() : '';
const BANK_FIELDS = ['bankAccount', 'bankBik', 'bankName', 'bankCorrAccount'];
const FIELDS = ['name', 'company', 'phone', 'email', 'city', 'legal', 'inn', 'kpp', 'ogrn', 'address', ...BANK_FIELDS, 'contractPhone', 'signerName', 'site'];

export function bankDetailsText(parts = {}) {
  return [parts.bankAccount && 'Р/с ' + text(parts.bankAccount), parts.bankBik && 'БИК ' + text(parts.bankBik), text(parts.bankName), parts.bankCorrAccount && 'К/с ' + text(parts.bankCorrAccount)].filter(Boolean).join('\n');
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
    legalForm: normalizeContractLegalForm(profile.legalForm),
    phone: formatProfilePhone(profile.phone), contractPhone: formatProfilePhone(profile.contractPhone),
    bank: bankDetailsText(profile) || text(profile.bank),
    avatar: text(profile.avatar), logo: text(profile.logo), sign: text(profile.sign),
    vat, vatRate: rate, bio: profile.bio !== false, pin: profile.pin === true,
  };
}

export function validateProfileField(key, value) {
  const next = String(value ?? '').trim();
  if (key === 'name' && next.length > 0 && next.length < 2) return 'Имя должно быть не менее 2 символов';
  if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return 'Укажите корректный email';
  if (key === 'phone' && phoneDigits(next).length !== 11) return 'Укажите корректный номер телефона';
  if (key === 'contractPhone' && !['', '7'].includes(phoneDigits(next)) && phoneDigits(next).length !== 11) return 'Укажите корректный номер телефона';
  if (key === 'vatRate') {
    const rate = next ? Number(next.replace(',', '.')) : NaN;
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 'Укажите размер НДС от 0 до 100';
  }
  return null;
}

export function profileFieldPatch(key, value) {
  const canonical = key === 'legalAddress' ? 'address' : key;
  if (![...FIELDS, 'vatRate'].includes(canonical)) throw new Error('Неизвестное поле профиля');
  const error = validateProfileField(canonical, value);
  if (error) throw new Error(error);
  const next = String(value ?? '').trim();
  return { [canonical]: canonical === 'email' ? next.toLowerCase() : canonical === 'vatRate' ? String(Number(next.replace(',', '.'))).replace('.', ',') : ['phone', 'contractPhone'].includes(canonical) ? (phoneDigits(next).length === 11 ? formatProfilePhone(next) : '') : next };
}

/** Keep local account edits limited to profile fields; credentials never enter backups. */
export function mergeAccountProfilePatch(current = {}, patch = {}) {
  const next = { ...current };
  const allowed = [...FIELDS, 'legalForm', 'bank', 'avatar', 'logo', 'sign', 'vat', 'vatRate', 'bio', 'pin'];
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    if (['vat', 'bio', 'pin'].includes(key)) {
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
