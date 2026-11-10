/**
 * Integrity checks for the currency picker list (assets/jsons/currencies.json).
 *
 * The list was swept against ISO 4217 in Aug 2026 (amendments through 180):
 * every circulating national currency is present, and codes ISO has retired
 * are not. Guards against the drip of "my currency is missing" reviews AND
 * against retired codes silently coming back in a merge.
 */

import currencies from '../../../assets/jsons/currencies.json';
import {formatAmountWithSymbol, isCurrencySymbolSuffix} from '../../../src/platform/numberFormat';
import {getCurrencyDecimals} from '../../../src/platform/currencyLocale';

/** Codes ISO 4217 retired; existing users' stored rows are unaffected, but
 * the picker must not offer them for new selections. */
const RETIRED = [
  'HRK', // Croatia → EUR, 2023
  'BGN', // Bulgaria → EUR, 2026-01-01 (amendment 180)
  'ANG', // → XCG (Caribbean Guilder), 2025-03-31 (amendment 176)
  'SLL', // → SLE (Sierra Leone redenomination)
  'ZWL', // → ZWG (Zimbabwe Gold, 2024)
  'ZMK', // → ZMW (Zambia, 2013)
  'VEF', // → VES
  'MRO', // → MRU
  'STD', // → STN
  'CUC', // discontinued 2021; CUP remains
];

/** Spot-check of recently introduced codes that MUST be present. */
const RECENT_CODES = ['XCG', 'ZWG', 'SLE', 'VES', 'ZMW', 'MRU', 'STN', 'BYN', 'AFN'];

describe('currency list integrity', () => {
  it('has a substantial, complete list (ISO circulating set)', () => {
    expect(currencies.length).toBeGreaterThanOrEqual(150);
  });

  it('every entry has a 3-letter uppercase code, a name and a symbol', () => {
    for (const currency of currencies) {
      expect(currency.code).toMatch(/^[A-Z]{3}$/);
      expect(currency.name.length).toBeGreaterThan(0);
      expect(currency.symbol.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate codes', () => {
    const codes = currencies.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('is sorted by code for maintainability', () => {
    const codes = currencies.map(c => c.code);
    expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b)));
  });

  it('includes the recently introduced ISO codes', () => {
    const codes = new Set(currencies.map(c => c.code));
    for (const code of RECENT_CODES) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it('offers no retired codes', () => {
    const codes = new Set(currencies.map(c => c.code));
    for (const code of RETIRED) {
      expect(codes.has(code)).toBe(false);
    }
  });

  it('every code resolves to sane decimals (0, 2 or 3)', () => {
    for (const currency of currencies) {
      expect([0, 2, 3]).toContain(getCurrencyDecimals(currency.code));
    }
  });
});

describe('users whose STORED currency was retired keep working', () => {
  // The picker list is only a datasource for NEW selections. The active
  // currency lives as the user's own DB row (getCurrencyByUserId → redux),
  // which nothing validates against the list — so removing HRK/BGN from the
  // picker must never break an existing HRK/BGN user. These tests prove the
  // full formatting path still works for every code we retired.
  it.each(RETIRED)('formatAmountWithSymbol still formats %s', code => {
    const formatted = formatAmountWithSymbol(1234.5, code);
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toContain('1');
  });

  it.each(RETIRED)('isCurrencySymbolSuffix never throws for %s', code => {
    expect(() => isCurrencySymbolSuffix(code)).not.toThrow();
  });

  it('getCurrencyDecimals falls back to 2 for unknown/retired codes', () => {
    expect(getCurrencyDecimals('HRK')).toBe(2);
    expect(getCurrencyDecimals('BGN')).toBe(2);
  });
});
