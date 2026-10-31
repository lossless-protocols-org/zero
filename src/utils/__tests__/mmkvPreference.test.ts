/**
 * M11 (v2.7.1): one MMKV preference shape — {get, set, use} — instead of a
 * hand-rolled cache, validator and listener set per key. Values already on
 * users' devices must read back unchanged, so each stored form is pinned here.
 */
import StorageService from '../storage';
import {booleanValue, createMmkvPreference, jsonBooleanValue, oneOf, optionalString} from '../mmkvPreference';

let n = 0;
const freshKey = () => `m11-test-${++n}`;

describe('createMmkvPreference', () => {
  it('returns the fallback for a missing or unrecognised value', () => {
    const key = freshKey();
    const pref = createMmkvPreference(key, oneOf(['sunday', 'monday'] as const), 'sunday');
    expect(pref.get()).toBe('sunday');
    StorageService.setItemSync(key, 'friday');
    pref.invalidate();
    expect(pref.get()).toBe('sunday');
  });

  it('persists, caches and notifies subscribers on set', () => {
    const key = freshKey();
    const pref = createMmkvPreference(key, oneOf(['light', 'dark', 'system'] as const), 'system');
    const seen: string[] = [];
    const unsubscribe = pref.subscribe(() => seen.push(pref.get()));
    pref.set('dark');
    expect(StorageService.getItemSync(key)).toBe('dark');
    expect(seen).toEqual(['dark']);
    unsubscribe();
    pref.set('light');
    expect(seen).toEqual(['dark']);
  });

  it('reads storage once, then serves the cached value', () => {
    const key = freshKey();
    StorageService.setItemSync(key, 'monday');
    const pref = createMmkvPreference(key, oneOf(['sunday', 'monday'] as const), 'sunday');
    const spy = jest.spyOn(StorageService, 'getItemSync');
    expect(pref.get()).toBe('monday');
    expect(pref.get()).toBe('monday');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('reads the stored forms already on devices', () => {
    const swipe = freshKey();
    StorageService.setBoolean(swipe, false);
    expect(createMmkvPreference(swipe, booleanValue, true).get()).toBe(false);

    const onboarded = freshKey();
    StorageService.setItemSync(onboarded, JSON.stringify(true));
    expect(createMmkvPreference(onboarded, jsonBooleanValue, false).get()).toBe(true);
    StorageService.setItemSync(onboarded, '{not json');
    const corrupt = createMmkvPreference(onboarded, jsonBooleanValue, false);
    expect(corrupt.get()).toBe(false);
    corrupt.set(true);
    expect(StorageService.getItemSync(onboarded)).toBe('true');
  });

  it('removes the key when an optional string is set to null', () => {
    const key = freshKey();
    const pref = createMmkvPreference(key, optionalString, null);
    pref.set('de-DE');
    expect(StorageService.getItemSync(key)).toBe('de-DE');
    pref.set(null);
    expect(StorageService.contains(key)).toBe(false);
    expect(pref.get()).toBeNull();
  });
});
