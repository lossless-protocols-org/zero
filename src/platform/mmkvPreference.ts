import {StorageService} from './storage';

/**
 * One shape for every MMKV-backed preference (M11, v2.7.1): the value is read
 * once and cached (S5: some are read per list row), `set` is the only writer,
 * and `subscribe` lets `usePreference` (src/hooks) re-render on every change.
 *
 * The stored form differs per key for historical reasons, so each preference
 * names how its value is stored; a missing or unrecognised value reads as the
 * fallback.
 */
interface StoredForm<T> {
  read: (key: string) => T | undefined;
  write: (key: string, value: T) => void;
}

export interface MmkvPreference<T> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
  /** Drops the cache so the next read goes to MMKV. */
  invalidate: () => void;
}

/** A plain string limited to `values`. */
export const oneOf = <T extends string>(values: readonly T[]): StoredForm<T> => ({
  read: key => {
    const raw = StorageService.getItemSync(key);
    return values.find(v => v === raw);
  },
  write: (key, value) => StorageService.setItemSync(key, value),
});

/** MMKV's native boolean. */
export const booleanValue: StoredForm<boolean> = {
  read: key => (StorageService.contains(key) ? StorageService.getBoolean(key) : undefined),
  write: (key, value) => StorageService.setBoolean(key, value),
};

/** A boolean stored as the JSON text "true" / "false". */
export const jsonBooleanValue: StoredForm<boolean> = {
  read: key => {
    const raw = StorageService.getItemSync(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
  },
  write: (key, value) => StorageService.setItemSync(key, JSON.stringify(value)),
};

/** A string, or no key at all for null. */
export const optionalString: StoredForm<string | null> = {
  read: key => StorageService.getItemSync(key) || null,
  write: (key, value) => {
    if (value) {
      StorageService.setItemSync(key, value);
    } else {
      StorageService.removeItemSync(key);
    }
  },
};

/** A whole number ≥ 0, stored as its decimal text. */
export const wholeNumber: StoredForm<number> = {
  read: key => {
    const value = Number.parseInt(StorageService.getItemSync(key) ?? '', 10);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  },
  write: (key, value) => StorageService.setItemSync(key, String(Math.max(0, Math.round(value)))),
};

export const createMmkvPreference = <T>(key: string, form: StoredForm<T>, fallback: T): MmkvPreference<T> => {
  const listeners = new Set<() => void>();
  let cached: {value: T} | undefined;

  const get = (): T => {
    if (!cached) {
      cached = {value: form.read(key) ?? fallback};
    }
    return cached.value;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    get,
    set: value => {
      form.write(key, value);
      cached = {value};
      listeners.forEach(listener => listener());
    },
    subscribe,
    invalidate: () => {
      cached = undefined;
    },
  };
};
