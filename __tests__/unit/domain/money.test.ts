/**
 * R10 (schema v5): money is added in integers at a fixed 10⁴ scale, and the
 * import derives an entry's timestamp from its date exactly as the v5
 * migration does in SQL (the SQLite side is checked in
 * schemaUpgradePaths.bun.test.ts). Runs under jest and bun.
 */
import {fromMoneyUnits, sumAmounts, toMoneyUnits} from '../../../src/domain/money';
import {epochFromIsoDate} from '../../../src/domain/isoEpoch';

describe('sumAmounts', () => {
  it('adds without binary-float drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumAmounts([{amount: 0.1}, {amount: 0.2}])).toBe(0.3);
    expect(sumAmounts(Array.from({length: 10_000}, () => ({amount: 0.01})))).toBe(100);
  });

  it('is exact for every ISO 4217 exponent (0–3 decimals) and for large monthly totals', () => {
    expect(sumAmounts([{amount: 1.005}, {amount: 2.333}])).toBe(3.338);
    expect(sumAmounts([{amount: 999_999_999.99}, {amount: 0.01}])).toBe(1_000_000_000);
    expect(sumAmounts([])).toBe(0);
  });

  it('round-trips money units', () => {
    expect(toMoneyUnits(12.5)).toBe(125_000);
    expect(fromMoneyUnits(toMoneyUnits(0.3))).toBe(0.3);
  });
});

describe('epochFromIsoDate', () => {
  it('reads a day and a local datetime as UTC, like SQLite strftime', () => {
    expect(epochFromIsoDate('2026-11-07')).toBe(Date.UTC(2026, 10, 7));
    expect(epochFromIsoDate('2026-11-10T18:05:00')).toBe(Date.UTC(2026, 10, 10, 18, 5, 0));
    expect(epochFromIsoDate('2026-11-10T18:05')).toBe(Date.UTC(2026, 10, 10, 18, 5, 0));
  });

  it('returns null for anything that is not a stored date', () => {
    expect(epochFromIsoDate('not a date')).toBeNull();
    expect(epochFromIsoDate('')).toBeNull();
  });
});
