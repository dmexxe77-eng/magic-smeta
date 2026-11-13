import { adjustmentLabel } from "../utils/estimate-adjustment.js";
import { prepareEstimateExport } from "../utils/estimate-export.js";
import { estimateHtml } from "../utils/estimate-html.js";
import { estimatePresetTemplate } from "../utils/estimate-template.js";
import { estimateAdjustmentVisibility } from "../utils/estimate-export-options.js";

/* Шаблон один на студию. При экспорте проект сохраняет текущий документ;
   при следующем открытии его данные обновляются из актуального расчёта. */

/* Живой шаблон для автосейва (App держит его в состоянии и синхронизирует сюда) */
export const CONTRACT_TPL_REF = { current: null };

export const CONTRACT_ESTIMATE_TYPES = [
  { id: 'total', label: 'Общая смета', sub: 'Материалы, оборудование и работы' },
  { id: 'totalDraw', label: 'Общая + чертежи', sub: 'Плюс план каждого помещения' },
  { id: 'perRoom', label: 'По помещениям', sub: 'Отдельная таблица на каждое' },
];
export const CONTRACT_ESTIMATE_COLUMNS = [['num', '#'], ['photo', 'Фото'], ['name', 'Название'], ['qty', 'Кол-во'], ['unit', 'Ед.'], ['price', 'Цена'], ['total', 'Итого']];
export const DEFAULT_CONTRACT_ESTIMATE_OPTIONS = { type: 'total', cols: Object.fromEntries(CONTRACT_ESTIMATE_COLUMNS.map(([key]) => [key, true])) };
export const DEFAULT_CONTRACT_SETTINGS = { prepayPercent: 50, customerType: 'universal', warrantyWorksMonths: '', warrantyMaterials: 'По условиям изготовителя' };
const DEFAULT_WARRANTY_TEXT = 'Исполнитель гарантирует качество монтажных работ. Гарантия на материалы — по условиям изготовителя. Требования в отношении недостатков рассматриваются в порядке и сроки, предусмотренные законодательством РФ. Права Заказчика, установленные законом, сохраняются.';
const LEGACY_WARRANTY_TEXT = '{гарантия_монтажа} Условия гарантии на материалы: {гарантия_материалов}. Порядок обращения по недостаткам и ответственность сторон определяются договором и применимыми требованиями законодательства РФ.';

function materializeWarranty(settings) {
  const months = Number(String(settings.warrantyWorksMonths ?? '').trim().replace(',', '.'));
  const materials = typeof settings.warrantyMaterials === 'string' ? settings.warrantyMaterials.trim() : '';
  const hasMonths = Number.isFinite(months) && months > 0;
  const hasMaterials = materials && materials !== DEFAULT_CONTRACT_SETTINGS.warrantyMaterials;
  if (!hasMonths && !hasMaterials) return DEFAULT_WARRANTY_TEXT;
  const works = hasMonths ? `Дополнительная гарантия на монтажные работы — ${months.toLocaleString('ru-RU')} мес. с даты завершения работ.` : 'Исполнитель гарантирует качество монтажных работ.';
  return `${works} Гарантия на материалы — ${(materials || DEFAULT_CONTRACT_SETTINGS.warrantyMaterials).replace(/\.+$/, '')}. Требования в отношении недостатков рассматриваются в порядке и сроки, предусмотренные законодательством РФ. Права Заказчика, установленные законом, сохраняются.`;
}
export const DEFAULT_ACT_SECTIONS = [
  { id: 'act-result', title: 'Результат работ', text: 'Работы по договору № {номер_договора} от {дата_договора} по адресу: {адрес}:\n{работы_акта}\nДата фактического завершения работ: {дата_завершения}.' },
  { id: 'act-acceptance', title: 'Приёмка', text: 'Стороны фиксируют результат осмотра и приёмки работ:\n{результат_приёмки}\n{замечания_акта}\n{срок_устранения}' },
  { id: 'act-costs', title: 'Стоимость и расчёты', text: 'Стоимость работ по договору: {сумма} ₽.\nСтоимость работ по акту: {сумма_акта} ₽.\nПолученная оплата: {оплата_акта}.\nОстаток по акту: {остаток_акта}.' },
  { id: 'act-rights', title: 'Заключительные положения', text: 'Оформление акта не является подтверждением оплаты. Права сторон в отношении скрытых недостатков сохраняются в соответствии с законодательством РФ.' },
];
const LEGACY_ACT_RESULT_TEXT = 'По договору № {номер_договора} от {дата_договора} выполнены работы по адресу: {адрес}.\n{работы_акта}';
const LEGACY_NEUTRAL_ACT_RESULT_TEXT = 'Работы по договору № {номер_договора} от {дата_договора} по адресу: {адрес}:\n{работы_акта}';
const LEGACY_ACT_ACCEPTANCE_TEXT = '{результат_приёмки}\n{замечания_акта}\n{срок_устранения}';

const copySections = sections => sections.filter(section => section && typeof section === 'object').map(section => ({ ...section }));

function normalizeActSections(saved) {
  if (!Array.isArray(saved.actSections)) return copySections(DEFAULT_ACT_SECTIONS);
  const sections = copySections(saved.actSections);
  if (saved.actBodyEditable === true) return sections;
  const oldStandard = sections.length === 2
    && sections[0].id === 'act-result' && sections[0].title === 'Результат работ'
    && [LEGACY_ACT_RESULT_TEXT, LEGACY_NEUTRAL_ACT_RESULT_TEXT].includes(sections[0].text)
    && sections[1].id === 'act-acceptance' && sections[1].title === 'Приёмка' && sections[1].text === LEGACY_ACT_ACCEPTANCE_TEXT;
  if (oldStandard) return copySections(DEFAULT_ACT_SECTIONS);
  if (!sections.some(section => String(section.text || '').includes('{дата_завершения}'))) {
    sections.push({ id: 'act-completion', title: 'Завершение работ', text: 'Дата фактического завершения работ: {дата_завершения}.' });
  }
  for (const section of DEFAULT_ACT_SECTIONS.slice(2)) {
    if (!sections.some(savedSection => savedSection.id === section.id)) sections.push({ ...section });
  }
  return sections;
}

/** Older templates always printed one specification; keep it until explicitly removed. */
export function normalizeContractTemplate(value) {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const appendices = Array.isArray(saved.appendices) ? saved.appendices : saved.estOn === false ? [] : [
    { id: 'legacy-estimate', kind: 'estimate', exportOptions: { type: 'total', cols: { ...DEFAULT_CONTRACT_ESTIMATE_OPTIONS.cols, num: false, photo: false } } },
  ];
  const savedSections = Array.isArray(saved.sections) ? saved.sections : null;
  const isLegacyStandard = savedSections?.length === LEGACY_CONTRACT_TPL.sections.length && savedSections.every((section, index) => section?.title === LEGACY_CONTRACT_TPL.sections[index].title && section?.text === LEGACY_CONTRACT_TPL.sections[index].text);
  const settings = { ...DEFAULT_CONTRACT_SETTINGS, ...saved.settings };
  const percent = Number(String(settings.prepayPercent).trim().replace(',', '.'));
  settings.prepayPercent = Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : 50;
  const sections = copySections(savedSections && !isLegacyStandard ? savedSections : DEFAULT_CONTRACT_TPL.sections).map(section => {
    const oldStandard = section.title === 'Качество и гарантия' && section.text === LEGACY_WARRANTY_TEXT;
    const restoredStandard = (!savedSections || isLegacyStandard) && section.id === 's6';
    return oldStandard || restoredStandard ? { ...section, text: materializeWarranty(settings) } : section;
  });
  let estimateSeen = false;
  return {
    ...DEFAULT_CONTRACT_TPL, ...saved,
    style: ['magic', 'accent'].includes(saved.style) ? saved.style : 'magic',
    head: { ...DEFAULT_CONTRACT_TPL.head, ...(saved.head || {}) },
    preamble: typeof saved.preamble === 'string' ? saved.preamble.replaceAll('{представительство_заказчика}', '') : DEFAULT_CONTRACT_TPL.preamble,
    settings,
    sections,
    actSections: normalizeActSections(saved),
    actBodyEditable: true,
    appendices: appendices.filter(appendix => {
      if (!appendix || !['text', 'estimate'].includes(appendix.kind)) return false;
      if (appendix.kind === 'text') return true;
      if (estimateSeen) return false;
      estimateSeen = true;
      return true;
    }).map(appendix => appendix.kind === 'estimate' ? {
      ...appendix,
      exportOptions: {
        ...DEFAULT_CONTRACT_ESTIMATE_OPTIONS, ...appendix.exportOptions,
        cols: { ...DEFAULT_CONTRACT_ESTIMATE_OPTIONS.cols, ...appendix.exportOptions?.cols },
      },
    } : { ...appendix }),
  };
}

export function normalizeContractLegalForm(value) {
  const key = String(value || '').trim().toLowerCase();
  return ({ 'ип': 'ip', 'ооо': 'ooo', 'ао': 'ao', 'самозанятый': 'self_employed', 'самозанятая': 'self_employed' })[key] || key;
}

export function companyContractFields(head = {}) {
  const form = normalizeContractLegalForm(head.legalForm);
  return { исполнитель: head.legal || head.company || 'Исполнитель', компания: head.company, юр_лицо: head.legal, форма: ({ ip: 'ИП', ooo: 'ООО', ao: 'АО', self_employed: 'Самозанятый' })[form] || head.legalForm, инн: head.inn, кпп: head.kpp,
    огрн: head.ogrn, юр_адрес: head.address, адрес_компании: head.companyAddress || head.address, телефон_договора: head.phone, банк: head.bank, подпись_фио: head.signerName };
}

/* ── Сумма прописью (рубли) ── */
const U = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const UF = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEEN = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDR = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
function plural(n, one, two, five) {
  const m = n % 100;
  if (m >= 11 && m <= 19) return five;
  const d = m % 10;
  return d === 1 ? one : d >= 2 && d <= 4 ? two : five;
}
function tripleToWords(n, fem) {
  const w = [];
  w.push(HUNDR[Math.floor(n / 100)]);
  const m = n % 100;
  if (m >= 10 && m <= 19) w.push(TEEN[m - 10]);
  else { w.push(TENS[Math.floor(m / 10)]); w.push((fem ? UF : U)[m % 10]); }
  return w.filter(Boolean).join(" ");
}
export function rubToWords(sum) {
  const rub = Math.floor(Math.abs(sum));
  const kop = Math.round((Math.abs(sum) - rub) * 100);
  if (rub === 0 && kop === 0) return "ноль рублей 00 копеек";
  const parts = [];
  const mln = Math.floor(rub / 1e6) % 1000, ths = Math.floor(rub / 1e3) % 1000, un = rub % 1000;
  if (mln) parts.push(tripleToWords(mln, false), plural(mln, "миллион", "миллиона", "миллионов"));
  if (ths) parts.push(tripleToWords(ths, true), plural(ths, "тысяча", "тысячи", "тысяч"));
  if (un || !parts.length) parts.push(tripleToWords(un, false) || "ноль");
  parts.push(plural(un, "рубль", "рубля", "рублей"));
  parts.push(String(kop).padStart(2, "0"), plural(kop, "копейка", "копейки", "копеек"));
  const txt = parts.filter(Boolean).join(" ");
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/* ── Шаблон по умолчанию: типовой договор подряда на натяжные потолки ── */
const LEGACY_CONTRACT_TPL = {
  head: {
    logo: null,            /* dataURL картинки */
    company: "",           /* «Студия натяжных потолков …» */
    legal: "",             /* ИП Иванов И.И. */
    inn: "", ogrn: "",
    address: "", phone: "",
    bank: "",              /* реквизиты банка одной строкой или несколькими */
    sign: null,            /* dataURL подписи/печати */
    signerName: "",        /* ФИО для строки подписи */
  },
  style: "strict",         /* strict | accent | compact */
  /* Разделы: {id, title, text}. Подстановки в фигурных скобках. */
  sections: [
    { id: "s1", title: "Предмет договора", text: "Исполнитель обязуется выполнить работы по изготовлению и монтажу натяжных потолков по адресу: {адрес}, а Заказчик обязуется принять и оплатить выполненные работы. Состав, объём и стоимость работ определяются спецификацией (Приложение №1), являющейся неотъемлемой частью настоящего договора." },
    { id: "s2", title: "Стоимость работ и порядок расчётов", text: "Общая стоимость работ по договору составляет {сумма} ₽ ({сумма_прописью}). Заказчик вносит предоплату в размере {предоплата} ₽ в день подписания договора. Оставшаяся сумма {остаток} ₽ оплачивается Заказчиком в день завершения монтажных работ после подписания акта приёмки." },
    { id: "s3", title: "Сроки выполнения", text: "Срок изготовления полотна — до 7 рабочих дней с момента внесения предоплаты. Дата монтажа согласовывается с Заказчиком дополнительно. Общая площадь потолков по договору — {площадь} м²." },
    { id: "s4", title: "Обязанности сторон", text: "Исполнитель выполняет работы качественно, в соответствии с технологией монтажа, силами квалифицированных специалистов, с использованием собственных материалов и оборудования. Заказчик обеспечивает доступ в помещение в согласованное время, освобождает периметр помещений от мебели и предметов, препятствующих монтажу, и обеспечивает наличие электроэнергии 220 В." },
    { id: "s5", title: "Гарантия", text: "Гарантия на полотно и сварные швы — 10 лет при соблюдении условий эксплуатации. Гарантия на монтажные работы — 3 года. Гарантия не распространяется на повреждения, возникшие по вине Заказчика или третьих лиц, а также вследствие затопления, пожара и иных форс-мажорных обстоятельств." },
    { id: "s6", title: "Прочие условия", text: "Договор вступает в силу с момента подписания и действует до полного исполнения сторонами обязательств. Все споры решаются путём переговоров, а при недостижении согласия — в порядке, установленном законодательством РФ. Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой из сторон." },
  ],
  numSeq: 1,               /* счётчик для авто-номера */
};

export const DEFAULT_CONTRACT_TPL = {
  ...LEGACY_CONTRACT_TPL,
  style: 'magic',
  preamble: '{исполнитель}, именуемый в дальнейшем «Исполнитель», и {клиент}, именуемый в дальнейшем «Заказчик», заключили настоящий договор о следующем:',
  settings: { ...DEFAULT_CONTRACT_SETTINGS },
  sections: [
    { id: 's1', title: 'Предмет договора', text: 'Исполнитель обязуется выполнить работы по изготовлению и монтажу натяжных потолков по адресу: {адрес}, а Заказчик обязуется принять результат и оплатить работы. {ссылка_на_смету} Общая площадь помещений — {площадь} м².' },
    { id: 's2', title: 'Стоимость и порядок расчётов', text: 'Общая стоимость работ по договору составляет {сумма} ₽ ({сумма_прописью}). Согласованная предоплата — {предоплата} ₽. Остаток по условиям договора — {остаток} ₽. Сведения о фактически полученной оплате учитываются отдельно. Дополнительные работы, изменение стоимости и сроков предварительно согласуются сторонами.' },
    { id: 's3', title: 'Сроки выполнения', text: 'Начало выполнения работ — {дата_начала}. Завершение работ — {срок_монтажа}. Изменение согласованных сроков оформляется сторонами с указанием причины и новых дат.' },
    { id: 's4', title: 'Подготовка объекта и выполнение работ', text: 'Исполнитель выполняет согласованный состав работ с соблюдением технологии монтажа и требований безопасности. Заказчик обеспечивает согласованный доступ к объекту, освобождает рабочую зону и сообщает известные сведения о скрытых коммуникациях и особенностях помещений. Выявленные ограничения и дополнительные работы согласуются до их выполнения.' },
    { id: 's5', title: 'Приёмка результата', text: 'По завершении работ стороны осматривают результат и оформляют акт выполненных работ. В акте указываются фактически выполненные работы, замечания при их наличии и согласованный срок устранения. Приёмка не ограничивает предусмотренные законом права в отношении скрытых недостатков.' },
    { id: 's6', title: 'Качество и гарантия', text: DEFAULT_WARRANTY_TEXT },
    { id: 's7', title: 'Изменения и разрешение споров', text: 'Изменения состава работ, цены и сроков фиксируются в согласованной сторонами редакции заказа или дополнительном соглашении. Стороны разрешают споры в порядке, предусмотренном законодательством РФ. Права Заказчика, установленные законом, сохраняются.' },
  ],
  actSections: copySections(DEFAULT_ACT_SECTIONS),
  actBodyEditable: true,
};

/* ── Номер договора: ДД-ММ/ГГГГ-N ── */
export function nextContractNumber(tpl, date = new Date()) {
  const d = date instanceof Date ? date : new Date(String(date).slice(0, 10) + 'T12:00:00');
  const p = n => String(n).padStart(2, "0");
  return p(d.getDate()) + "-" + p(d.getMonth() + 1) + "/" + d.getFullYear() + "-" + (tpl?.numSeq || 1);
}

/* ── Подстановки ──
   fields: {номер, дата, клиент, телефон, адрес, сумма, предоплата, остаток, площадь, срок_монтажа} */
export function fillText(text, fields) {
  const fmtN = v => (typeof v === "number" ? v.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : v);
  return String(text || "").replace(/\{([а-яА-ЯёЁa-zA-Z_]+)\}/g, (m, key) => {
    if (key === "сумма_прописью") return rubToWords(Number(fields["сумма"]) || 0);
    const v = fields[key];
    return v === undefined || v === null || v === "" ? "____________" : String(fmtN(v));
  });
}

/* Поля проекта для подстановок. est = {mats, works} из buildEst. */
export function contractFields(ord, total, extra) {
  const prepay = extra?.prepay ?? Math.round(total / 2);
  return {
    номер: extra?.number || "",
    дата: extra?.date || new Date().toLocaleDateString("ru-RU"),
    клиент: ord.client || "",
    телефон: ord.phone || "",
    адрес: ord.address || "",
    сумма: Math.round(total * 100) / 100,
    предоплата: prepay,
    остаток: Math.round((total - prepay) * 100) / 100,
    площадь: extra?.area ?? "",
    срок_монтажа: extra?.installDate || "",
    дата_начала: extra?.startDate || "",
    тип_заказчика: extra?.customerType || ord.customerType || 'universal',
    ...extra?.custom,
  };
}

/* ── Стили оформления ── */
export const CONTRACT_STYLES = [
  { id: 'magic', label: 'Фирменный', description: 'Синяя шапка и классический текст', layout: 'brandbar', accent: '#1A3A5C', background: '#1A3A5C', ink: '#FFFFFF', font: "'Liberation Serif','Times New Roman',Georgia,serif" },
  { id: 'accent', label: 'Современный', description: 'Светлая шапка, синие акценты и выразительные заголовки', layout: 'split', accent: '#1461EE', background: '#EFF5FF', ink: '#16335A', font: "'Manrope',Arial,sans-serif" },
];

const CONTRACT_PRINT_STYLES = {
  magic: { size: 12, lineHeight: 1.4, padding: 20, border: '#1A3A5C', header: 'display:flex;align-items:center;gap:12px;border-radius:7px;padding:12px 16px;margin-bottom:12px;', logoSize: 40, brandSize: 18.5, detailsColor: '#E1E8F0', title: 'font-size:16px;text-align:center;font-weight:700;', titleGap: 10, heading: 'font-size:12px;margin:9px 0 3px;font-weight:700;', paragraphGap: 5, tableBackground: '#1A3A5C', tableInk: '#FFFFFF', tableHeadPadding: '4px 6px', tableCellPadding: '3px 6px', tableBorder: '0.5px solid #CCD3DD', requisitesGap: 20, footerAlign: 'center' },
  accent: { size: 12, lineHeight: 1.4, padding: 20, border: '#D9E6FB', header: 'display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);align-items:center;gap:16px;border-left:4px solid #1461EE;padding:12px 14px;margin-bottom:12px;', logoSize: 38, brandSize: 18.5, detailsColor: '#55708F', title: 'font-size:17px;text-align:left;font-weight:750;', titleGap: 10, heading: 'font-size:12px;margin:9px 0 3px;padding:2px 7px;border-left:3px solid #1461EE;background:#F4F8FF;font-weight:750;', paragraphGap: 5, tableBackground: '#E7EFFD', tableInk: '#164B9D', tableHeadPadding: '5px 7px', tableCellPadding: '3px 7px', tableBorder: '0.5px solid #D9E4F3', requisitesGap: 20, footerAlign: 'left' },
};

const escapeDocument = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeDocumentImage = value => typeof value === 'string' && (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value) || /^\/(?!\/)[^"<>]*$/.test(value)) ? escapeDocument(value) : '';
const documentAmount = value => Number(typeof value === 'string' ? value.replace(/\s/g, '').replace(',', '.') : value) || 0;
const moneyDocument = value => documentAmount(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const dateDocument = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value).split('-').reverse().join('.') : String(value || '');

function documentFrame(tpl, fields, title, content, kind = 'contract', { requisites = true } = {}) {
  const h = tpl.head || {}, st = CONTRACT_STYLES.find(style => style.id === tpl.style) || CONTRACT_STYLES[0];
  const esc = escapeDocument, appearance = CONTRACT_PRINT_STYLES[st.id];
  const scope = `.z-contract-document[data-contract-style="${st.id}"]`;
  const form = normalizeContractLegalForm(h.legalForm);
  const ogrnLabel = form === 'ip' ? 'ОГРНИП' : 'ОГРН';
  const companyLines = [h.legal, h.inn && 'ИНН ' + h.inn, h.kpp && 'КПП ' + h.kpp, h.ogrn && ogrnLabel + ' ' + h.ogrn].filter(Boolean);
  const customerLines = [fields.клиент, fields.инн_заказчика && 'ИНН ' + fields.инн_заказчика, fields.кпп_заказчика && 'КПП ' + fields.кпп_заказчика, fields.юр_адрес_заказчика, fields.представитель && 'Представитель: ' + fields.представитель, fields.основание && 'Основание полномочий: ' + fields.основание, fields.телефон].filter(Boolean);
  const logo = safeDocumentImage(h.logo) ? `<img class="contract-brand-logo" alt="" src="${safeDocumentImage(h.logo)}"/>` : '';
  const brandName = `<div class="contract-brand-name" style="min-width:0">${esc(h.company) || 'Студия натяжных потолков'}</div>`;
  const detailSegments = [{ text: h.description, kind: 'description' }, { text: h.companyAddress || h.address, kind: 'address' }, { text: h.phone, kind: 'phone' }].filter(segment => segment.text);
  const details = `<div class="contract-brand-details">${detailSegments.map((segment, index) => `<span class="contract-brand-detail contract-brand-${segment.kind}"${segment.kind === 'phone' ? ' style="white-space:nowrap"' : ''}>${esc(segment.text)}${index < detailSegments.length - 1 ? ' ·' : ''}</span>`).join(' ')}</div>`;
  const brand = st.layout === 'brandbar' ? `${logo}<div class="contract-brand-stack">${brandName}${details}</div>`
    : `<div class="contract-brand-identity">${logo}${brandName}</div>${details}`;
  return `<article class="z-contract-document" data-document-kind="${kind}" data-contract-style="${st.id}" data-contract-layout="${st.layout}" data-pdf-content-end style="--contract-table-head-padding:${appearance.tableHeadPadding};--contract-table-cell-padding:${appearance.tableCellPadding};--contract-table-border:${appearance.tableBorder};font-family:${st.font};color:#1c1c1c;font-size:${appearance.size}px;line-height:${appearance.lineHeight};max-width:720px;margin:0 auto;border:1px solid ${appearance.border};padding:${appearance.padding}px;box-sizing:border-box;background:#fff;">
    <style>${scope} h3{color:${st.accent};${appearance.heading}}${scope} p{margin:0 0 ${appearance.paragraphGap}px;white-space:pre-line}${scope} .contract-brand-stack{flex:1;min-width:0}${scope} .contract-brand-identity{display:flex;align-items:center;gap:10px;min-width:0}${scope} .contract-brand-name{font-size:${appearance.brandSize}px;font-weight:700;line-height:1.2;overflow-wrap:break-word}${scope} .contract-brand-logo{width:${appearance.logoSize}px;height:${appearance.logoSize}px;object-fit:contain;flex-shrink:0}${scope} .contract-brand-details{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:10px;line-height:1.35;color:${appearance.detailsColor};min-width:0}${scope} .contract-brand-detail{max-width:100%;overflow-wrap:break-word}${scope} .contract-brand-phone{flex-shrink:0}${scope} .contract-brand-stack .contract-brand-details{margin-top:4px}${scope} .contract-brand-split>.contract-brand-details{flex-direction:column;align-items:flex-end;text-align:right}${scope} .contract-estimate-appendix .estimate-document{width:100%;padding:12px 0;font-family:inherit}${scope} .contract-estimate-appendix .estimate-header{display:none}${scope} th,${scope} .contract-estimate-appendix .estimate-document th{background:${appearance.tableBackground};color:${appearance.tableInk};padding:var(--contract-table-head-padding)}${scope} .contract-estimate-appendix .estimate-document td{padding:var(--contract-table-cell-padding)}${scope} .contract-requisites{display:grid;grid-template-columns:1fr 1fr;gap:${appearance.requisitesGap}px;font-size:10px;line-height:1.35;margin-top:12px}${scope} .contract-doc-footer{border-top:1px solid ${appearance.border};margin-top:12px;padding-top:6px;text-align:${appearance.footerAlign};color:#6f7688;font-size:9px}</style>
    <header class="contract-brand contract-brand-${st.layout} no-split" style="background:${st.background};color:${st.ink};${appearance.header}">${brand}</header>
    <div class="no-split" data-pdf-keep-with-next style="margin-bottom:${appearance.titleGap}px"><h2 style="${appearance.title}line-height:1.35;color:${st.accent};margin:0 0 8px">${esc(title)}</h2><div style="display:flex;justify-content:space-between;font-size:10px"><span>${h.city ? 'г. ' + esc(h.city) : 'Город: ____________'}</span><span>${esc(dateDocument(fields.дата))}</span></div></div>
    ${content}
    ${requisites ? `<section class="contract-requisites no-split" data-pdf-keep-with-previous><div><b>Исполнитель</b><br/>${[...companyLines, h.address, h.phone, h.bank].filter(Boolean).map(esc).join('<br/>') || 'Реквизиты заполняются в настройках компании'}</div><div><b>Заказчик</b><br/>${customerLines.map(esc).join('<br/>') || 'Данные заказчика не заполнены'}</div></section>` : ''}
    <footer class="contract-doc-footer" data-pdf-keep-with-previous>${esc(title)} · ${esc(dateDocument(fields.дата))}</footer>
  </article>`;
}

/* ── HTML договора для предпросмотра и печати ──
   est: {mats:[{n,q,u,p}], works:[...]} — спецификация. */
export function contractHtml(tpl, fields, est, estimateAdjustment, estimateExportOptions, documentContext = {}) {
  tpl = normalizeContractTemplate(tpl);
  fields = { ...companyContractFields(tpl.head), ...fields };
  const estimateAppendix = tpl.appendices.find(appendix => appendix.kind === 'estimate');
  fields = {
    ссылка_на_смету: estimateAppendix ? 'Состав, объём и стоимость работ определяет Смета (Приложение №1), являющаяся частью договора.' : 'Состав, объём и стоимость работ определяются согласованным сторонами заказом по объекту.',
    гарантия_монтажа: Number(tpl.settings.warrantyWorksMonths) > 0 ? `Дополнительная гарантия на монтажные работы — ${Number(tpl.settings.warrantyWorksMonths)} мес. с даты завершения работ.` : 'Дополнительный гарантийный срок на монтажные работы не установлен. Законные права Заказчика в отношении недостатков сохраняются.',
    гарантия_материалов: tpl.settings.warrantyMaterials || 'По условиям изготовителя при установлении им гарантии',
    ...fields,
    исполнитель: tpl.head.legal || tpl.head.company || 'Исполнитель',
    представительство_заказчика: fields.представитель ? `, в лице ${fields.представитель}${fields.основание ? ', действующего на основании ' + fields.основание : ''}` : '',
    дата: dateDocument(fields.дата), дата_начала: dateDocument(fields.дата_начала), срок_монтажа: dateDocument(fields.срок_монтажа),
  };
  const h = tpl.head || {};
  const esc = s => String(s ?? "").replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const image = value => typeof value === 'string' && (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value) || /^\/(?!\/)[^"<>]*$/.test(value)) ? esc(value) : '';
  const money = v => (Number(v) || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  const groupedVisibility = estimateExportOptions?.showAdjustmentByScope != null;
  const showAdjustment = groupedVisibility ? estimateAdjustmentVisibility(estimateExportOptions) : estimateExportOptions?.showAdjustment !== false;
  const prepared = prepareEstimateExport(est, estimateAdjustment, showAdjustment);
  const specRows = [...prepared.mats, ...prepared.works, ...(prepared.equipment || [])];
  const totals = prepared.totals;
  const visibleAdjustments = groupedVisibility ? Object.values(prepared.categoryAdjustments).filter(entry => entry.shown)
    : showAdjustment ? totals.adjustments : [];
  const visibleBase = groupedVisibility ? prepared.materialsTotal + prepared.worksTotal + prepared.equipmentTotal : totals.baseTotal;
  const summary = columnCount => {
    const row = (label, amount, bold = false) => {
      const style = `border:var(--contract-table-border,0.5px solid #ccc);padding:var(--contract-table-head-padding,4px 6px);text-align:right;${bold ? 'font-weight:700;' : ''}`;
      return columnCount === 1 ? `<tr data-pdf-summary><td style="${style}">${esc(label)}: <span style="white-space:nowrap">${amount} ₽</span></td></tr>`
        : `<tr data-pdf-summary><td colspan="${columnCount - 1}" style="${style}">${esc(label)}:</td><td style="${style}white-space:nowrap;">${amount} ₽</td></tr>`;
    };
    return visibleAdjustments.length
      ? row(visibleAdjustments.length > 1 ? 'Без корректировки' : visibleAdjustments[0].percent > 0 ? 'Без наценки' : 'Без скидки', money(visibleBase))
        + visibleAdjustments.map(entry => row(adjustmentLabel(entry), `${entry.amount < 0 ? '−' : '+'}${money(Math.abs(entry.amount))}`)).join('')
        + row('Итого к оплате', money(totals.adjustedTotal), true)
      : row('Итого', money(totals.adjustedTotal), true);
  };
  const spec = options => {
    const columns = CONTRACT_ESTIMATE_COLUMNS.filter(([key]) => options?.cols?.[key] !== false);
    if (!columns.length) columns.push(['name', 'Название']);
    const cell = (line, key, row) => ({ num: row + 1, photo: image(line.photo || line.img) ? `<img alt="" src="${image(line.photo || line.img)}" style="width:30px;height:30px;object-fit:contain"/>` : '', name: esc(line.n), qty: line.exportQuantity, unit: esc(line.u), price: line.exportPrice, total: money(line.exportTotal) })[key];
    const tableSummary = summary(columns.length);
    return specRows.length ? `<table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead><tr style="background:#f2f3fa;">
        ${columns.map(([, label]) => `<th style="border:var(--contract-table-border,0.5px solid #ccc);padding:var(--contract-table-head-padding,4px 6px);text-align:left;">${label}</th>`).join('')}
      </tr></thead><tbody>
      ${specRows.map((line, row) => `<tr>${columns.map(([key]) => `<td style="border:var(--contract-table-border,0.5px solid #ccc);padding:var(--contract-table-cell-padding,3px 6px);${['qty', 'unit', 'price', 'total'].includes(key) ? 'white-space:nowrap;' : key === 'name' ? 'overflow-wrap:break-word;' : ''}">${cell(line, key, row)}</td>`).join('')}</tr>`).join('')}
      ${tableSummary}
    </tbody></table>` : '<p>Смета проекта будет подставлена при формировании договора.</p>';
  };
  const onNewPage = (kind, number, html) => `<section data-contract-appendix="${kind}" data-appendix-number="${number}" data-pdf-break-before>${html}</section>`;
  const reference = `<p>К договору № ${esc(fields.номер) || '____'} от ${esc(fields.дата) || '____________'}.</p>`;
  let estimateHtmlPart = '';
  if (estimateAppendix) {
    const options = estimateAppendix.exportOptions;
    const estimateBody = options.type === 'total' ? spec(options) : estimateHtml({ project: documentContext.project || {}, company: { ...h, logo: null, sign: null, signature: null }, template: estimatePresetTemplate(tpl.style === 'accent' ? 'modern' : 'brand', h.estimateTemplate), est, adjustment: estimateAdjustment, showAdjustment, type: options.type === 'totalDraw' ? 'draw' : 'rooms', cols: options.cols, rooms: documentContext.rooms || [] });
    estimateHtmlPart = onNewPage('estimate', 1, documentFrame(tpl, fields, 'Приложение №1 — Смета', reference + `<div class="contract-estimate-appendix">${estimateBody}</div>`, 'estimate', { requisites: false }));
  }
  const customHtmlParts = tpl.appendices.filter(appendix => appendix.kind === 'text').map((appendix, index) => onNewPage('text', index + 3, documentFrame(tpl, fields, `Приложение №${index + 3} — ${fillText(appendix.title, fields)}`, reference + `<p>${esc(fillText(appendix.text, fields))}</p>`, 'text', { requisites: false }))).join('');
  const preamble = fillText(String(tpl.preamble ?? '').replace(/\{представительство_заказчика\}/g, () => fields.представительство_заказчика), fields);
  const body = (preamble ? `<p data-contract-preamble>${esc(preamble)}</p>` : '')
    + tpl.sections.map((section, index) => `<h3 class="no-split" data-pdf-keep-with-next>${index + 1}. ${esc(fillText(section.title, fields))}</h3><p>${esc(fillText(section.text, fields))}</p>`).join('');
  return `<div class="z-contract-packet" style="max-width:720px;margin:0 auto;background:#fff"><style>.z-contract-packet [data-pdf-break-before]{break-before:page;page-break-before:always}</style>${documentFrame(tpl, fields, 'ДОГОВОР ПОДРЯДА № ' + (fields.номер || '____'), body)}${estimateHtmlPart}${customHtmlParts}<div data-contract-packet-end data-pdf-content-end></div></div>`;
}

/** A separate acceptance document; it does not infer a signature or receipt. */
export function acceptanceHtml(tpl, fields, act = {}) {
  tpl = normalizeContractTemplate(tpl);
  const esc = escapeDocument;
  const title = 'Приложение №2 — Акт выполненных работ';
  const reference = `<p>К договору № ${esc(fields.номер) || '____'} от ${esc(dateDocument(fields.дата)) || '____________'}.</p>`;
  const blank = act.blank === true;
  const emptyLine = '________________________________________________';
  const hasPayment = !blank && act.paid !== '' && act.paid != null;
  const total = act.total ?? fields.сумма;
  const acceptance = ({ none: 'Работы приняты без заявленных при осмотре замечаний.', remarks: 'Работы приняты с замечаниями, перечисленными ниже.', partial: 'Оформлена частичная приёмка указанного ниже объёма работ.' })[act.acceptance] || 'Результат приёмки не указан.';
  const actFields = {
    ...companyContractFields(tpl.head), ...fields,
    номер_договора: fields.номер || '', дата_договора: dateDocument(fields.дата),
    дата: blank ? '____________' : dateDocument(act.date || fields.дата), номер: blank ? '____________' : act.number || '',
    дата_завершения: blank ? '____________' : dateDocument(act.completionDate),
    работы_акта: blank ? emptyLine : act.scope || 'Фактически выполненный объём работ не указан.',
    результат_приёмки: blank ? emptyLine : acceptance,
    замечания_акта: blank ? emptyLine : act.acceptance === 'none' ? '' : act.remarks || '',
    срок_устранения: blank ? '____________' : act.acceptance !== 'none' && act.remedyDate ? 'Срок устранения замечаний — ' + dateDocument(act.remedyDate) + '.' : '',
    сумма_акта: blank ? '____________' : moneyDocument(total),
    оплата_акта: hasPayment ? moneyDocument(act.paid) + ' ₽' : 'не указана',
    остаток_акта: hasPayment ? moneyDocument(documentAmount(total) - documentAmount(act.paid)) + ' ₽' : 'не рассчитан',
  };
  const actText = value => fillText(String(value || '').replace(/\{(замечания_акта|срок_устранения)\}/g, (_, key) => actFields[key]), actFields);
  const body = reference + (blank ? '<p>Номер акта: ____________ · Дата акта: ____________</p>' : `<p>Акт № ${esc(act.number) || '____'}.</p>`)
    + tpl.actSections.map((section, index) => `<h3 class="no-split" data-pdf-keep-with-next>${index + 1}. ${esc(actText(section.title))}</h3><p>${esc(actText(section.text))}</p>`).join('');
  return documentFrame(tpl, blank ? { ...actFields, дата: '' } : actFields, title, body, blank ? 'acceptance-blank' : 'acceptance');
}
