import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, Order, NomItem, SaveStatus } from '../types';

const SAVE_KEY = 'magicapp_native_v1';
const META_KEY = 'magicapp_native_meta_v1';

export async function saveAppState(state: Partial<AppState>): Promise<boolean> {
  try {
    // Strip planImage (too large) before saving to AsyncStorage
    const sanitized = {
      ...state,
      orders: state.orders?.map(o => ({ ...o, planImage: undefined })),
    };
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(sanitized));
    await AsyncStorage.setItem(
      META_KEY,
      JSON.stringify({ ok: true, ts: Date.now() })
    );
    return true;
  } catch (e) {
    console.error('saveAppState error:', e);
    return false;
  }
}

export async function loadAppState(): Promise<Partial<AppState> | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AppState>;
  } catch (e) {
    console.error('loadAppState error:', e);
    return null;
  }
}

export async function getSaveStatus(): Promise<SaveStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Plan images stored separately with order key
export async function savePlanImage(orderId: string, base64: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`magic_plan_${orderId}`, base64);
  } catch (e) {
    console.error('savePlanImage error:', e);
  }
}

export async function loadPlanImage(orderId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`magic_plan_${orderId}`);
  } catch {
    return null;
  }
}

export async function deletePlanImage(orderId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`magic_plan_${orderId}`);
  } catch {
    // ignore
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
