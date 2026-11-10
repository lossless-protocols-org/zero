import {createMMKV} from 'react-native-mmkv';

/**
 * Key-value preferences and flags (MMKV). This file was called
 * asyncStorageService for historical reasons — nothing here is async or
 * AsyncStorage; the Promise-returning methods exist only for callers written
 * against that older API.
 *
 * Holds: isOnboarded, theme, locale override, week start, swipe-actions
 * preference, swipe-tutorial flags, the error log and migration bookkeeping.
 * Installs from before 2.7.1 may also hold an orphaned `persist:root` entry
 * from redux-persist (removed in S4); nothing reads it. Financial data lives
 * in SQLite (WatermelonDB), never here.
 *
 * There is deliberately no clear-all: the one MMKV instance mixes user
 * preferences with migration state and the crash log, so wiping it wholesale
 * would also forget that a migration failed and lose the evidence of why.
 * What "Delete all data" removes and keeps is listed in storageInventory.ts.
 */
const storage = createMMKV({
  id: 'zero-app-storage',
});

export const StorageService = {
  async setItem(key: string, value: string): Promise<void> {
    storage.set(key, value);
  },

  async getItem(key: string): Promise<string | null> {
    return storage.getString(key) ?? null;
  },

  async removeItem(key: string): Promise<void> {
    storage.remove(key);
  },

  setItemSync(key: string, value: string): void {
    storage.set(key, value);
  },

  getItemSync(key: string): string | null {
    return storage.getString(key) ?? null;
  },

  removeItemSync(key: string): void {
    storage.remove(key);
  },

  getBoolean(key: string): boolean {
    return storage.getBoolean(key) ?? false;
  },

  setBoolean(key: string, value: boolean): void {
    storage.set(key, value);
  },

  getNumber(key: string): number | null {
    return storage.getNumber(key) ?? null;
  },

  setNumber(key: string, value: number): void {
    storage.set(key, value);
  },

  contains(key: string): boolean {
    return storage.contains(key);
  },

  getAllKeys(): string[] {
    return storage.getAllKeys();
  },
};
