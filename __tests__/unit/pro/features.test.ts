/** What a tier includes is decided in one place: all of Pro, or none of it (3.0). */
import {capsOf, PRO_FEATURES, SHIPPED_PRO_FEATURES} from '../../../src/pro/features';

it('Pro includes every feature, and anything else includes none', () => {
  expect([...capsOf(true)].sort()).toEqual([...PRO_FEATURES].sort());
  expect(capsOf(false).size).toBe(0);
});

it('names each feature once', () => {
  expect(new Set(PRO_FEATURES).size).toBe(PRO_FEATURES.length);
});

it('only a real feature can be listed as shipped, each once', () => {
  expect(SHIPPED_PRO_FEATURES.filter(feature => !PRO_FEATURES.includes(feature))).toEqual([]);
  expect(new Set(SHIPPED_PRO_FEATURES).size).toBe(SHIPPED_PRO_FEATURES.length);
});

it('lists what has shipped, phase by phase, so the upgrade sheet sells nothing that is not built', () => {
  // A phase adds its feature here in the commit that ships its screens. P8: accounts and net worth
  // (one line on the sheet: "Accounts, transfers and net worth"); P9: income categories and
  // recurring entries; P10: automatic encrypted backup; P11: the month start day (and custom ranges); P12: trends and PDF reports. 3.0 does not ship while this is empty.
  expect(SHIPPED_PRO_FEATURES).toEqual([
    'accounts',
    'netWorth',
    'incomeCategories',
    'recurring',
    'cloudBackup',
    'monthStart',
    'trends',
    'reports',
  ]);
});
