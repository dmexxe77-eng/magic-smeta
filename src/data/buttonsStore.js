/* ═══════════════════════════════════════════════════════════════
   Редактор кнопок — модель данных v1 (docs/ZAMER_button_editor_SPEC.md, раздел 1)

   Block      { id, label, custom?, order }
   Preset     { id, blockId, name, param:{src:'area'|'perim'|'manual', unit?}, items, hidden?, order }
   PresetItem { nomId, src:'param'|'area'|'perim'|'corn_all'|'corn_in'|'corn_out'|'manual', order }

   Легаси-формат (PRESETS_GEN / CALC_STATE_REF.presets):
   { id, name, cat, items:[nomId], options:[nomId], pid?, sec? }
   items  → src:'param' (кол-во = главный параметр блока)
   options→ по id: o_inner_angle→corn_in, o_outer_angle→corn_out, o_angle→corn_all,
            прочие→manual (сегодня их кол-во — ручной ввод в oq, по умолчанию 0)
   Видимость: sharedFavs[cat] (избранные чипы) → hidden = !favs.includes(id)

   Миграция обратима: toLegacyPresets(migrateLegacy(x)) === x (round-trip),
   поэтому buildEst даёт тот же итог до копейки — проверяется window.__zamerParity().
   ═══════════════════════════════════════════════════════════════ */
import { BLOCK_CFG, PRESETS_GEN, CALC_STATE_REF, INITIAL_ORDERS, buildEst } from "./presets.js";

export const CONFIG_VERSION = 1;

/* Раздел 1.4 ТЗ: значки и цвета источников количества */
export const SRC_META = {
  param:    { icon: "×", color: "#4F46E5", label: "Параметр кнопки" },
  area:     { icon: "S", color: "#4F46E5", label: "Площадь чертежа",  short: "м² черт." },
  perim:    { icon: "P", color: "#0a84ff", label: "Периметр чертежа", short: "м.п. черт." },
  corn_all: { icon: "∠", color: "#ff9500", label: "Все углы чертежа", short: "все углы" },
  corn_in:  { icon: "∠", color: "#16a34a", label: "Внутренние углы",  short: "внутр" },
  corn_out: { icon: "∠", color: "#ff3b30", label: "Внешние углы",     short: "внеш" },
  manual:   { icon: "#", color: "#8e8e93", label: "Ручной ввод",      short: "вручную" },
};

/* Главный параметр кнопки по встроенному блоку (сегодня неявно задан категорией) */
const BLOCK_PARAM = {
  canvas:  { src: "area" },
  main:    { src: "perim" },
  extra:   { src: "manual", unit: "м.п." },
  light:   { src: "manual", unit: "шт" },
  track:   { src: "manual", unit: "м.п." },
  curtain: { src: "manual", unit: "м.п." },
};

/* Легаси-опции с автоподстановкой углов чертежа */
const OPTION_SRC = {
  o_inner_angle: "corn_in",
  o_outer_angle: "corn_out",
  o_angle: "corn_all",
};
/* Источник количества легаси-опции (для единого списка в калькуляторе) */
export const legacyOptionSrc = nomId => OPTION_SRC[nomId] || "manual";

export function builtinBlocks() {
  return BLOCK_CFG.map((b, i) => ({ id: b.id, label: b.title, order: i }));
}

/* Раздел 2.3 ТЗ: умный дефолт источника при добавлении номенклатуры в редакторе */
export function smartSrcFor(nomName) {
  const s = String(nomName || "").toLowerCase();
  if (s.includes("внутрен")) return "corn_in";
  if (s.includes("внешн")) return "corn_out";
  if (s.includes("угл")) return "corn_all";
  return "param";
}

/* ── Миграция легаси → v1. Без потерь: pid/sec сохраняются в _legacy ── */
export function migrateLegacy(legacyPresets, sharedFavs, customBlocks) {
  const favs = sharedFavs || {};
  const orderInBlock = {};
  const presets = (legacyPresets || []).map(p => {
    const blockId = p.cat || "other";
    const ord = (orderInBlock[blockId] = (orderInBlock[blockId] ?? -1) + 1);
    const items = [
      ...(p.items || []).map((nomId, i) => ({ nomId, src: "param", order: i })),
      ...(p.options || []).map((nomId, i) => ({
        nomId,
        src: OPTION_SRC[nomId] || "manual",
        order: (p.items || []).length + i,
      })),
    ];
    const catFavs = favs[blockId];
    const preset = {
      id: p.id,
      blockId,
      name: p.name,
      /* param, отредактированный в редакторе, живёт на легаси-объекте как доп. поле (buildEst его игнорирует) */
      param: p.param && p.param.src ? { ...p.param } : { ...(BLOCK_PARAM[blockId] || { src: "manual", unit: "шт" }) },
      items,
      order: ord,
    };
    if (Array.isArray(catFavs) && !catFavs.includes(p.id)) preset.hidden = true;
    const extra = {};
    if (p.pid !== undefined) extra.pid = p.pid;
    if (p.sec !== undefined) extra.sec = p.sec;
    if (Object.keys(extra).length) preset._legacy = extra;
    return preset;
  });
  const builtin = builtinBlocks();
  const custom = (customBlocks || []).map((b, i) => ({ id: b.id, label: b.label, custom: true, order: builtin.length + i }));
  return { version: CONFIG_VERSION, blocks: [...builtin, ...custom], presets };
}

/* ── Экспорт/импорт конфигурации кнопок (ТЗ раздел 5): {version, blocks, presets} ── */
export function buttonsExportData() {
  const legacy = CALC_STATE_REF.presets?.length ? CALC_STATE_REF.presets : PRESETS_GEN;
  return migrateLegacy(legacy, CALC_STATE_REF.sharedFavs || {}, CALC_STATE_REF.customBlocks || []);
}
export function applyButtonsImport(data) {
  if (!data || data.version !== CONFIG_VERSION || !Array.isArray(data.presets)) return null;
  return {
    presets: toLegacyPresets(data),
    sharedFavs: favsOfConfig(data),
    customBlocks: (data.blocks || []).filter(b => b.custom).map(b => ({ id: b.id, label: b.label, custom: true })),
  };
}

/* ── Обратный адаптер: v1 → легаси-форма, которую понимает buildEst ── */
export function toLegacyPresets(config) {
  return (config?.presets || []).map(p => {
    const sorted = [...(p.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const out = {
      id: p.id,
      name: p.name,
      cat: p.blockId,
      items: sorted.filter(i => i.src === "param").map(i => i.nomId),
      options: sorted.filter(i => i.src !== "param").map(i => i.nomId),
    };
    if (p.param) out.param = { ...p.param };
    if (p._legacy) Object.assign(out, p._legacy);
    return out;
  });
}

/* Карта видимых кнопок по блокам (= sharedFavs калькулятора): не-hidden в порядке следования */
export function favsOfConfig(cfg) {
  const favs = {};
  (cfg?.blocks || []).forEach(b => {
    favs[b.id] = (cfg?.presets || []).filter(p => p.blockId === b.id && !p.hidden).map(p => p.id);
  });
  return favs;
}

/* ── Раздел 1.5 ТЗ: количество строки.
   Overrides: легаси-инстансы хранят правки в iq (позиции) и oq (опции) — оба главнее src.
   room: { area, perimeter, cornersIn, cornersOut } ── */
export function qtyOf(instance, item, room) {
  const ov = instance?.iq?.[item.nomId] ?? instance?.oq?.[item.nomId];
  if (ov !== undefined && ov !== null) return ov;
  switch (item.src) {
    case "param":    return instance?.qty || 0;
    case "manual":   return 0;
    case "area":     return room?.area || 0;
    case "perim":    return room?.perimeter || 0;
    case "corn_all": return (room?.cornersIn || 0) + (room?.cornersOut || 0);
    case "corn_in":  return room?.cornersIn || 0;
    case "corn_out": return room?.cornersOut || 0;
    default:         return 0;
  }
}

/* ══ Проверка паритета: структурный round-trip + смета до копейки ══ */
const norm = p => ({
  id: p.id, name: p.name, cat: p.cat,
  items: p.items || [], options: p.options || [],
  pid: p.pid, sec: p.sec,
});
const deepEq = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEq(v, b[i]));
  if (a && b && typeof a === "object") {
    const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== undefined || b[k] !== undefined);
    return ks.every(k => deepEq(a[k], b[k]));
  }
  return false;
};

export function runParity() {
  const legacy = CALC_STATE_REF.presets?.length ? CALC_STATE_REF.presets : PRESETS_GEN;
  const back = toLegacyPresets(migrateLegacy(legacy, CALC_STATE_REF.sharedFavs || {}));
  const misses = [];
  legacy.forEach(p => {
    const q = back.find(x => x.id === p.id);
    if (!q) { misses.push({ id: p.id, why: "missing" }); return; }
    if (!deepEq(norm(p), norm(q))) misses.push({ id: p.id, why: "diff", was: norm(p), now: norm(q) });
  });
  const gOpts = CALC_STATE_REF.globalOpts || [];
  const total = e => Math.round((e.mats.reduce((s, l) => s + l.q * l.p, 0) + e.works.reduce((s, l) => s + l.q * l.p, 0)) * 100) / 100;
  const orders = (INITIAL_ORDERS || []).map(o => {
    const before = total(buildEst(o.rooms || [], legacy, gOpts, o.nomSnapshot || null));
    const after = total(buildEst(o.rooms || [], back, gOpts, o.nomSnapshot || null));
    return { order: o.name, before, after, ok: before === after };
  });
  return {
    presets: legacy.length,
    roundTripOk: misses.length === 0,
    misses: misses.slice(0, 5),
    orders,
    allOk: misses.length === 0 && orders.every(r => r.ok),
  };
}

if (typeof window !== "undefined") window.__zamerParity = runParity;

