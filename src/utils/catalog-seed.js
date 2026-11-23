const identity = row => row?.nid ?? row?.id;
const copy = value => JSON.parse(JSON.stringify(value));

/** Apply a supplier update once, retaining user edits and deletions on later loads. */
export function applyCatalogSeed(snapshot, seed) {
  if (!seed) return snapshot;
  if (Array.isArray(seed)) return seed.reduce((value, entry) => applyCatalogSeed(value, entry), snapshot);
  if (typeof seed.version !== 'string' || !seed.version || !Array.isArray(seed.rows) || !Array.isArray(snapshot?.nom)) throw new Error('Invalid catalog seed');
  if (Array.isArray(snapshot.catalogueVersions) && snapshot.catalogueVersions.includes(seed.version)) return snapshot;
  const brand = seed.brand === undefined ? 'LumFer' : seed.brand;
  if (typeof brand !== 'string' || !brand.trim()) throw new Error('Invalid catalog seed brand');
  const rows = new Map();
  for (const row of seed.rows) {
    const validCost = Number.isFinite(row?.pCost) && (seed.allowZeroCost === true ? row.pCost >= 0 : row.pCost > 0);
    if (typeof row?.id !== 'string' || !row.id || rows.has(row.id) || typeof row.n !== 'string'
      || typeof row.u !== 'string' || row.br !== brand || row.category !== 'equipment'
      || !Number.isFinite(row.p) || row.p <= 0 || !validCost) throw new Error('Invalid catalog seed row');
    rows.set(row.id, row);
  }
  const matched = row => {
    const id = identity(row);
    if (id != null) return rows.has(String(id)) ? {id:String(id), identified:true} : null;
    if (row.br !== brand || !Object.hasOwn(seed.legacyAliases || {}, row.n)) return null;
    const alias = seed.legacyAliases[row.n], canonical = rows.get(alias);
    return canonical && row.u === canonical.u ? {id:alias, identified:false} : null;
  };
  const selected = new Map();
  snapshot.nom.forEach((row, index) => {
    const match = matched(row), previous = match && selected.get(match.id);
    if (match && (!previous || match.identified && !previous.identified)) selected.set(match.id, {...match, index});
  });
  const names = new Map([...selected].map(([id, match]) => [id, new Set([snapshot.nom[match.index].n])]));
  const nom = [];
  snapshot.nom.forEach((row, index) => {
    const match = matched(row);
    if (!match) { nom.push(row); return; }
    const primary = selected.get(match.id).index === index;
    if (!primary) {
      if (names.get(match.id).has(row.n)) return;
      names.get(match.id).add(row.n);
    }
    const merged = {...row, ...copy(rows.get(match.id))};
    // Older mobile presets and estimate overrides can still use the display name as a key.
    merged.n = row.n;
    merged.name = typeof row.name === 'string' ? row.name : row.n;
    if (!primary) { delete merged.id; delete merged.nid; }
    nom.push(merged);
  });
  for (const [id, row] of rows) if (!selected.has(id)) nom.push(copy(row));
  const previous = Array.isArray(snapshot.catalogueVersions) ? snapshot.catalogueVersions : [];
  return {...snapshot, nom, catalogueVersions:[...previous, seed.version]};
}
