import { LazyStore } from '@tauri-apps/plugin-store';

/**
 * Global singleton store instance with autoSave enabled (500ms debounce).
 * In Tauri v2, LazyStore handles internal loading on first use.
 */
const store = new LazyStore('bsn_isync_store.json', { defaults: {}, autoSave: 500 });

export function useStore() {
  /**
   * Set a value in the store. 
   * Local changes are reactive in the store instance, and autoSave handles disk persistence.
   */
  async function setItem(key: string, value: any) {
    try {
      await store.set(key, value);
      console.log(`[Store] Key "${key}" updated.`);
    } catch (e) {
      console.error(`[Store] Failed to set key "${key}":`, e);
    }
  }

  /**
   * Get a value from the store.
   * Returns null if the value is undefined or not found for consistency.
   */
  async function getItem<T>(key: string): Promise<T | null> {
    try {
      const val = await store.get<T>(key);
      return val ?? null;
    } catch (e) {
      console.error(`[Store] Failed to get key "${key}":`, e);
      return null;
    }
  }

  /**
   * Remove a key from the store.
   */
  async function removeItem(key: string) {
    try {
      await store.delete(key);
    } catch (e) {
      console.error(`[Store] Failed to delete key "${key}":`, e);
    }
  }

  /**
   * Clear all entries in the store.
   */
  async function clear() {
    try {
      await store.clear();
    } catch (e) {
      console.error("[Store] Failed to clear store:", e);
    }
  }

  /**
   * Manually trigger a save. 
   * (Usually not needed if autoSave is enabled)
   */
  async function save() {
    try {
      await store.save();
    } catch (e) {
      console.error("[Store] Failed to save store:", e);
    }
  }

  return {
    setItem,
    getItem,
    removeItem,
    clear,
    save,
    store // expose raw store if needed
  };
}
