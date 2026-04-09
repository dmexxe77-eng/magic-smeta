// ─── Calculator Block / Preset / Nomenclature Architecture ──────────
//
// Block (Полотно, Профиль...)
//   └── Preset buttons (EUROKRAAB, Вставка, MSD...)
//        └── Nomenclatures (Багет 220₽/м.п., Монтаж 450₽/м.п....)
//
// Each block has presets. Each preset has nomenclatures.
// User can edit presets and nomenclatures via ≡ settings icon.

export interface NomLine {
  id: string;
  name: string;
  price: number;
  unit: string;         // м², м.п., шт, компл
  bindTo: 'area' | 'perimeter' | 'qty' | 'none';
  enabled: boolean;
}

export interface Preset {
  id: string;
  name: string;
  noms: NomLine[];
}

export interface CalcBlock {
  id: string;
  title: string;
  icon: string;
  presets: Preset[];
  activePresetId: string;
  expanded: boolean;
}

// ─── Default blocks ─────────────────────────────────────────────────

export function createDefaultBlocks(): CalcBlock[] {
  return [
    {
      id: 'canvas',
      title: 'ПОЛОТНО',
      icon: '🎨',
      expanded: true,
      activePresetId: 'canvas_msd',
      presets: [
        {
          id: 'canvas_msd',
          name: 'MSD (mad)',
          noms: [
            { id: 'c1', name: 'Полотно MSD', price: 320, unit: 'м²', bindTo: 'area', enabled: true },
            { id: 'c2', name: 'Натяжка полотна', price: 500, unit: 'м²', bindTo: 'area', enabled: true },
          ],
        },
        {
          id: 'canvas_cloth',
          name: 'Ткань',
          noms: [
            { id: 'c3', name: 'Полотно Descor', price: 800, unit: 'м²', bindTo: 'area', enabled: true },
            { id: 'c4', name: 'Натяжка ткани', price: 600, unit: 'м²', bindTo: 'area', enabled: true },
          ],
        },
      ],
    },
    {
      id: 'main_profile',
      title: 'ОСНОВНОЙ ПРОФИЛЬ',
      icon: '📏',
      expanded: true,
      activePresetId: 'mp_eurokraab',
      presets: [
        {
          id: 'mp_eurokraab',
          name: 'EUROKRAAB',
          noms: [
            { id: 'mp1', name: 'Профиль EUROKRAAB', price: 220, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'mp2', name: 'Монтаж профиля', price: 450, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
          ],
        },
        {
          id: 'mp_eurokraab_strong',
          name: 'EUROKRAAB STRONG',
          noms: [
            { id: 'mp3', name: 'Профиль EUROKRAAB STRONG', price: 280, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'mp4', name: 'Монтаж профиля', price: 450, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
          ],
        },
        {
          id: 'mp_eurokraab2',
          name: 'EUROKRAAB 2.0',
          noms: [
            { id: 'mp5', name: 'Профиль EUROKRAAB 2.0', price: 350, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'mp6', name: 'Монтаж профиля', price: 500, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
          ],
        },
        {
          id: 'mp_insert',
          name: 'Вставка',
          noms: [
            { id: 'mp7', name: 'Профиль стеновой', price: 90, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'mp8', name: 'Вставка (заглушка)', price: 30, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'mp9', name: 'Монтаж профиля', price: 360, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
          ],
        },
      ],
    },
    {
      id: 'extra_profile',
      title: 'ДОП. ПРОФИЛЬ',
      icon: '📐',
      expanded: false,
      activePresetId: 'ep_floating',
      presets: [
        {
          id: 'ep_floating',
          name: 'Парящий',
          noms: [
            { id: 'ep1', name: 'Профиль парящий', price: 300, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'ep2', name: 'Монтаж парящего', price: 550, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'ep3', name: 'LED лента для парящего', price: 180, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
          ],
        },
        {
          id: 'ep_divider',
          name: 'Разделитель',
          noms: [
            { id: 'ep4', name: 'Профиль разделительный', price: 250, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'ep5', name: 'Монтаж разделителя', price: 500, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
          ],
        },
        {
          id: 'ep_cornice',
          name: 'Ниша карниз',
          noms: [
            { id: 'ep6', name: 'Профиль ниша карниз', price: 400, unit: 'м.п.', bindTo: 'none', enabled: true },
            { id: 'ep7', name: 'Монтаж ниши', price: 600, unit: 'м.п.', bindTo: 'none', enabled: true },
          ],
        },
        {
          id: 'ep_contour',
          name: 'Контурный',
          noms: [
            { id: 'ep8', name: 'Профиль контурный', price: 350, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'ep9', name: 'Монтаж контурного', price: 550, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
            { id: 'ep10', name: 'LED лента', price: 180, unit: 'м.п.', bindTo: 'perimeter', enabled: true },
          ],
        },
      ],
    },
    {
      id: 'lights',
      title: 'СВЕТИЛЬНИКИ / ЛЮСТРА',
      icon: '💡',
      expanded: false,
      activePresetId: 'lt_spot',
      presets: [
        {
          id: 'lt_spot',
          name: 'Точечный',
          noms: [
            { id: 'lt1', name: 'Светильник точечный', price: 350, unit: 'шт', bindTo: 'qty', enabled: true },
            { id: 'lt2', name: 'Закладная + монтаж', price: 300, unit: 'шт', bindTo: 'qty', enabled: true },
          ],
        },
        {
          id: 'lt_chandelier',
          name: 'Люстра',
          noms: [
            { id: 'lt3', name: 'Закладная под люстру', price: 500, unit: 'шт', bindTo: 'qty', enabled: true },
            { id: 'lt4', name: 'Монтаж люстры', price: 800, unit: 'шт', bindTo: 'qty', enabled: true },
          ],
        },
        {
          id: 'lt_track',
          name: 'Трековый',
          noms: [
            { id: 'lt5', name: 'Закладная под трек', price: 600, unit: 'м.п.', bindTo: 'none', enabled: true },
            { id: 'lt6', name: 'Монтаж трекового', price: 900, unit: 'м.п.', bindTo: 'none', enabled: true },
          ],
        },
      ],
    },
    {
      id: 'linear_light',
      title: 'ЛИНЕЙНОЕ ОСВЕЩЕНИЕ',
      icon: '💫',
      expanded: false,
      activePresetId: 'll_led',
      presets: [
        {
          id: 'll_led',
          name: 'LED лента',
          noms: [
            { id: 'll1', name: 'LED лента 14.4W', price: 250, unit: 'м.п.', bindTo: 'none', enabled: true },
            { id: 'll2', name: 'Профиль для ленты', price: 300, unit: 'м.п.', bindTo: 'none', enabled: true },
            { id: 'll3', name: 'Монтаж ленты', price: 400, unit: 'м.п.', bindTo: 'none', enabled: true },
          ],
        },
        {
          id: 'll_power',
          name: 'Блок+диммер',
          noms: [
            { id: 'll4', name: 'Блок питания 100W', price: 1800, unit: 'шт', bindTo: 'qty', enabled: true },
            { id: 'll5', name: 'Диммер', price: 1200, unit: 'шт', bindTo: 'qty', enabled: true },
            { id: 'll6', name: 'Монтаж электрики', price: 500, unit: 'шт', bindTo: 'qty', enabled: true },
          ],
        },
      ],
    },
    {
      id: 'curtains',
      title: 'ШТОРЫ',
      icon: '🪟',
      expanded: false,
      activePresetId: 'cur_rail',
      presets: [
        {
          id: 'cur_rail',
          name: 'Карниз',
          noms: [
            { id: 'cur1', name: 'Карниз потолочный', price: 450, unit: 'м.п.', bindTo: 'none', enabled: true },
            { id: 'cur2', name: 'Монтаж карниза', price: 300, unit: 'м.п.', bindTo: 'none', enabled: true },
          ],
        },
        {
          id: 'cur_niche',
          name: 'Ниша',
          noms: [
            { id: 'cur3', name: 'Ниша под карниз', price: 600, unit: 'м.п.', bindTo: 'none', enabled: true },
            { id: 'cur4', name: 'Монтаж ниши', price: 500, unit: 'м.п.', bindTo: 'none', enabled: true },
          ],
        },
        {
          id: 'cur_electric',
          name: 'Электрокарниз',
          noms: [
            { id: 'cur5', name: 'Электрокарниз', price: 8000, unit: 'шт', bindTo: 'qty', enabled: true },
            { id: 'cur6', name: 'Монтаж электрокарниза', price: 2000, unit: 'шт', bindTo: 'qty', enabled: true },
          ],
        },
      ],
    },
    {
      id: 'custom',
      title: 'СВОИ СБОРКИ',
      icon: '🔧',
      expanded: false,
      activePresetId: '',
      presets: [],
    },
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────

export function calcBlockTotal(
  block: CalcBlock,
  area: number,
  perimeter: number,
  qtyOverrides: Record<string, number>
): number {
  const preset = block.presets.find(p => p.id === block.activePresetId);
  if (!preset) return 0;

  return preset.noms.reduce((sum, nom) => {
    if (!nom.enabled) return sum;
    let qty = qtyOverrides[nom.id] ?? getDefaultQty(nom, area, perimeter);
    return sum + qty * nom.price;
  }, 0);
}

export function getDefaultQty(
  nom: NomLine,
  area: number,
  perimeter: number
): number {
  switch (nom.bindTo) {
    case 'area': return Math.round(area * 100) / 100;
    case 'perimeter': return Math.round(perimeter * 100) / 100;
    case 'qty': return 1;
    case 'none': return 0;
  }
}
