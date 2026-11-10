/**
 * Every MMKV key the source defines is classified in storageInventory.ts, and
 * "Delete all data" removes exactly what the inventory says (audit 2026-11-08
 * §3.10). A new key fails the first test until someone decides its fate.
 */
import {StorageService} from '../../../src/platform/storage';
import {CLEARED_PREFIXES, KEPT_KEYS, wipeUserStorage} from '../../../src/platform/storageInventory';
import fs from 'node:fs';
import {fromRoot} from '../../harness/paths';

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

// createMmkvPreference('key' | createMmkvPreference<T>(\n  'key' | FOO_KEY = 'key' | FOO_KEY_PREFIX = 'key'
const KEY_PATTERNS = [/createMmkvPreference(?:<[^>]*>)?\(\s*'([^']+)'/g, /_KEY(?:_PREFIX)?\s*=\s*'([^']+)'/g];

const definedKeys = (): string[] => {
  const keys = new Set<string>();
  for (const file of sourceFiles(fromRoot('src'))) {
    const text = fs.readFileSync(file, 'utf8');
    // Only files that touch MMKV: other `_KEY` constants (map keys, the export key) are not storage.
    if (!/StorageService|createMmkvPreference[<(]/.test(text) || file.endsWith('/platform/mmkvPreference.ts')) {
      continue;
    }
    for (const pattern of KEY_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        keys.add(match[1] as string); // group 1 is in both patterns
      }
    }
  }
  return [...keys].sort();
};

const isCleared = (key: string) => CLEARED_PREFIXES.some(prefix => key.startsWith(prefix));

describe('MMKV inventory', () => {
  it('classifies every key the source defines', () => {
    const keys = definedKeys();
    expect(keys.length).toBeGreaterThan(15); // the scan found the keys at all
    expect(keys.filter(key => !KEPT_KEYS.has(key) && !isCleared(key))).toEqual([]);
  });

  it('lists nothing as kept that the source no longer defines', () => {
    const keys = new Set(definedKeys());
    expect([...KEPT_KEYS].filter(key => !keys.has(key))).toEqual([]);
  });

  it('the wipe removes what came from the data and keeps preferences and Diagnostics', () => {
    for (const key of KEPT_KEYS) {
      StorageService.setItemSync(key, 'x');
    }
    StorageService.setItemSync('available-expense-years:old-user', '[2025,2026]');
    StorageService.setBoolean('swipe_tutorial_seen_home', true);
    StorageService.setItemSync('persist:root', '{}');
    StorageService.setItemSync('some_future_key', 'y');

    expect(wipeUserStorage().sort()).toEqual([
      'available-expense-years:old-user',
      'persist:root',
      'some_future_key',
      'swipe_tutorial_seen_home',
    ]);
    expect(StorageService.getAllKeys().sort()).toEqual([...KEPT_KEYS].sort());
  });
});
