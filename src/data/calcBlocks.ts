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
    case 'qty': return 1;
  }
}

// ─── Default blocks with real nomenclature refs ─────────────────────

export function createDefaultBlocks(): CalcBlock[] {
  return [
    {
      id: 'canvas',
      title: 'ПОЛОТНО',
      icon: '🎨',
      bindTo: 'area',
      expanded: true,
      activePresetId: 'pr_msd',
      presets: [
        {
          id: 'pr_msd', name: 'MSD',
          items: [
            { nomId: 'c_msd', enabled: true },
            { nomId: 'w_mont_pvh', enabled: true },
          ],
          options: [],
        },
        {
          id: 'pr_tkan', name: 'Ткань',
          items: [
            { nomId: 'c_tkan', enabled: true },
            { nomId: 'w_mont_tk', enabled: true },
          ],
          options: [],
        },
        {
          id: 'pr_trans', name: 'Транслюцидное',
          items: [
            { nomId: 'c_trans', enabled: true },
            { nomId: 'w_mont_pvh', enabled: true },
          ],
          options: [],
        },
      ],
    },
    {
      id: 'main_profile',
      title: 'ОСНОВНОЙ ПРОФИЛЬ',
      icon: '📏',
      bindTo: 'perimeter',
      expanded: true,
      activePresetId: 'pr_mp_2',
      presets: [
        {
          id: 'pr_mp_1', name: 'EUROKRAAB',
          items: [{ nomId: 'p_1', enabled: true }, { nomId: 'w_1', enabled: true }],
          options: [{ nomId: 'o_inner', enabled: true }, { nomId: 'o_outer', enabled: true }],
        },
        {
          id: 'pr_mp_2', name: 'EUROKRAAB STRONG',
          items: [{ nomId: 'p_2', enabled: true }, { nomId: 'w_2', enabled: true }],
          options: [{ nomId: 'o_inner', enabled: true }, { nomId: 'o_outer', enabled: true }],
        },
        {
          id: 'pr_mp_3', name: 'EUROKRAAB 2.0',
          items: [{ nomId: 'p_3', enabled: true }, { nomId: 'w_3', enabled: true }],
          options: [{ nomId: 'o_inner', enabled: true }, { nomId: 'o_outer', enabled: true }],
        },
        {
          id: 'pr_mp_27', name: 'Clamp Umbra',
          items: [{ nomId: 'p_27', enabled: true }, { nomId: 'w_27', enabled: true }],
          options: [{ nomId: 'o_inner', enabled: true }, { nomId: 'o_outer', enabled: true }],
        },
        {
          id: 'pr_mp_45', name: 'EuroLumFer 02',
          items: [{ nomId: 'p_45', enabled: true }, { nomId: 'w_45', enabled: true }],
          options: [{ nomId: 'o_inner', enabled: true }, { nomId: 'o_outer', enabled: true }],
        },
      ],
    },
    {
      id: 'extra_profile',
      title: 'ДОП. ПРОФИЛЬ',
      icon: '📐',
      bindTo: 'qty',
      expanded: false,
      activePresetId: 'pr_ap_10',
      presets: [
        {
          id: 'pr_ap_10', name: 'SLOTT VILLAR MINI',
          items: [{ nomId: 'p_10', enabled: true }, { nomId: 'w_10', enabled: true }],
          options: [{ nomId: 'o_angle', enabled: true }],
        },
        {
          id: 'pr_ap_30', name: 'Clamp Supra',
          items: [{ nomId: 'p_30', enabled: true }, { nomId: 'w_30', enabled: true }],
          options: [{ nomId: 'o_angle', enabled: true }],
        },
        {
          id: 'pr_ap_9', name: 'SLOTT R (разделитель)',
          items: [{ nomId: 'p_9', enabled: true }, { nomId: 'w_9', enabled: true }],
          options: [{ nomId: 'o_angle', enabled: true }, { nomId: 'o_wall', enabled: true }],
        },
      ],
    },
    {
      id: 'lights',
      title: 'СВЕТИЛЬНИКИ / ЛЮСТРА',
      icon: '💡',
      bindTo: 'qty',
      expanded: false,
      activePresetId: 'pr_li_spot',
      presets: [
        {
          id: 'pr_li_spot', name: 'Точечный',
          items: [{ nomId: 'li_spot', enabled: true }, { nomId: 'li_spot_mount', enabled: true }],
          options: [],
        },
        {
          id: 'pr_li_chandelier', name: 'Люстра',
          items: [{ nomId: 'li_chandelier', enabled: true }, { nomId: 'li_chandelier_mount', enabled: true }],
          options: [],
        },
      ],
    },
    {
      id: 'linear_light',
      title: 'ЛИНЕЙНОЕ ОСВЕЩЕНИЕ',
      icon: '💫',
      bindTo: 'qty',
      expanded: false,
      activePresetId: 'pr_ll_19',
      presets: [
        {
          id: 'pr_ll_19', name: 'SLOTT 50',
          items: [{ nomId: 'p_19', enabled: true }, { nomId: 'w_19', enabled: true }],
          options: [{ nomId: 'o_endcap', enabled: true }, { nomId: 'o_turn', enabled: true }, { nomId: 'o_wall', enabled: true }],
        },
        {
          id: 'pr_ll_33', name: 'Clamp Meduza 14',
          items: [{ nomId: 'p_33', enabled: true }, { nomId: 'w_33', enabled: true }],
          options: [{ nomId: 'o_endcap', enabled: true }, { nomId: 'o_turn', enabled: true }],
        },
      ],
    },
    {
      id: 'curtains',
      title: 'ШТОРЫ',
      icon: '🪟',
      bindTo: 'qty',
      expanded: false,
      activePresetId: 'pr_cu_23',
      presets: [
        {
          id: 'pr_cu_23', name: 'SLOTT PARSEK 2.0',
          items: [{ nomId: 'p_23', enabled: true }, { nomId: 'w_23', enabled: true }],
          options: [{ nomId: 'o_endcap', enabled: true }, { nomId: 'o_turn', enabled: true }, { nomId: 'o_wall', enabled: true }],
        },
        {
          id: 'pr_cu_24', name: 'SLOTT MOTION',
          items: [{ nomId: 'p_24', enabled: true }, { nomId: 'w_24', enabled: true }],
          options: [{ nomId: 'o_endcap', enabled: true }, { nomId: 'o_turn', enabled: true }, { nomId: 'o_wall', enabled: true }, { nomId: 'o_motor', enabled: true }],
        },
        {
          id: 'pr_cu_36', name: 'Clamp Cornice Uno',
          items: [{ nomId: 'p_36', enabled: true }, { nomId: 'w_36', enabled: true }],
          options: [{ nomId: 'o_endcap', enabled: true }, { nomId: 'o_turn', enabled: true }, { nomId: 'o_wall', enabled: true }],
        },
      ],
    },
    {
      id: 'custom',
      title: 'СВОИ СБОРКИ',
      icon: '🔧',
      bindTo: 'qty',
      expanded: false,
      activePresetId: '',
      presets: [],
    },
  ];
}
