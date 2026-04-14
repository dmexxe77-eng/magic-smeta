/**
 * Full nomenclature database — migrated from web version (profiles.js)
 *
 * Categories:
 * - canvas: Полотна (MSD, Ткань, Транслюцидное)
 * - mp: Основные профили (KRAAB, Clamp, LumFer)
 * - ap: Дополнительные профили (Парящий, Уровневый, Разделитель)
 * - ll: Световые линии
 * - cu: Карнизы
 * - tr: Трек-системы
 * - vn: Вентиляция/диффузоры
 * - tc: Технические профили
 * - work: Работы (монтаж полотна, защита стен)
 * - option: Опции (углы, повороты)
 * - light: Светильники
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface NomItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  type: 'canvas' | 'profile' | 'work' | 'option' | 'light';
  category: string;    // folder name for editor
  section?: string;    // sub-group (KRAAB, Clamp, LumFer...)
  bindTo: 'area' | 'perimeter' | 'qty' | 'none';
}

export interface NomCategory {
  id: string;
  name: string;
  icon: string;
  items: NomItem[];
}

// ─── Options (углы, повороты) ───────────────────────────────────────

const OPTIONS: NomItem[] = [
  { id: 'o_inner', name: 'Угол внутренний', price: 500, unit: 'шт', type: 'option', category: 'Опции', bindTo: 'qty' },
  { id: 'o_outer', name: 'Угол внешний', price: 1200, unit: 'шт', type: 'option', category: 'Опции', bindTo: 'qty' },
  { id: 'o_angle', name: 'Угол', price: 1100, unit: 'шт', type: 'option', category: 'Опции', bindTo: 'qty' },
  { id: 'o_turn', name: 'Поворот', price: 3400, unit: 'шт', type: 'option', category: 'Опции', bindTo: 'qty' },
  { id: 'o_wall', name: 'Примыкание к стене', price: 3000, unit: 'шт', type: 'option', category: 'Опции', bindTo: 'qty' },
  { id: 'o_endcap', name: 'Заглушка', price: 3000, unit: 'шт', type: 'option', category: 'Опции', bindTo: 'qty' },
  { id: 'o_motor', name: 'Привод', price: 4600, unit: 'шт', type: 'option', category: 'Опции', bindTo: 'qty' },
];

// ─── Canvas (Полотна) ───────────────────────────────────────────────

const CANVASES: NomItem[] = [
  { id: 'c_msd', name: 'MSD EVOLUTION', price: 1000, unit: 'м²', type: 'canvas', category: 'Полотна', bindTo: 'area' },
  { id: 'c_tkan', name: 'Тканевое JM', price: 1800, unit: 'м²', type: 'canvas', category: 'Полотна', bindTo: 'area' },
  { id: 'c_trans', name: 'Транслюцидное', price: 2500, unit: 'м²', type: 'canvas', category: 'Полотна', bindTo: 'area' },
  { id: 'c_clear', name: 'Прозрачное', price: 2500, unit: 'м²', type: 'canvas', category: 'Полотна', bindTo: 'area' },
];

// ─── Work (Работы) ──────────────────────────────────────────────────

const WORKS: NomItem[] = [
  { id: 'w_mont_pvh', name: 'Натяжка ПВХ полотна', price: 950, unit: 'м²', type: 'work', category: 'Работы', bindTo: 'area' },
  { id: 'w_mont_tk', name: 'Натяжка тканевого полотна', price: 1700, unit: 'м²', type: 'work', category: 'Работы', bindTo: 'area' },
  { id: 'w_prot', name: 'Защита стен плёнкой', price: 365, unit: 'м.п.', type: 'work', category: 'Работы', bindTo: 'perimeter' },
  { id: 'w_floor', name: 'Защита пола оргалитом', price: 200, unit: 'м²', type: 'work', category: 'Работы', bindTo: 'area' },
];

// ─── Lights (Светильники) ───────────────────────────────────────────

const LIGHTS: NomItem[] = [
  { id: 'li_spot', name: 'Светильник точечный', price: 350, unit: 'шт', type: 'light', category: 'Светильники', bindTo: 'qty' },
  { id: 'li_spot_mount', name: 'Закладная + монтаж точечного', price: 300, unit: 'шт', type: 'light', category: 'Светильники', bindTo: 'qty' },
  { id: 'li_chandelier', name: 'Закладная под люстру', price: 500, unit: 'шт', type: 'light', category: 'Светильники', bindTo: 'qty' },
  { id: 'li_chandelier_mount', name: 'Монтаж люстры', price: 800, unit: 'шт', type: 'light', category: 'Светильники', bindTo: 'qty' },
  { id: 'li_led', name: 'LED лента 14.4W', price: 250, unit: 'м.п.', type: 'light', category: 'Светильники', bindTo: 'none' },
  { id: 'li_led_profile', name: 'Профиль для LED ленты', price: 300, unit: 'м.п.', type: 'light', category: 'Светильники', bindTo: 'none' },
  { id: 'li_psu', name: 'Блок питания 100W', price: 1800, unit: 'шт', type: 'light', category: 'Светильники', bindTo: 'qty' },
  { id: 'li_dimmer', name: 'Диммер', price: 1200, unit: 'шт', type: 'light', category: 'Светильники', bindTo: 'qty' },
];

// ─── Profiles — generated from web P[] array ────────────────────────

interface ProfileDef {
  id: number;
  n: string;
  pr: number;
  w: string;
  wp: number;
  o: string[];
  cat: string;
  sec: string;
}

const P: ProfileDef[] = [
  {id:1,n:"EUROKRAAB",pr:400,w:"Монтаж EUROKRAAB/STRONG/пот.",wp:1600,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
  {id:2,n:"EUROKRAAB STRONG",pr:620,w:"Монтаж EUROKRAAB/STRONG/пот.",wp:1600,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
  {id:3,n:"EUROKRAAB 2.0",pr:400,w:"Монтаж EUROKRAAB 2.0",wp:1800,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
  {id:4,n:"EUROKRAAB потолочн.",pr:450,w:"Монтаж EUROKRAAB/STRONG/пот.",wp:1600,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
  {id:5,n:"EUROKRAAB BOX",pr:990,w:"Монтаж EUROKRAAB/STRONG/пот.",wp:1600,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
  {id:6,n:"AIRKRAAB 2.0",pr:1090,w:"Монтаж AIRKRAAB 2.0",wp:2300,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
  {id:7,n:"EUROSLOTT",pr:630,w:"Монтаж EUROSLOTT",wp:2200,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
  {id:8,n:"KRAAB 4.0",pr:550,w:"Монтаж KRAAB 4.0",wp:2800,o:["angle"],cat:"mp",sec:"KRAAB"},
  {id:27,n:"Clamp Umbra перф.",pr:660,w:"Монтаж Clamp Umbra/Top/Box",wp:1100,o:["inner_angle","outer_angle"],cat:"mp",sec:"Clamp"},
  {id:28,n:"Clamp Umbra Top",pr:1000,w:"Монтаж Clamp Umbra/Top/Box",wp:1100,o:["inner_angle","outer_angle"],cat:"mp",sec:"Clamp"},
  {id:29,n:"Clamp Umbra Box",pr:940,w:"Монтаж Clamp Umbra/Top/Box",wp:1100,o:["inner_angle","outer_angle"],cat:"mp",sec:"Clamp"},
  {id:45,n:"EuroLumFer 02",pr:420,w:"Монтаж EuroLumFer 02",wp:1100,o:["inner_angle","outer_angle"],cat:"mp",sec:"LumFer"},
  {id:46,n:"Double LumFer",pr:1160,w:"Монтаж Double LumFer",wp:2300,o:["angle"],cat:"mp",sec:"LumFer"},
  {id:9,n:"SLOTT R",pr:2990,w:"Монтаж SLOTT R",wp:5300,o:["angle","wall_junction"],cat:"ap",sec:"Разделитель"},
  {id:10,n:"SLOTT VILLAR MINI",pr:2840,w:"Монтаж SLOTT VILLAR MINI",wp:2300,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:11,n:"SLOTT VILLAR KIT",pr:2310,w:"Монтаж SLOTT VILLAR MINI",wp:2300,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:12,n:"SLOTT VILLAR BASE",pr:1560,w:"Монтаж SLOTT VILLAR MINI",wp:2300,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:30,n:"Clamp Supra",pr:1100,w:"Монтаж Clamp Supra",wp:1350,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:31,n:"Clamp Radium mini",pr:1980,w:"Монтаж Clamp Radium mini",wp:1800,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:32,n:"Clamp Radium",pr:2100,w:"Монтаж Clamp Radium",wp:2400,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:47,n:"Volat mini",pr:1300,w:"Монтаж Volat mini/Volat",wp:1800,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:48,n:"Volat",pr:1760,w:"Монтаж Volat mini/Volat",wp:1800,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:49,n:"BP03",pr:2100,w:"Монтаж BP03",wp:2400,o:["angle"],cat:"ap",sec:"Парящий"},
  {id:13,n:"MADERNO 80",pr:2980,w:"Монтаж MADERNO 80/60/40",wp:3750,o:["turn","wall_junction"],cat:"ap",sec:"Уровневый"},
  {id:14,n:"MADERNO 60",pr:2210,w:"Монтаж MADERNO 80/60/40",wp:3750,o:["turn","wall_junction"],cat:"ap",sec:"Уровневый"},
  {id:15,n:"MADERNO 40",pr:1650,w:"Монтаж MADERNO 80/60/40",wp:3750,o:["turn","wall_junction"],cat:"ap",sec:"Уровневый"},
  {id:16,n:"ARTISS",pr:1130,w:"Монтаж ARTISS",wp:3750,o:["turn","wall_junction"],cat:"ap",sec:"Уровневый"},
  {id:17,n:"TRAYLIN",pr:2090,w:"Монтаж TRAYLIN",wp:1800,o:["angle"],cat:"ap",sec:"Уровневый"},
  {id:18,n:"TRAYLIN с рассеив.",pr:2540,w:"Монтаж TRAYLIN",wp:1800,o:["angle"],cat:"ap",sec:"Уровневый"},
  {id:37,n:"Clamp Top",pr:1700,w:"Монтаж Clamp Top",wp:1100,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
  {id:38,n:"Clamp Level 50",pr:1720,w:"Монтаж Clamp Level 50/70/90",wp:1800,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
  {id:39,n:"Clamp Level 70",pr:2320,w:"Монтаж Clamp Level 50/70/90",wp:1800,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
  {id:40,n:"Clamp Level LUX 70",pr:2360,w:"Монтаж Clamp Level LUX 70",wp:1800,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
  {id:41,n:"Clamp Level 90",pr:2720,w:"Монтаж Clamp Level 50/70/90",wp:1800,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
  {id:19,n:"SLOTT 50",pr:6850,w:"Монтаж SLOTT 50",wp:5300,o:["end_cap","turn","wall_junction"],cat:"ll",sec:"Свет. линии"},
  {id:20,n:"SLOTT 35",pr:5830,w:"Монтаж SLOTT 35",wp:5300,o:["end_cap","turn","wall_junction"],cat:"ll",sec:"Свет. линии"},
  {id:21,n:"SLOTT CANYON 3.0",pr:5530,w:"Монтаж SLOTT CANYON 3.0",wp:4950,o:["end_cap","turn","wall_junction"],cat:"ll",sec:"Свет. линии"},
  {id:22,n:"SLOTT LINE",pr:4480,w:"Монтаж SLOTT LINE",wp:5300,o:["end_cap","turn","wall_junction"],cat:"ll",sec:"Свет. линии"},
  {id:33,n:"Clamp Meduza 14 (разд.)",pr:2800,w:"Монтаж Clamp Meduza 14 разд.",wp:1800,o:["end_cap","turn"],cat:"ll",sec:"Свет. линии"},
  {id:34,n:"Clamp Meduza 14 (свет.)",pr:2800,w:"Монтаж Clamp Meduza 14 свет.",wp:2050,o:["end_cap","turn"],cat:"ll",sec:"Свет. линии"},
  {id:35,n:"Clamp Meduza 35",pr:3200,w:"Монтаж Clamp Meduza 35",wp:2400,o:["end_cap","turn"],cat:"ll",sec:"Свет. линии"},
  {id:50,n:"B01 (ниша)",pr:2300,w:"Монтаж B01",wp:2400,o:["end_cap","turn"],cat:"ll",sec:"Ниши"},
  {id:51,n:"SV (свет. линия)",pr:920,w:"Монтаж SV",wp:2400,o:["end_cap","turn"],cat:"ll",sec:"Ниши"},
  {id:52,n:"UN (универс. ниша)",pr:3040,w:"Монтаж UN",wp:3000,o:["end_cap","turn"],cat:"ll",sec:"Ниши"},
  {id:53,n:"N02 (ниша)",pr:2400,w:"Монтаж N02",wp:2400,o:["end_cap","turn"],cat:"ll",sec:"Ниши"},
  {id:23,n:"SLOTT PARSEK 2.0",pr:5160,w:"Монтаж SLOTT PARSEK 2.0",wp:5300,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"KRAAB"},
  {id:24,n:"SLOTT MOTION",pr:3960,w:"Монтаж SLOTT MOTION",wp:5300,o:["end_cap","turn","wall_junction","motor_setup"],cat:"cu",sec:"KRAAB"},
  {id:25,n:"SLIM ROAD 01",pr:2840,w:"Монтаж SLOTT PARSEK 2.0",wp:5300,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"KRAAB"},
  {id:36,n:"Clamp Cornice Uno",pr:2560,w:"Монтаж Clamp Cornice Uno",wp:1800,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"Clamp"},
  {id:54,n:"SK Novus",pr:3600,w:"Монтаж SK Novus/SK Magnum",wp:2400,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:55,n:"SK Magnum",pr:5280,w:"Монтаж SK Novus/SK Magnum",wp:2400,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:56,n:"Sputnik",pr:4400,w:"Монтаж Sputnik",wp:1200,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:57,n:"UK (универс.)",pr:2660,w:"Монтаж UK/SK03",wp:2400,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:58,n:"SK03 (теневой)",pr:3460,w:"Монтаж UK/SK03",wp:2400,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:59,n:"VMK01",pr:660,w:"Монтаж VMK01/VMK02",wp:1000,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:60,n:"VMK02",pr:1080,w:"Монтаж VMK01/VMK02",wp:1000,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:61,n:"EuroTop",pr:880,w:"Монтаж EuroTop",wp:1100,o:["turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:62,n:"PDK60 NEW",pr:1040,w:"Монтаж PDK60/PDK80/PDK100",wp:2400,o:["turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:63,n:"PDK80",pr:1300,w:"Монтаж PDK60/PDK80/PDK100",wp:2400,o:["turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:64,n:"PDK100",pr:1560,w:"Монтаж PDK60/PDK80/PDK100",wp:2400,o:["turn","wall_junction"],cat:"cu",sec:"LumFer"},
  {id:42,n:"Clamp Track 23 (48V)",pr:6900,w:"Монтаж Clamp Track 23/25",wp:6000,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"Clamp"},
  {id:43,n:"Clamp Track 25 (220V)",pr:6900,w:"Монтаж Clamp Track 23/25",wp:6000,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"Clamp"},
  {id:65,n:"Track 23 Light 48V",pr:5225,w:"Монтаж Track 23/25",wp:4800,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"LumFer"},
  {id:66,n:"Track 23 48V",pr:5225,w:"Монтаж Track 23/25",wp:4800,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"LumFer"},
  {id:67,n:"Track 25 Light 220V",pr:5225,w:"Монтаж Track 23/25",wp:4800,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"LumFer"},
  {id:68,n:"Track 25 220V",pr:5225,w:"Монтаж Track 23/25",wp:4800,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"LumFer"},
  {id:69,n:"Standart 48",pr:1860,w:"Монтаж Standart 48/220",wp:2400,o:[],cat:"tr",sec:"LumFer"},
  {id:70,n:"Standart 220",pr:1960,w:"Монтаж Standart 48/220",wp:2400,o:[],cat:"tr",sec:"LumFer"},
  {id:26,n:"Диффузор SLOTT 5+",pr:0,w:"Монтаж диффузора SLOTT 5+",wp:6000,o:[],cat:"vn",sec:"KRAAB"},
  {id:44,n:"Clamp Diffuser",pr:13200,w:"Монтаж Clamp Diffuser",wp:7200,o:[],cat:"vn",sec:"Clamp"},
  {id:71,n:"LumFer Diffuser гот.",pr:8360,w:"Монтаж LumFer Diffuser",wp:4800,o:[],cat:"tc",sec:"Тех."},
  {id:72,n:"LumFer Diffuser проф.",pr:4860,w:"Монтаж LumFer Diffuser",wp:4800,o:[],cat:"tc",sec:"Тех."},
  {id:73,n:"BU (брус 2×3)",pr:400,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
  {id:74,n:"BS (контур. подсв.)",pr:520,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
  {id:75,n:"BT (теневой брус)",pr:740,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
  {id:76,n:"BT-U (теневой ун.)",pr:820,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
  {id:77,n:"TR (отбойник)",pr:500,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
  {id:78,n:"TD (держатель)",pr:780,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
  {id:79,n:"Люк 40×40",pr:9900,w:"Монтаж люка 40×40",wp:3600,o:[],cat:"tc",sec:"Тех."},
  {id:80,n:"Люк 80×40",pr:15400,w:"Монтаж люка 80×40",wp:4800,o:[],cat:"tc",sec:"Тех."},
];

// Category display names
const CAT_NAMES: Record<string, string> = {
  mp: 'Основные профили',
  ap: 'Доп. профили',
  ll: 'Световые линии',
  cu: 'Карнизы',
  tr: 'Трек-системы',
  vn: 'Вентиляция',
  tc: 'Технические',
};

// Convert P[] to NomItem[] — each profile generates 2 items: material + work
function profileToNoms(p: ProfileDef): NomItem[] {
  const catName = CAT_NAMES[p.cat] || p.cat;
  return [
    {
      id: `p_${p.id}`,
      name: `${p.n} профиль`,
      price: p.pr,
      unit: 'м.п.',
      type: 'profile',
      category: catName,
      section: p.sec,
      bindTo: 'perimeter',
    },
    {
      id: `w_${p.id}`,
      name: p.w,
      price: p.wp,
      unit: 'м.п.',
      type: 'work',
      category: catName,
      section: p.sec,
      bindTo: 'perimeter',
    },
  ];
}

// Generate option NomItems for a profile
function profileOptions(p: ProfileDef): NomItem[] {
  const optMap: Record<string, NomItem> = {
    inner_angle: OPTIONS.find(o => o.id === 'o_inner')!,
    outer_angle: OPTIONS.find(o => o.id === 'o_outer')!,
    angle: OPTIONS.find(o => o.id === 'o_angle')!,
    turn: OPTIONS.find(o => o.id === 'o_turn')!,
    wall_junction: OPTIONS.find(o => o.id === 'o_wall')!,
    end_cap: OPTIONS.find(o => o.id === 'o_endcap')!,
    motor_setup: OPTIONS.find(o => o.id === 'o_motor')!,
  };
  return p.o.map(key => optMap[key]).filter(Boolean);
}

// ─── Full database ──────────────────────────────────────────────────

const PROFILE_NOMS = P.flatMap(profileToNoms);

export const ALL_NOMS: NomItem[] = [
  ...CANVASES,
  ...WORKS,
  ...OPTIONS,
  ...LIGHTS,
  ...PROFILE_NOMS,
];

// ─── Organized by categories ────────────────────────────────────────

export const NOM_CATEGORIES: NomCategory[] = [
  { id: 'canvas', name: 'Полотна', icon: '🎨', items: CANVASES },
  { id: 'work', name: 'Работы', icon: '🔧', items: WORKS },
  { id: 'option', name: 'Опции (углы, повороты)', icon: '📐', items: OPTIONS },
  { id: 'light', name: 'Светильники', icon: '💡', items: LIGHTS },
  { id: 'mp', name: 'Основные профили', icon: '📏', items: ALL_NOMS.filter(n => n.category === 'Основные профили') },
  { id: 'ap', name: 'Доп. профили', icon: '📐', items: ALL_NOMS.filter(n => n.category === 'Доп. профили') },
  { id: 'll', name: 'Световые линии', icon: '💫', items: ALL_NOMS.filter(n => n.category === 'Световые линии') },
  { id: 'cu', name: 'Карнизы', icon: '🪟', items: ALL_NOMS.filter(n => n.category === 'Карнизы') },
  { id: 'tr', name: 'Трек-системы', icon: '🔦', items: ALL_NOMS.filter(n => n.category === 'Трек-системы') },
  { id: 'tc', name: 'Технические', icon: '⚙️', items: ALL_NOMS.filter(n => n.category === 'Технические' || n.category === 'Вентиляция') },
];

// ─── Helpers ────────────────────────────────────────────────────────

export function getNomById(id: string): NomItem | undefined {
  return ALL_NOMS.find(n => n.id === id);
}

export function getProfileById(pid: number): ProfileDef | undefined {
  return P.find(p => p.id === pid);
}

export function getProfileOptions(pid: number): NomItem[] {
  const p = P.find(x => x.id === pid);
  return p ? profileOptions(p) : [];
}

export function getProfileNoms(pid: number): NomItem[] {
  const p = P.find(x => x.id === pid);
  return p ? profileToNoms(p) : [];
}

/** Get all profiles grouped by section */
export function getProfilesBySection(cat: string): Record<string, ProfileDef[]> {
  const filtered = P.filter(p => p.cat === cat);
  const groups: Record<string, ProfileDef[]> = {};
  for (const p of filtered) {
    if (!groups[p.sec]) groups[p.sec] = [];
    groups[p.sec].push(p);
  }
  return groups;
}

/** Total count */
export const NOM_COUNT = ALL_NOMS.length;
