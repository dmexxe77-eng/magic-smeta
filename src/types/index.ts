// ─── Core Domain Types ───────────────────────────────────────────────

export type RoomMethod = 'compass' | 'trace' | 'manual' | 'recognize' | 'none';

export interface Vertex {
  x: number;
  y: number;
}

export interface Canvas {
  qty: number;          // площадь м²
  nomId?: string;
  overcut?: boolean;
  applyAll?: boolean;
}

export interface MainProf {
  qty: number;          // периметр м.п.
  nomId?: string;
  oq?: Record<string, number>;
  applyAll?: boolean;
}

export interface RoomOption {
  nomId: string;
  qty: number;
  locked?: boolean;
}

export interface Room {
  id: string;
  name: string;
  v: Vertex[];          // вершины полигона
  aO?: number;          // override площади
  pO?: number;          // override периметра
  canvas: Canvas;
  mainProf: MainProf;
  options: RoomOption[];
  on?: boolean;         // включена ли комната
}

export type OrderStatus =
  | 'new'
  | 'measuring'
  | 'calc'
  | 'approval'
  | 'contract'
  | 'done'
  | 'cancelled';

export interface Payment {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Order {
  id: string;
  name: string;
  client?: string;
  clientId?: string;
  phone?: string;
  address?: string;
  designer?: string;
  designerId?: string;
  notes?: string;
  status: OrderStatus;
  method?: RoomMethod;
  createdAt: string;
  measureDate?: string;   // ДД.ММ.ГГГГ
  installDate?: string;   // ДД.ММ.ГГГГ
  rooms: Room[];
  payments: Payment[];
  expenses: Expense[];
  nomSnapshot?: Record<string, number>;
  planImage?: string;   // base64
  // Snapshot последнего расчёта в калькуляторе — обновляется из CalcScreen
  calcSnapshot?: {
    total: number;
    materialsTotal: number;
    worksTotal: number;
    updatedAt: string;  // ДД.ММ.ГГГГ
  };
  // Полное состояние калькулятора — сохраняется при выходе, восстанавливается при входе
  calcState?: {
    blocks: any[];                                              // CalcBlock[]
    mainQtysAll: Record<string, Record<string, number>>;        // [roomId][blockId]
    optQtysAll: Record<string, Record<string, number>>;         // [roomId][nomId]
    perRoomPresets: Record<string, Record<string, string>>;     // [roomId][blockId]
    subtractFromMain: Record<string, boolean>;                  // [blockId]
    roomOptIds: string[];
    roomOptEnabled: Record<string, boolean>;
    roomOptBindings: Record<string, 'area' | 'perimeter'>;
  };
}

// ─── Nomenclature ────────────────────────────────────────────────────

export type NomType = 'canvas' | 'profile' | 'work' | 'option' | 'light';

export interface NomItem {
  id: string;
  name: string;
  price: number;
  purchasePrice?: number;  // закупочная цена
  image?: string;          // file URI from image picker
  unit: string;
  type: NomType;
  brand?: string;          // folder id for custom items
  category?: string;       // display category
  section?: string;        // sub-group (KRAAB, Clamp...)
  bindTo?: 'area' | 'perimeter' | 'qty' | 'none';
}

export interface NomFolder {
  id: string;
  name: string;
  icon?: string;
  isDefault?: boolean;
}

// ─── Estimate ────────────────────────────────────────────────────────

export interface EstimateLine {
  k: string;            // display key (m0, w1, rm0...)
  _k: string;           // real nomId key
  n: string;            // name
  q: number;            // quantity
  u: string;            // unit
  p: number;            // price per unit
}

export interface Estimate {
  mats: EstimateLine[];
  works: EstimateLine[];
}

// ─── Preset templates (глобальная библиотека пресетов) ──────────────

export interface PresetTemplate {
  id: string;
  blockId: string;          // 'canvas' | 'main_profile' | 'extra_profile' | etc — к какому типу блока относится
  name: string;
  items: { nomId: string; enabled: boolean }[];
  options: { nomId: string; enabled: boolean }[];
  isDefault?: boolean;      // дефолтный (приходит из createDefaultBlocks) — нельзя удалить, только скрыть
  createdAt: string;
}

// ─── App State ───────────────────────────────────────────────────────

export interface AppState {
  orders: Order[];
  noms: NomItem[];
  editedNoms: Partial<NomItem>[];
  deletedNomIds: string[];
  nomFolders: NomFolder[];
  presets: string[];
  sharedFavs: Record<string, boolean>;
  globalOpts: RoomOption[];
  theme: 'light' | 'dark';
  isPro: boolean;
  presetTemplates?: PresetTemplate[];   // глобальная библиотека пресетов
}

export interface SaveStatus {
  ts: number;
  ok: boolean;
  ordersCount: number;
}

// ─── Navigation Params ───────────────────────────────────────────────

export type RootStackParamList = {
  '(tabs)': undefined;
  'order/[id]': { id: string };
  'calc/[id]': { id: string };
};
