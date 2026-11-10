/**
 * L5 (v2.7.1): `loadAvailableYears` used `cached.length > 1` as its "already
 * known" signal. The current year is always injected into the cached list, so
 * a user whose expenses all fall in the current year had length 1 and
 * re-scanned the whole expenses table on every Home and Reports mount. The
 * signal is now the presence of the cache key.
 */
import {StorageService} from '../../../../src/platform/storage';

const refreshCalls: string[] = [];
jest.mock('../../../../src/data/services/expenseService', () => ({
  getAvailableExpenseYears: async (userId: string) => {
    refreshCalls.push(userId);
    return [new Date().getFullYear()];
  },
}));

import {
  ensureYearInCache,
  getCachedYears,
  loadAvailableYears,
  refreshYearsCache,
} from '../../../../src/data/services/availableYearsCache';
import * as errorLog from '../../../../src/platform/errorLog';

const KEY = 'available-expense-years:u-one-year';

beforeEach(() => {
  refreshCalls.length = 0;
  StorageService.removeItemSync(KEY);
});

describe('loadAvailableYears', () => {
  it('fetches once for an unknown user, then never again for a one-year user', async () => {
    const thisYear = new Date().getFullYear();
    await expect(loadAvailableYears('u-one-year')).resolves.toEqual([thisYear]);
    expect(refreshCalls).toEqual(['u-one-year']);
    await expect(loadAvailableYears('u-one-year')).resolves.toEqual([thisYear]);
    await expect(loadAvailableYears('u-one-year')).resolves.toEqual([thisYear]);
    expect(refreshCalls).toEqual(['u-one-year']);
  });

  it('a corrupt cache value is treated as unknown and refreshed', async () => {
    StorageService.setItemSync(KEY, '{not json');
    await loadAvailableYears('u-one-year');
    expect(refreshCalls).toEqual(['u-one-year']);
    expect(getCachedYears('u-one-year')).toEqual([new Date().getFullYear()]);
  });

  it('ensureYearInCache with no known list does not cement a partial one; it rebuilds from the database', async () => {
    const years = ensureYearInCache('u-one-year', 2019);
    expect(years).toContain(2019);
    expect(years).toContain(new Date().getFullYear());
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    expect(refreshCalls).toEqual(['u-one-year']);
    expect(StorageService.contains(KEY)).toBe(true);
  });

  it('ensureYearInCache with a known list adds the year in place, no database read', async () => {
    await refreshYearsCache('u-one-year');
    refreshCalls.length = 0;
    expect(ensureYearInCache('u-one-year', 2019)).toContain(2019);
    expect(getCachedYears('u-one-year')).toContain(2019);
    expect(refreshCalls).toEqual([]);
  });

  it('an unreadable cache value (wrong shape) is rebuilt and reported', async () => {
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    StorageService.setItemSync(KEY, '"abc"');
    await loadAvailableYears('u-one-year');
    expect(refreshCalls).toEqual(['u-one-year']);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
