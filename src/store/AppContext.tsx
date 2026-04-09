import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { AppState, Order, Room, NomItem, OrderStatus } from '../types';
import { saveAppState, loadAppState, generateId } from '../utils/storage';
import { calcPoly } from '../utils/geometry';

// ─── Default state ────────────────────────────────────────────────────

function makeDefaultOrders(): Order[] {
  return [
    {
      id: 'o1',
      name: 'Талан',
      client: 'Руслан',
      phone: '',
      address: '',
      status: 'new',
      createdAt: new Date().toISOString(),
      rooms: [],
      payments: [],
      expenses: [],
    },
    {
      id: 'o2',
      name: 'Мария',
      client: 'Мария Вершинина',
      phone: '',
      address: '',
      status: 'calc',
      createdAt: new Date().toISOString(),
      rooms: [],
      payments: [],
      expenses: [],
    },
  ];
}

const defaultState: AppState = {
  orders: makeDefaultOrders(),
  noms: [],
  editedNoms: [],
  deletedNomIds: [],
  presets: [],
  sharedFavs: {},
  globalOpts: [],
  theme: 'light',
  isPro: false,
};

// ─── Actions ─────────────────────────────────────────────────────────

type Action =
  | { type: 'LOAD'; payload: Partial<AppState> }
  | { type: 'SET_ORDERS'; orders: Order[] }
  | { type: 'ADD_ORDER'; order: Order }
  | { type: 'UPDATE_ORDER'; id: string; patch: Partial<Order> }
  | { type: 'DELETE_ORDER'; id: string }
  | { type: 'UPDATE_ROOMS'; orderId: string; rooms: Room[] }
  | { type: 'SET_ORDER_STATUS'; id: string; status: OrderStatus }
  | { type: 'UPDATE_SNAPSHOT'; orderId: string; snap: Record<string, number> }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }
  | { type: 'SET_PRO'; isPro: boolean }
  | { type: 'RESET' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload };

    case 'SET_ORDERS':
      return { ...state, orders: action.orders };

    case 'ADD_ORDER':
      return { ...state, orders: [...state.orders, action.order] };

    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.id ? { ...o, ...action.patch } : o
        ),
      };

    case 'DELETE_ORDER':
      return {
        ...state,
        orders: state.orders.filter(o => o.id !== action.id),
      };

    case 'UPDATE_ROOMS':
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId ? { ...o, rooms: action.rooms } : o
        ),
      };

    case 'SET_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.id ? { ...o, status: action.status } : o
        ),
      };

    case 'UPDATE_SNAPSHOT':
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId
            ? { ...o, nomSnapshot: action.snap }
            : o
        ),
      };

    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'SET_PRO':
      return { ...state, isPro: action.isPro };

    case 'RESET':
      return { ...defaultState, orders: [] };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  createOrder: (params: {
    name: string;
    client?: string;
    phone?: string;
    address?: string;
    method?: string;
  }) => Order;
  updateOrderRooms: (orderId: string, rooms: Room[]) => void;
  updateSnapshot: (orderId: string, snap: Record<string, number>) => void;
  saveNow: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load persisted state on mount
  useEffect(() => {
    loadAppState().then(saved => {
      if (saved) {
        dispatch({ type: 'LOAD', payload: saved });
      }
    });
  }, []);

  // Auto-save on state change (debounced)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveAppState(stateRef.current);
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await saveAppState(stateRef.current);
  }, []);

  const createOrder = useCallback(
    (params: {
      name: string;
      client?: string;
      phone?: string;
      address?: string;
      method?: string;
    }): Order => {
      const order: Order = {
        id: generateId(),
        name: params.name.trim() || 'Новый проект',
        client: params.client || '',
        phone: params.phone || '',
        address: params.address || '',
        status: 'new',
        method: (params.method as any) || 'none',
        createdAt: new Date().toISOString(),
        rooms: [],
        payments: [],
        expenses: [],
      };
      dispatch({ type: 'ADD_ORDER', order });
      return order;
    },
    []
  );

  const updateOrderRooms = useCallback(
    (orderId: string, rooms: Room[]) => {
      dispatch({ type: 'UPDATE_ROOMS', orderId, rooms });
    },
    []
  );

  const updateSnapshot = useCallback(
    (orderId: string, snap: Record<string, number>) => {
      dispatch({ type: 'UPDATE_SNAPSHOT', orderId, snap });
    },
    []
  );

  const contextValue = useMemo(
    () => ({ state, dispatch, createOrder, updateOrderRooms, updateSnapshot, saveNow }),
    [state, createOrder, updateOrderRooms, updateSnapshot, saveNow]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useOrder(id: string): Order | undefined {
  const { state } = useApp();
  return state.orders.find(o => o.id === id);
}
