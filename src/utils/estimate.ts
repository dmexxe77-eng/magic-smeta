import { calcPoly } from './geometry';
import { getNom, getDefaultMainQty, type CalcBlock, type NomRef } from '../data/calcBlocks';
import type { NomItem as DataNomItem } from '../data/nomenclature';
import type { Room, NomItem as TypeNomItem } from '../types';

export type EstimateMode = 'client' | 'cost' | 'installer' | 'purchase';

export interface EstimateLine {
  nomId: string;
  name: string;        // already includes "(Помещение)" suffix for canvas
  qty: number;
  unit: string;
  price: number;
  total: number;
  isWork: boolean;
  perRoom: boolean;    // true = canvas (one line per room), false = aggregated
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

// Canvas (полотно) — type 'canvas' goes per-room. Everything else aggregates.
function isPerRoom(nom: DataNomItem): boolean {
  return nom.type === 'canvas';
}

interface RawLine {
  nomId: string;
  nom: DataNomItem;
  qty: number;
  price: number;
  roomName: string;
}

function aggregate(raw: RawLine[]): EstimateLine[] {
  const perRoomLines: EstimateLine[] = [];
  const aggMap: Record<string, EstimateLine> = {};

  for (const r of raw) {
    if (r.qty <= 0) continue;
    const total = r.qty * r.price;
    if (total <= 0) continue;

    if (isPerRoom(r.nom)) {
      perRoomLines.push({
        nomId: r.nomId,
        name: `${r.nom.name} (${r.roomName})`,
        qty: r.qty,
        unit: r.nom.unit,
        price: r.price,
        total,
        isWork: isWork(r.nom),
        perRoom: true,
      });
    } else {
      // Aggregate by nomId+price (different price overrides → separate lines)
      const key = `${r.nomId}@${r.price}`;
      if (aggMap[key]) {
        aggMap[key].qty += r.qty;
        aggMap[key].total += total;
      } else {
        aggMap[key] = {
          nomId: r.nomId,
          name: r.nom.name,
          qty: r.qty,
          unit: r.nom.unit,
          price: r.price,
          total,
          isWork: isWork(r.nom),
          perRoom: false,
        };
      }
    }
  }

  // Per-room lines first (more specific), then aggregated
  return [...perRoomLines, ...Object.values(aggMap)];
}

export function buildEstimate(
  rooms: Room[],
  blocks: CalcBlock[],
  mainQtysAll: Record<string, Record<string, number>>,
  optQtysAll: Record<string, Record<string, number>>,
  roomOptIds: string[],
  roomOptEnabled: Record<string, boolean>,
  roomOptBindings: Record<string, 'area' | 'perimeter'>,
  mergedNoms: TypeNomItem[],
  mode: EstimateMode,
  perRoomPresets: Record<string, Record<string, string>> = {},
  subtractFromMain: Record<string, boolean> = {},
): EstimateData {
  const raw: RawLine[] = [];

  // O(1) поиск номенклатуры — строим один раз вместо linear find в каждом цикле
  const nomMap = new Map<string, DataNomItem>();
  for (const n of mergedNoms) nomMap.set(n.id, n as unknown as DataNomItem);

  for (const room of rooms) {
    const a = room.aO ?? calcPoly(room.v).a;
    const p = room.pO ?? calcPoly(room.v).p;
    const roomName = room.name;
    const mainQtys = mainQtysAll[room.id] ?? {};
    const optQtys = optQtysAll[room.id] ?? {};

    // Per-room subtract total
    const subtractTotal = blocks.reduce((sum, b) => {
      if (!b.canSubtractFromMain || !subtractFromMain[b.id]) return sum;
      return sum + (mainQtys[b.id] ?? 0);
    }, 0);

    for (const block of blocks) {
      const presetId = block.perRoomPreset
        ? (perRoomPresets[room.id]?.[block.id] ?? block.activePresetId)
        : block.activePresetId;
      const preset = block.presets.find(pr => pr.id === presetId);
      if (!preset) continue;
      let mainQty = mainQtys[block.id] ?? getDefaultMainQty(block, a, p);
      // Уменьшаем периметр основного профиля на сумму вычитаемых доп. блоков
      if (block.id === 'main_profile' && mainQtys[block.id] == null) {
        mainQty = Math.max(0, mainQty - subtractTotal);
      }

      for (const ref of preset.items) {
        if (!ref.enabled) continue;
        const r = refPrice(ref, mode);
        if (!r || !shouldInclude(r.nom, mode)) continue;
        raw.push({ nomId: ref.nomId, nom: r.nom, qty: mainQty, price: r.price, roomName });
      }

      for (const ref of preset.options) {
        if (!ref.enabled) continue;
        const qty = optQtys[ref.nomId] ?? 0;
        const r = refPrice(ref, mode);
        if (!r || !shouldInclude(r.nom, mode)) continue;
        raw.push({ nomId: ref.nomId, nom: r.nom, qty, price: r.price, roomName });
      }
    }

    // Room options (защита стен/пола etc)
    for (const id of roomOptIds) {
      if (!roomOptEnabled[id]) continue;
      const nom = nomMap.get(id);
      if (!nom || !shouldInclude(nom, mode)) continue;
      const binding = roomOptBindings[id] || (nom.bindTo === 'area' ? 'area' : 'perimeter');
      const qty = binding === 'area' ? a : p;
      const price = priceFor(nom, mode);
      raw.push({ nomId: id, nom, qty, price, roomName });
    }
  }

  const allLines = aggregate(raw);
  const materials = allLines.filter(l => !l.isWork);
  const works = allLines.filter(l => l.isWork);

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
