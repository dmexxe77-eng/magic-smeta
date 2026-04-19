import { calcPoly } from './geometry';
import { getNom, getDefaultMainQty, type CalcBlock, type NomRef } from '../data/calcBlocks';
import type { NomItem as DataNomItem } from '../data/nomenclature';
import type { Room, NomItem as TypeNomItem } from '../types';

export type EstimateMode = 'client' | 'cost' | 'installer' | 'purchase';

export interface EstimateLine {
  nomId: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
  roomName: string;
  isWork: boolean;
}

export interface EstimateData {
  materials: EstimateLine[];
  works: EstimateLine[];
  materialsTotal: number;
  worksTotal: number;
  total: number;
}

function priceFor(nom: DataNomItem, mode: EstimateMode): number {
  // purchasePrice exists on user-edited noms (TypeNomItem); fall back to retail
  const purchase = (nom as unknown as TypeNomItem).purchasePrice;
  switch (mode) {
    case 'client':    return nom.price;
    case 'cost':      return purchase ?? nom.price;
    case 'installer': return nom.price;            // вся работа уходит монтажнику (можно потом коэф добавить)
    case 'purchase':  return purchase ?? nom.price;
  }
}

function isWork(nom: DataNomItem): boolean {
  return nom.type === 'work';
}

function refPrice(ref: NomRef, mode: EstimateMode): { nom: DataNomItem; price: number } | null {
  const nom = getNom(ref.nomId);
  if (!nom) return null;
  if (ref.priceOverride != null && (mode === 'client' || mode === 'installer')) {
    return { nom, price: ref.priceOverride };
  }
  return { nom, price: priceFor(nom, mode) };
}

function shouldInclude(nom: DataNomItem, mode: EstimateMode): boolean {
  switch (mode) {
    case 'client':    return true;
    case 'cost':      return true;
    case 'installer': return isWork(nom);
    case 'purchase':  return !isWork(nom);
  }
}

export function buildEstimate(
  rooms: Room[],
  blocks: CalcBlock[],
  mainQtys: Record<string, number>,
  optQtys: Record<string, number>,
  roomOptIds: string[],
  roomOptEnabled: Record<string, boolean>,
  roomOptBindings: Record<string, 'area' | 'perimeter'>,
  mergedNoms: TypeNomItem[],
  mode: EstimateMode,
): EstimateData {
  const materials: EstimateLine[] = [];
  const works: EstimateLine[] = [];

  for (const room of rooms) {
    const a = room.aO ?? calcPoly(room.v).a;
    const p = room.pO ?? calcPoly(room.v).p;
    const roomName = room.name;

    for (const block of blocks) {
      const preset = block.presets.find(pr => pr.id === block.activePresetId);
      if (!preset) continue;

      const mainQty = mainQtys[block.id] ?? getDefaultMainQty(block, a, p);

      // Items — auto-quantity from area/perimeter
      for (const ref of preset.items) {
        if (!ref.enabled) continue;
        const r = refPrice(ref, mode);
        if (!r || !shouldInclude(r.nom, mode)) continue;
        const total = mainQty * r.price;
        if (total <= 0) continue;
        const line: EstimateLine = {
          nomId: ref.nomId,
          name: r.nom.name,
          qty: mainQty,
          unit: r.nom.unit,
          price: r.price,
          total,
          roomName,
          isWork: isWork(r.nom),
        };
        (isWork(r.nom) ? works : materials).push(line);
      }

      // Options — manual qty per option
      for (const ref of preset.options) {
        if (!ref.enabled) continue;
        const qty = optQtys[ref.nomId] ?? 0;
        if (qty <= 0) continue;
        const r = refPrice(ref, mode);
        if (!r || !shouldInclude(r.nom, mode)) continue;
        const total = qty * r.price;
        const line: EstimateLine = {
          nomId: ref.nomId,
          name: r.nom.name,
          qty,
          unit: r.nom.unit,
          price: r.price,
          total,
          roomName,
          isWork: isWork(r.nom),
        };
        (isWork(r.nom) ? works : materials).push(line);
      }
    }

    // Room options (защита стен/пола etc)
    for (const id of roomOptIds) {
      if (!roomOptEnabled[id]) continue;
      const nom = mergedNoms.find(n => n.id === id) as DataNomItem | undefined;
      if (!nom || !shouldInclude(nom, mode)) continue;
      const binding = roomOptBindings[id] || (nom.bindTo === 'area' ? 'area' : 'perimeter');
      const qty = binding === 'area' ? a : p;
      if (qty <= 0) continue;
      const price = priceFor(nom, mode);
      const total = qty * price;
      const line: EstimateLine = {
        nomId: id,
        name: nom.name,
        qty,
        unit: nom.unit,
        price,
        total,
        roomName,
        isWork: isWork(nom),
      };
      (isWork(nom) ? works : materials).push(line);
    }
  }

  const materialsTotal = materials.reduce((s, l) => s + l.total, 0);
  const worksTotal = works.reduce((s, l) => s + l.total, 0);
  return { materials, works, materialsTotal, worksTotal, total: materialsTotal + worksTotal };
}

export const MODE_LABELS: Record<EstimateMode, string> = {
  client:    'Заказчик',
  cost:      'Себестоимость',
  installer: 'Монтажник',
  purchase:  'Закупка',
};
