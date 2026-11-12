const centimetresFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, useGrouping: false });

/** Display centimetres without changing the precision used by geometry. */
export const fmtCentimetres = value => centimetresFormat.format(value);
