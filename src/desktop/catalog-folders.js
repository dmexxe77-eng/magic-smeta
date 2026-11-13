// Folder identities and default order from the imported working catalogue.
export const CATALOG_FOLDERS = [
  {
    "id": "v2_kraab",
    "label": "KraabSystems",
    "color": "#4F46E5"
  },
  {
    "id": "v2_innoy",
    "label": "INNOY",
    "color": "#0a84ff"
  },
  {
    "id": "v2_p5",
    "label": "5+ Project",
    "color": "#15803d"
  },
  {
    "id": "v2_lumfer",
    "label": "LumFer",
    "color": "#c77700"
  },
  {
    "id": "v2_flexi",
    "label": "FLEXYPRO",
    "color": "#be3455"
  },
  {
    "id": "v2_borzz",
    "label": "BORZZ",
    "color": "#4a5a4a"
  },
  {
    "id": "v2_jm",
    "label": "JM",
    "color": "#9d174d"
  },
  {
    "id": "v2_clipso",
    "label": "Clipso",
    "color": "#b45309"
  },
  {
    "id": "v2_bauf",
    "label": "Bauf",
    "color": "#0f8a8a"
  },
  {
    "id": "v2_teqtum",
    "label": "Teqtum",
    "color": "#0e7490"
  },
  {
    "id": "v2_msd",
    "label": "MSD",
    "color": "#7c5cbf"
  },
  {
    "id": "v2_grishiny",
    "label": "Гришины",
    "color": "#0F766E"
  },
  {
    "id": "brrfrb2a",
    "label": "Свет Краб",
    "color": "#be3455"
  },
  {
    "id": "brrqb5e3",
    "label": "допы",
    "color": "#4F46E5"
  }
];

/** Legacy rows remain searchable without being merged into a current folder by display name. */
export function catalogFolderId(item, folders = CATALOG_FOLDERS) {
  const name = String(item.br || '').trim();
  const renamed = item.brandName != null && name !== item.brandName;
  if (item.brand && !renamed) return folders.find(folder => folder.id === item.brand)?.id || null;
  return folders.find(folder => folder.label === name)?.id || null;
}

export function catalogueFolders(items, order = []) {
  const folders = CATALOG_FOLDERS.map(folder => ({...folder}));
  for (const item of items) {
    const name = String(item.br || '').trim();
    if (!item.arch && name && name !== 'Прочее' && (!item.brand || item.brandName != null && name !== item.brandName)
      && !folders.some(folder => folder.label === name)) folders.push({id:`custom:${name}`, label:name, color:'#526b8e'});
  }
  const ids = new Set(folders.map(folder => folder.id));
  const saved = Array.isArray(order) ? [...new Set(order.filter(id => ids.has(id)))] : [];
  const positions = new Map([...saved, ...folders.map(folder => folder.id).filter(id => !saved.includes(id))].map((id, index) => [id, index]));
  return folders.sort((a,b) => positions.get(a.id) - positions.get(b.id));
}

export function moveCatalogFolder(folders, id, delta) {
  const order = folders.map(folder => folder.id), index = order.indexOf(id), next = index + delta;
  if (index < 0 || next < 0 || next >= order.length) return order;
  [order[index], order[next]] = [order[next], order[index]];
  return order;
}
