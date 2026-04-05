import { LazyStore } from '@tauri-apps/plugin-store';

let storeInstance: LazyStore | null = null;

export function getStore(): LazyStore {
  if (!storeInstance) {
    storeInstance = new LazyStore('bsn_isync_store.json');
    console.log('[Store] LazyStore initialized');
  }
  return storeInstance;
}

export function useStore() {
  async function setItem(key: string, value: any) {
    try {
      const s = getStore();
      await s.set(key, value);
      await s.save();
      console.log(`[Store] Saved: ${key}`, value);
    } catch (e) {
      console.error(`[Store] Failed to set "${key}":`, e);
    }
  }

  async function getItem<T>(key: string): Promise<T | null> {
    try {
      const s = getStore();
      const val = await s.get<T>(key);
      return val ?? null;
    } catch (e) {
      console.error(`[Store] Failed to get "${key}":`, e);
      return null;
    }
  }

  async function removeItem(key: string) {
    try {
      const s = getStore();
      await s.delete(key);
      await s.save();
    } catch (e) {
      console.error(`[Store] Failed to delete "${key}":`, e);
    }
  }

  async function clear() {
    try {
      const s = getStore();
      await s.clear();
      await s.save();
    } catch (e) {
      console.error("[Store] Failed to clear:", e);
    }
  }

  async function save() {
    try {
      const s = getStore();
      await s.save();
    } catch (e) {
      console.error("[Store] Failed to save:", e);
    }
  }

  return { setItem, getItem, removeItem, clear, save };
}
