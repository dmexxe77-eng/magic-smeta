import { acceptanceHtml, contractHtml, contractFields, nextContractNumber, normalizeContractTemplate, signatureNameFromClient } from './contract.js';

const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const text = value => String(value ?? '').trim();
const amount = value => Math.round((value + Number.EPSILON) * 100) / 100;
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const pad = value => String(value).padStart(2, '0');
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const pick = (value, keys) => Object.fromEntries(keys.filter(key => owns(value, key)).map(key => [key, copy(value[key])]));
const PARTY_KEYS = ['client', 'phone', 'address', 'companyName', 'inn', 'kpp', 'legalAddress', 'representative', 'authority', 'signerName'];
const ACT_KEYS = ['number', 'date', 'completionDate', 'acceptance', 'remarks', 'remedyDate', 'scope', 'total', 'paid'];

function snapshotActValues(act) {
  const value = pick(act, ACT_KEYS);
  value.total = amount(parseContractMoney(value.total));
  value.paid = value.paid === '' || value.paid == null ? null : amount(parseContractMoney(value.paid));
  return value;
}

function snapshotTemplate(template) {
  const tpl = copy(normalizeContractTemplate(template));
  delete tpl.head.sign;
  delete tpl.head.signature;
  return tpl;
}

// Project documents must not recursively capture their own previous editions.
function snapshotContext(context = {}) {
  return {
    project: pick(context.project, ['id', 'name', 'client', 'address', 'phone', 'area']),
    rooms: (Array.isArray(context.rooms) ? context.rooms : []).map(room => pick(room, ['id', 'name', 'on', 'area', 'v', 'holes', 'est'])),
  };
}

function calendarDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const raw = text(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/) || raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [year, month, day] = raw.includes('-') ? match.slice(1).map(Number) : [Number(match[3]), Number(match[2]), Number(match[1])];
  const date = new Date(year, month - 1, day);
  return year >= 1900 && year <= 2200 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function formatDocumentDate(value) {
  const date = calendarDate(value);
  return date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` : text(value);
}

export function parseContractMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isSafeInteger(Math.round(value * 100)) ? value : NaN;
  const raw = text(value).replace(/\s/g, '');
  if (!/^-?(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(raw)) return NaN;
  const number = Number(raw.replace(',', '.'));
  return Number.isFinite(number) && Number.isSafeInteger(Math.round(number * 100)) ? number : NaN;
}

/** Refresh calculator values on entry while keeping entered contract conditions. */
export function createContractDraft({ saved, project = {}, total = 0, area = '', installDate = '', template, today = new Date(), refreshFromProject = false } = {}) {
  const tpl = normalizeContractTemplate(template);
  const previous = saved || {};
  const storedParty = previous.party || {};
  const value = (key, fallback = '') => refreshFromProject && owns(project, key) ? project[key] : owns(storedParty, key) ? storedParty[key] : owns(previous, key) ? previous[key] : project[key] ?? fallback;
  const party = {
    client: value('client'), phone: value('phone'), address: value('address'),
    companyName: value('companyName'), inn: value('inn'), kpp: value('kpp'),
    legalAddress: value('legalAddress'), representative: value('representative'), authority: value('authority'),
    signerName: owns(storedParty, 'signerName') ? storedParty.signerName : null,
  };
  const initialTotal = !refreshFromProject && owns(previous, 'total') ? previous.total : total;
  const parsedTotal = parseContractMoney(initialTotal);
  const documentValue = (key, fallback) => previous.status === 'draft' && owns(previous, key) ? previous[key] : previous[key] || fallback;
  const date = documentValue('date', typeof today === 'string' ? today : iso(today));
  const numberAuto = owns(previous, 'numberAuto') ? previous.numberAuto === true : !owns(previous, 'number');
  const suggestedNumber = nextContractNumber(tpl, calendarDate(date) || new Date());
  return {
    number: previous.status === 'draft' && previous.numberAllocated !== true && numberAuto ? suggestedNumber : documentValue('number', suggestedNumber),
    numberAuto,
    date, startDate: documentValue('startDate', previous.installDate || installDate || ''), endDate: documentValue('endDate', ''),
    prepay: owns(previous, 'prepay') ? previous.prepay : Number.isFinite(parsedTotal) ? amount(parsedTotal * tpl.settings.prepayPercent / 100) : '',
    total: initialTotal, area: !refreshFromProject && owns(previous, 'area') ? previous.area : area,
    customerType: previous.customerType || tpl.settings.customerType || 'universal', party,
    client: party.client, phone: party.phone, address: party.address,
    version: Number.isInteger(previous.version) && previous.version > 0 ? previous.version : 1,
  };
}

export function validateContractDraft(draft = {}) {
  const errors = {}, party = draft.party || draft;
  if (!text(draft.number)) errors.number = 'Укажите номер договора';
  if (!calendarDate(draft.date)) errors.date = 'Укажите корректную дату договора';
  const start = calendarDate(draft.startDate), end = calendarDate(draft.endDate);
  if (!start) errors.startDate = 'Укажите дату начала работ';
  if (!end) errors.endDate = 'Укажите дату завершения работ';
  else if (start && end < start) errors.endDate = 'Завершение не может быть раньше начала работ';
  if (!text(party.client || party.companyName)) errors.client = 'Укажите ФИО или наименование заказчика';
  if (!text(party.address)) errors.address = 'Укажите адрес объекта';
  const total = parseContractMoney(draft.total), prepay = parseContractMoney(draft.prepay);
  if (!Number.isFinite(total) || total < 0) errors.total = 'Укажите корректную сумму договора';
  if (!Number.isFinite(prepay) || prepay < 0) errors.prepay = 'Укажите корректную предоплату';
  else if (Number.isFinite(total) && prepay > total) errors.prepay = 'Предоплата не может превышать сумму договора';
  if (text(party.inn) && !/^\d{10}(\d{2})?$/.test(text(party.inn))) errors.inn = 'ИНН должен содержать 10 или 12 цифр';
  if (text(party.kpp) && !/^\d{9}$/.test(text(party.kpp))) errors.kpp = 'КПП должен содержать 9 цифр';
  return errors;
}

export function contractDraftFields(draft = {}) {
  const party = draft.party || draft;
  const total = parseContractMoney(draft.total), prepay = parseContractMoney(draft.prepay);
  return contractFields({ client: party.client || party.companyName, phone: party.phone, address: party.address }, Number.isFinite(total) ? total : 0, {
    number: draft.number, date: formatDocumentDate(draft.date), prepay: Number.isFinite(prepay) ? prepay : 0,
    area: draft.area, startDate: formatDocumentDate(draft.startDate), installDate: formatDocumentDate(draft.endDate), customerType: draft.customerType || 'universal',
    custom: { инн_заказчика: party.inn || '', кпп_заказчика: party.kpp || '', юр_адрес_заказчика: party.legalAddress || '', представитель: party.representative || '', основание: party.authority || '', подпись_заказчика: party.signerName ?? signatureNameFromClient(party.client, party) },
  });
}

function assertValid(errors, message) {
  if (!Object.keys(errors).length) return;
  const error = new Error(message);
  error.fields = errors;
  throw error;
}

export function createContractSnapshot({ draft, template, est, estimateAdjustment, estimateExportOptions, documentContext, actDraft } = {}) {
  assertValid(validateContractDraft(draft), 'Проверьте данные договора');
  if (actDraft != null) assertValid(validateActDraft(actDraft), 'Проверьте данные акта');
  const frozenDraft = copy(draft), tpl = snapshotTemplate(template);
  const estimate = copy(est || { mats: [], works: [] }), adjustment = copy(estimateAdjustment), exportOptions = copy(estimateExportOptions), context = snapshotContext(documentContext);
  const fields = contractDraftFields(frozenDraft), party = pick(frozenDraft.party || frozenDraft, PARTY_KEYS);
  const act = actDraft == null ? null : snapshotActValues(actDraft);
  return {
    schemaVersion: 2, status: 'ready', frozen: true, version: frozenDraft.version || 1,
    number: text(frozenDraft.number), date: frozenDraft.date, startDate: frozenDraft.startDate, endDate: frozenDraft.endDate,
    total: amount(parseContractMoney(frozenDraft.total)), prepay: amount(parseContractMoney(frozenDraft.prepay)), area: frozenDraft.area,
    installDate: frozenDraft.endDate, client: text(party.client || party.companyName), phone: text(party.phone), address: text(party.address),
    customerType: frozenDraft.customerType || 'universal', party, fields, template: tpl,
    est: estimate, estimateAdjustment: adjustment, estimateExportOptions: exportOptions, documentContext: context,
    actDraft: act,
    html: contractHtml(tpl, fields, estimate, adjustment, exportOptions, context),
  };
}

export function validateActDraft(act = {}) {
  const errors = {};
  if (!text(act.number)) errors.number = 'Укажите номер акта';
  const date = calendarDate(act.date), completion = calendarDate(act.completionDate);
  if (!date) errors.date = 'Укажите корректную дату акта';
  if (!completion) errors.completionDate = 'Укажите дату завершения работ';
  else if (date && completion > date) errors.completionDate = 'Завершение не может быть позже даты акта';
  if (!text(act.scope)) errors.scope = 'Укажите фактически выполненные работы';
  if (text(act.acceptance) && !['none', 'remarks', 'partial'].includes(act.acceptance)) errors.acceptance = 'Укажите результат приёмки';
  const remedy = calendarDate(act.remedyDate);
  if (text(act.remedyDate) && !remedy) errors.remedyDate = 'Укажите корректный срок устранения замечаний';
  else if (remedy && date && remedy < date) errors.remedyDate = 'Срок устранения не может быть раньше даты акта';
  if (act.acceptance === 'partial' && !text(act.remarks)) errors.remarks = 'Укажите, какие работы ещё не приняты';
  const total = parseContractMoney(act.total);
  if (!Number.isFinite(total) || total < 0) errors.total = 'Укажите корректную стоимость работ';
  if (act.paid !== '' && act.paid != null) {
    const paid = parseContractMoney(act.paid);
    if (!Number.isFinite(paid) || paid < 0) errors.paid = 'Укажите корректную полученную оплату';
  }
  return errors;
}

/** Use current act wording while retaining the agreement's parties and reference. */
export function createActSnapshot({ contract, act, template, est, estimateAdjustment, estimateExportOptions, documentContext } = {}) {
  if (!contract?.html) throw new Error('Сначала сформируйте договор');
  assertValid(validateActDraft(act), 'Проверьте данные акта');
  const tpl = snapshotTemplate(template ?? contract.template);
  if (contract.template?.head) tpl.head = snapshotTemplate(contract.template).head;
  const value = snapshotActValues(act), fields = copy(contract.fields || contractDraftFields(createContractDraft({ saved: contract, template: tpl })));
  return {
    ...value, schemaVersion: 2, status: 'ready', frozen: true, version: Number.isInteger(act.version) && act.version > 0 ? act.version : 1,
    contractNumber: contract.number, contractDate: contract.date, contractVersion: contract.version || 1,
    contractTotal: contract.total, party: pick(contract.party || contract, PARTY_KEYS), template: tpl,
    html: acceptanceHtml(tpl, fields, value, contract.est || est, contract.estimateAdjustment || estimateAdjustment, contract.estimateExportOptions || estimateExportOptions, contract.documentContext || documentContext),
  };
}
