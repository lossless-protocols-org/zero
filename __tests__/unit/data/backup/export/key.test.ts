import {
  EXPORT_KEY_LENGTH,
  EXPORT_KEY_PREFIX,
  generateUniqueKey,
  isValidExportKey,
} from '../../../../../src/data/backup/export/key';

/**
 * These tests exist because `isValidExportKey` once required
 * /^[a-zA-Z0-9]+$/ on the key body while `generateUniqueKey` produced it with
 * nanoid, whose alphabet includes `_` and `-`. Roughly 39% of every backup the
 * app wrote was therefore rejected by its own importer — silently, and only
 * ever at restore time.
 *
 * The generator/validator round-trip below is the guard: it must be run with
 * enough samples that a `_`/`-` is a near-certainty, so the pair can never
 * drift apart again.
 */
describe('export key', () => {
  it('accepts every key the generator can produce', () => {
    for (let i = 0; i < 2000; i++) {
      const key = generateUniqueKey();
      expect(isValidExportKey(key)).toBe(true);
    }
  });

  it('actually exercises the URL-safe characters that caused the bug', () => {
    const keys = Array.from({length: 2000}, () => generateUniqueKey());
    const withUrlSafeChars = keys.filter(key => /[_-]/.test(key));
    // ~39% expected; assert a floor far below that so the test is not flaky.
    expect(withUrlSafeChars.length).toBeGreaterThan(100);
    for (const key of withUrlSafeChars) {
      expect(isValidExportKey(key)).toBe(true);
    }
  });

  it('accepts historical keys containing underscore and hyphen', () => {
    expect(isValidExportKey('zeroEvUAhADchrVDkz-C')).toBe(true);
    expect(isValidExportKey('zerovHginwtdcKEuF_De')).toBe(true);
    expect(isValidExportKey('zero_-_-_-_-_-_-_-_-')).toBe(true);
  });

  it('accepts a real exported backup key', () => {
    expect(isValidExportKey('zeroDhp2XTpC9HdttwM9')).toBe(true);
  });

  it('rejects keys that are not ours', () => {
    expect(isValidExportKey(null)).toBe(false);
    expect(isValidExportKey(undefined)).toBe(false);
    expect(isValidExportKey('')).toBe(false);
    expect(isValidExportKey('nope1234567890123456')).toBe(false);
    expect(isValidExportKey('zeroTOOSHORT')).toBe(false);
    expect(isValidExportKey('zeroWAYTOOLONG012345678')).toBe(false);
    expect(isValidExportKey('zero!!!!!!!!!!!!!!!!')).toBe(false);
  });

  it('keeps the generator matching the declared shape', () => {
    const key = generateUniqueKey();
    expect(key).toHaveLength(EXPORT_KEY_LENGTH);
    expect(key.startsWith(EXPORT_KEY_PREFIX)).toBe(true);
  });
});
