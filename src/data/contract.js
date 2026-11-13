import { adjustmentLabel } from "../utils/estimate-adjustment.js";
import { prepareEstimateExport } from "../utils/estimate-export.js";
import { estimateHtml } from "../utils/estimate-html.js";
import { estimateAdjustmentVisibility } from "../utils/estimate-export-options.js";

/* ═══ Договор: шаблон, подстановки, генерация ═══
   Шаблон один на студию (хранится в настройках приложения, попадает в бэкап).
   Сгенерированный договор сохраняется снапшотом в проект — правки шаблона
   старые договоры не меняют (тот же принцип, что со сметами). */

/* Живой шаблон для автосейва (App держит его в состоянии и синхронизирует сюда) */
export const CONTRACT_TPL_REF = { current: null };

export const CONTRACT_ESTIMATE_TYPES = [
  { id: 'total', label: 'Общая смета', sub: 'Материалы, оборудование и работы' },
  { id: 'totalDraw', label: 'Общая + чертежи', sub: 'Плюс план каждого помещения' },
  { id: 'perRoom', label: 'По помещениям', sub: 'Отдельная таблица на каждое' },
];
export const CONTRACT_ESTIMATE_COLUMNS = [['num', '#'], ['photo', 'Фото'], ['name', 'Название'], ['qty', 'Кол-во'], ['unit', 'Ед.'], ['price', 'Цена'], ['total', 'Итого']];
export const DEFAULT_CONTRACT_ESTIMATE_OPTIONS = { type: 'total', cols: Object.fromEntries(CONTRACT_ESTIMATE_COLUMNS.map(([key]) => [key, true])) };

/** Older templates always printed one specification; keep it until explicitly removed. */
export function normalizeContractTemplate(value) {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const appendices = Array.isArray(saved.appendices) ? saved.appendices : saved.estOn === false ? [] : [
    { id: 'legacy-estimate', kind: 'estimate', exportOptions: { type: 'total', cols: { ...DEFAULT_CONTRACT_ESTIMATE_OPTIONS.cols, num: false, photo: false } } },
  ];
  let estimateSeen = false;
  return {
    ...DEFAULT_CONTRACT_TPL, ...saved,
    head: { ...DEFAULT_CONTRACT_TPL.head, ...(saved.head || {}) },
    sections: (Array.isArray(saved.sections) ? saved.sections : DEFAULT_CONTRACT_TPL.sections).map(section => ({ ...section })),
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
  return { компания: head.company, юр_лицо: head.legal, форма: ({ ip: 'ИП', ooo: 'ООО', ao: 'АО', self_employed: 'Самозанятый' })[form] || head.legalForm, инн: head.inn, кпп: head.kpp,
    огрн: head.ogrn, юр_адрес: head.address, телефон_договора: head.phone, банк: head.bank, подпись_фио: head.signerName };
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
export const DEFAULT_CONTRACT_TPL = {
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

/* ── Номер договора: ДД-ММ/ГГГГ-N ── */
export function nextContractNumber(tpl) {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return p(d.getDate()) + "-" + p(d.getMonth() + 1) + "/" + d.getFullYear() + "-" + (tpl?.numSeq || 1);
}

/* ── Подстановки ──
   fields: {номер, дата, клиент, телефон, адрес, сумма, предоплата, остаток, площадь, срок_монтажа} */
export function fillText(text, fields) {
  const fmtN = v => (typeof v === "number" ? v.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : v);
  return String(text || "").replace(/\{([а-яА-Яa-zA-Z_]+)\}/g, (m, key) => {
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
    дата: new Date().toLocaleDateString("ru-RU"),
    клиент: ord.client || "",
    телефон: ord.phone || "",
    адрес: ord.address || "",
    сумма: Math.round(total * 100) / 100,
    предоплата: prepay,
    остаток: Math.round((total - prepay) * 100) / 100,
    площадь: extra?.area ?? "",
    срок_монтажа: extra?.installDate || "",
    ...extra?.custom,
  };
}

/* ── Стили оформления ── */
export const CONTRACT_STYLES = [
  { id: "strict", label: "Строгий", accent: "#1e2530", font: "'Times New Roman', Georgia, serif" },
  { id: "accent", label: "ЗАМЕРX", accent: "#1461EE", font: "'Manrope', -apple-system, sans-serif" },
  { id: "compact", label: "Компактный", accent: "#1e2530", font: "'Inter', -apple-system, sans-serif" },
];

/* ── HTML договора для предпросмотра и печати ──
   est: {mats:[{n,q,u,p}], works:[...]} — спецификация. */
export function contractHtml(tpl, fields, est, estimateAdjustment, estimateExportOptions, documentContext = {}) {
  tpl = normalizeContractTemplate(tpl);
  fields = { ...companyContractFields(tpl.head), ...fields };
  const st = CONTRACT_STYLES.find(s => s.id === tpl.style) || CONTRACT_STYLES[0];
  const compact = tpl.style === "compact";
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
      const style = `border:0.5px solid #ccc;padding:4px 6px;text-align:right;${bold ? 'font-weight:700;' : ''}`;
      return columnCount === 1 ? `<tr><td style="${style}">${esc(label)}: ${amount} ₽</td></tr>`
        : `<tr><td colspan="${columnCount - 1}" style="${style}">${esc(label)}:</td><td style="${style}">${amount} ₽</td></tr>`;
    };
    return visibleAdjustments.length
      ? row(visibleAdjustments.length > 1 ? 'Без корректировки' : visibleAdjustments[0].percent > 0 ? 'Без наценки' : 'Без скидки', money(visibleBase))
        + visibleAdjustments.map(entry => row(adjustmentLabel(entry), `${entry.amount < 0 ? '−' : '+'}${money(Math.abs(entry.amount))}`)).join('')
        + row('Итого к оплате', money(totals.adjustedTotal), true)
      : row('Итого', money(totals.adjustedTotal), true);
  };
  const spec = (options, index) => {
    const columns = CONTRACT_ESTIMATE_COLUMNS.filter(([key]) => options?.cols?.[key] !== false);
    if (!columns.length) columns.push(['name', 'Название']);
    const cell = (line, key, row) => ({ num: row + 1, photo: image(line.photo || line.img) ? `<img alt="" src="${image(line.photo || line.img)}" style="width:30px;height:30px;object-fit:contain"/>` : '', name: esc(line.n), qty: line.exportQuantity, unit: esc(line.u), price: line.exportPrice, total: money(line.exportTotal) })[key];
    const tableSummary = summary(columns.length);
    return specRows.length ? `
    <h3 class="no-split" style="margin:18px 0 6px;font-size:${compact ? 11 : 12}px;">Приложение №${index + 1} — Спецификация</h3>
    <table style="width:100%;border-collapse:collapse;font-size:${compact ? 9 : 10}px;">
      <tr style="background:#f2f3fa;">
        ${columns.map(([, label]) => `<th style="border:0.5px solid #ccc;padding:4px 6px;text-align:left;">${label}</th>`).join('')}
      </tr>
      ${specRows.map((line, row) => `<tr>${columns.map(([key]) => `<td style="border:0.5px solid #ccc;padding:3px 6px;">${cell(line, key, row)}</td>`).join('')}</tr>`).join('')}
      ${tableSummary}
    </table>` : `<h3>Приложение №${index + 1} — Смета</h3><p>Смета проекта будет подставлена при формировании договора.</p>`;
  };
  const appendices = tpl.appendices.map((appendix, index) => {
    if (appendix.kind === 'text') return `<section style="margin-top:18px"><h3 class="no-split" style="font-size:${compact ? 11 : 12}px;color:${st.accent}">Приложение №${index + 1} — ${esc(fillText(appendix.title, fields))}</h3><p style="white-space:pre-line">${esc(fillText(appendix.text, fields))}</p></section>`;
    if (appendix.exportOptions.type === 'total') return spec(appendix.exportOptions, index);
    const type = appendix.exportOptions.type === 'totalDraw' ? 'draw' : 'rooms';
    return `<section class="contract-estimate-appendix"><h3 class="no-split">Приложение №${index + 1} — Смета</h3>${estimateHtml({ project: documentContext.project || {}, company: h, est, adjustment: estimateAdjustment, showAdjustment, type, cols: appendix.exportOptions.cols, rooms: documentContext.rooms || [] })}</section>`;
  }).join('');
  return `
  <div style="font-family:${st.font};color:#1a1a1a;font-size:${compact ? 10.5 : 12}px;line-height:1.55;max-width:720px;margin:0 auto;">
    <div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid ${st.accent};padding-bottom:10px;margin-bottom:14px;">
      ${image(h.logo) ? `<img src="${image(h.logo)}" style="height:${compact ? 40 : 52}px;"/>` : ""}
      <div style="flex:1;">
        <div style="font-size:${compact ? 13 : 15}px;font-weight:700;color:${st.accent};">${esc(h.company) || "Студия натяжных потолков"}</div>
        <div style="font-size:${compact ? 8.5 : 9.5}px;color:#555;">
          ${[h.legal, h.inn && "ИНН " + h.inn, h.ogrn && "ОГРНИП " + h.ogrn].filter(Boolean).map(esc).join(" · ")}<br/>
          ${[h.address, h.phone].filter(Boolean).map(esc).join(" · ")}
        </div>
      </div>
    </div>
    <div style="text-align:center;margin:10px 0 4px;font-size:${compact ? 12 : 14}px;font-weight:700;">
      ДОГОВОР ПОДРЯДА № ${esc(fields["номер"]) || "____"}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:${compact ? 9 : 10}px;color:#555;margin-bottom:12px;">
      <span>г. ${esc(h.city) || '________________'}</span><span>${esc(fields["дата"])}</span>
    </div>
    <p style="margin:0 0 10px;">${esc(h.legal || h.company || "Исполнитель")}, именуемый в дальнейшем «Исполнитель», с одной стороны, и <b>${esc(fields["клиент"]) || "____________"}</b>${fields["телефон"] ? ", тел. " + esc(fields["телефон"]) : ""}, именуемый(ая) в дальнейшем «Заказчик», с другой стороны, заключили настоящий договор о нижеследующем:</p>
    ${(tpl.sections || []).map((sec, i) => `
      <h3 class="no-split" style="margin:12px 0 4px;font-size:${compact ? 11 : 12}px;color:${st.accent};">${i + 1}. ${esc(fillText(sec.title, fields))}</h3>
      <p style="margin:0;white-space:pre-line">${esc(fillText(sec.text, fields))}</p>`).join("")}
    ${h.bank ? `<h3 class="no-split" style="margin:14px 0 4px;font-size:${compact ? 11 : 12}px;color:${st.accent};">Реквизиты Исполнителя</h3><p style="margin:0;white-space:pre-line;font-size:${compact ? 9 : 10}px;">${esc(h.bank)}</p>` : ""}
    <div style="display:flex;gap:24px;margin-top:26px;">
      <div style="flex:1;">
        <div style="font-weight:700;margin-bottom:22px;">Исполнитель</div>
        <div style="border-top:0.5px solid #999;padding-top:3px;font-size:9px;color:#777;position:relative;">
          ${image(h.sign) ? `<img src="${image(h.sign)}" style="position:absolute;bottom:6px;left:20px;height:56px;"/>` : ""}
          ${esc(h.signerName) || "подпись"}
        </div>
      </div>
      <div style="flex:1;">
        <div style="font-weight:700;margin-bottom:22px;">Заказчик</div>
        <div style="border-top:0.5px solid #999;padding-top:3px;font-size:9px;color:#777;">${esc(fields["клиент"]) || "подпись"}</div>
      </div>
    </div>
    <style>.contract-estimate-appendix .estimate-document{width:100%;padding:12px 0}.contract-estimate-appendix .estimate-header{display:none}</style>${appendices}
  </div>`;
}
