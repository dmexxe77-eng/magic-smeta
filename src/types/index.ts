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
  rooms: Room[];
  payments: Payment[];
  expenses: Expense[];
  nomSnapshot?: Record<string, number>;
  planImage?: string;   // base64
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
