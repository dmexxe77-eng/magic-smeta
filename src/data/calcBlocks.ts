// ─── Calculator Block / Preset Architecture ─────────────────────────
//
// Block (Полотно, Профиль...)
//   └── Preset buttons (EUROKRAAB, MSD...)
//        ├── items: NomRef[]   — left side, qty auto from area/perimeter/input
//        └── options: NomRef[] — right side, qty manual per option
//
// NomRef links to nomenclature.ts by nomId

import { ALL_NOMS, type NomItem } from './nomenclature';

// ─── Types ──────────────────────────────────────────────────────────

export interface NomRef {
  nomId: string;        // references NomItem.id from nomenclature.ts
  enabled: boolean;
  priceOverride?: number; // per-project price override
}

export interface Preset {
  id: string;
  name: string;
  items: NomRef[];      // LEFT side — auto qty (area/perimeter/count)
  options: NomRef[];    // RIGHT side — manual qty per option
}

export interface CalcBlock {
  id: string;
  title: string;
  icon: string;
  bindTo: 'area' | 'perimeter' | 'qty'; // what drives the "общее значение"
  presets: Preset[];
  activePresetId: string;
  expanded: boolean;
  perRoomPreset?: boolean;  // true = пресет выбирается отдельно для каждой комнаты
  canSubtractFromMain?: boolean;  // true = блок может вычитать свой qty из основного профиля
}

// ─── Helpers ────────────────────────────────────────────────────────

// Optional merged noms array — if provided, uses user-edited data
let _mergedNoms: NomItem[] | null = null;

/** Set the merged noms array (call from CalcScreen with useNomenclature) */
export function setMergedNoms(noms: any[]) {
  _mergedNoms = noms as NomItem[];
}

export function getNom(nomId: string): NomItem | undefined {
  const source = _mergedNoms || ALL_NOMS;
  return source.find(n => n.id === nomId);
}

/** Get all available noms (merged if set, otherwise hardcoded) */
export function getAllNoms(): NomItem[] {
  return _mergedNoms || ALL_NOMS as NomItem[];
}

export function getNomPrice(ref: NomRef): number {
  if (ref.priceOverride != null) return ref.priceOverride;
  return getNom(ref.nomId)?.price ?? 0;
}

export function calcPresetTotal(
  preset: Preset,
  mainQty: number,
  optQtys: Record<string, number>,
): number {
  let total = 0;
  for (const ref of preset.items) {
    if (!ref.enabled) continue;
    total += mainQty * getNomPrice(ref);
  }
  for (const ref of preset.options) {
    if (!ref.enabled) continue;
    const qty = optQtys[ref.nomId] ?? 0;
    total += qty * getNomPrice(ref);
  }
  return total;
}

export function calcBlockTotal(
  block: CalcBlock,
  area: number,
  perimeter: number,
  mainQtyOverride: number | undefined,
  optQtys: Record<string, number>,
): number {
  const preset = block.presets.find(p => p.id === block.activePresetId);
  if (!preset) return 0;
  const mainQty = mainQtyOverride ?? getDefaultMainQty(block, area, perimeter);
  return calcPresetTotal(preset, mainQty, optQtys);
}

export function getDefaultMainQty(block: CalcBlock, area: number, perimeter: number): number {
  switch (block.bindTo) {
    case 'area': return Math.round(area * 100) / 100;
    case 'perimeter': return Math.round(perimeter * 100) / 100;
    case 'qty': return 0;  // Доп. блоки: пользователь вводит количество вручную
  }
}

// ─── Default blocks with real nomenclature refs ─────────────────────

export function createDefaultBlocks(): CalcBlock[] {
  // Дефолтные пресеты удалены — пользователь создаёт свои через редактор пресетов.
  // Структура блоков остаётся стандартной (полотно, профиль, ...) — пресеты в каждом пустые.
  const empty = (id: string, title: string, icon: string, bindTo: 'area' | 'perimeter' | 'qty', extras: Partial<CalcBlock> = {}): CalcBlock => ({
    id, title, icon, bindTo,
    expanded: bindTo === 'area' || id === 'main_profile',
    activePresetId: '',
    presets: [],
    ...extras,
  });
  return [
    empty('canvas',         'ПОЛОТНО',              '🎨', 'area',      { perRoomPreset: true }),
    empty('main_profile',   'ОСНОВНОЙ ПРОФИЛЬ',     '📏', 'perimeter', { perRoomPreset: true }),
    empty('extra_profile',  'ДОП. ПРОФИЛЬ',         '📐', 'qty',       { canSubtractFromMain: true }),
    empty('lights',         'СВЕТИЛЬНИКИ / ЛЮСТРА', '💡', 'qty'),
    empty('linear_light',   'ЛИНЕЙНОЕ ОСВЕЩЕНИЕ',   '💫', 'qty'),
    empty('curtains',       'ШТОРЫ',                '🪟', 'qty'),
    empty('custom',         'СВОИ СБОРКИ',          '🔧', 'qty'),
  ];
}

