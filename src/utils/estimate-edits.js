/* Corrections belong to a nomenclature line and a room (or the total estimate),
   never to a row index: quantities can change the display order. */
export const estimateLineKey = (scope, kind, id) => JSON.stringify([scope, kind, id]);

export function applyEstimateEdits(estimate, edits, scope = 'total') {
  return Object.fromEntries(['mats', 'works'].map(kind => [kind, estimate[kind].map(line => {
    const k = estimateLineKey(scope, kind, line._k);
    const q = edits?.[k]?.q;
    return { ...line, k, q: typeof q === 'number' && Number.isFinite(q) && q >= 0 ? q : line.q };
  })]));
}

export function mergeRoomEstimates(estimates) {
  return Object.fromEntries(['mats', 'works'].map(kind => {
    const lines = new Map();
    for (const estimate of estimates) for (const line of estimate[kind]) {
      const previous = lines.get(line._k);
      lines.set(line._k, { ...line, q: Math.round(((previous?.q || 0) + line.q) * 100) / 100 });
    }
    return [kind, [...lines.values()]];
  }));
}
