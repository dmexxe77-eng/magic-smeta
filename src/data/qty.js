/* ═══ Нормы расхода (SPEC_нормы_расхода.md) ═══
   k — норма на 1 единицу источника. Нет или 1 — поведение как раньше,
   поэтому старые пресеты и сохранённые конфигурации считаются идентично.

   Округление вверх — только для «шт»: половину самореза не купить.
   Метраж остаётся дробным, иначе 20,4 м профиля превратятся в 21 и смета разойдётся. */

export const koOf = k => (k == null || k === "" ? 1 : Number(k) || 1);
export const hasKo = (src, k) => src !== "manual" && koOf(k) !== 1;

/* Применить норму к базе источника */
export function applyKo(base, k, unit) {
  const kk = koOf(k);
  /* Нормы нет — возвращаем базу как есть, без округления: критерий 1 SPEC
     (пресеты без k считаются ровно как раньше; иначе 2,5 шт стали бы 3). */
  if (kk === 1) return base;
  let q = (Number(base) || 0) * kk;
  if (unit === "шт" || unit === "шт.") q = Math.ceil(q - 1e-9);
  return Math.round(q * 1000) / 1000;
}

/* База источника: room = {area, perim, cIn, cOut} */
export function baseOfSrc(src, paramValue, room) {
  switch (src) {
    case "param": return paramValue || 0;
    case "manual": return 0;
    case "area": return room?.area || 0;
    case "perim": return room?.perim || 0;
    case "corn_all": return (room?.cIn || 0) + (room?.cOut || 0);
    case "corn_in": return room?.cIn || 0;
    case "corn_out": return room?.cOut || 0;
    default: return 0;
  }
}

/* Источник легаси-опции по её id (углы чертежа подставляются автоматически) */
export const legacyOptionSrc = nomId =>
  nomId === "o_inner_angle" ? "corn_in" :
  nomId === "o_outer_angle" ? "corn_out" :
  nomId === "o_angle" ? "corn_all" : "manual";

/* Кратность упаковки/палки (поле mult в номенклатуре).
   Включается флажком у позиции: количество округляется вверх до кратного.
   Напр. профиль палками по 2 м: 30,65 м → 32 м (16 палок). */
export function applyMult(q, mult, use) {
  const m = Number(mult) || 0;
  if (!use || m <= 0) return q;
  return Math.round(Math.ceil((Number(q) || 0) / m - 1e-9) * m * 1000) / 1000;
}
