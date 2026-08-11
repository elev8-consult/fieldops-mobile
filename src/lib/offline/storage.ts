import AsyncStorage from '@react-native-async-storage/async-storage';

/** Namespaced keys for everything we persist on the device. */
export const KEYS = {
  catalog: 'fieldops.catalog.v1',
  catalogSyncedAt: 'fieldops.catalog.syncedAt.v1',
  queue: 'fieldops.queue.v1',
  outlets: 'fieldops.outlets.v1',
} as const;

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — the app still works online.
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
