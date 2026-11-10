/**
 * Per-month slots (audit 2026-11-08 §3.2): Home (shared month) and the Money
 * tab (its own month) read money in at the same time, and the widget queue or
 * the quick-add sheet can fetch any month. None of them may change another's.
 */
import {beginMonth, emptyMonthCache, MAX_CACHED_MONTHS, settleMonth} from '../../../src/store/monthCache';
import {
  incomeReducer,
  fetchIncomesByMonth,
  selectIncomes,
  selectReceived,
} from '../../../src/store/slices/incomeDataSlice';
import type {RootState} from '../../../src/store/rootReducer';
import type {IncomeData} from '../../../src/domain/types';

const income = (id: string, amount: number, date: string): IncomeData => ({
  id,
  userId: 'u',
  amount,
  date: date as IncomeData['date'], // fixture days are valid YYYY-MM-DD
  note: '',
  categoryId: 'income',
  accountId: 'acct',
  createdAt: 0,
  updatedAt: 0,
});

describe('monthCache', () => {
  it('keeps the newest request per month and ignores an older one that lands later', () => {
    const cache = emptyMonthCache<number>();
    beginMonth(cache, '2026-11', 'r1', 0);
    beginMonth(cache, '2026-11', 'r2', 0);
    settleMonth(cache, '2026-11', 'r2', 2);
    settleMonth(cache, '2026-11', 'r1', 1);
    expect(cache.months['2026-11']?.data).toBe(2);
  });

  it('settles each month into its own slot', () => {
    const cache = emptyMonthCache<string>();
    beginMonth(cache, '2026-11', 'a', '');
    beginMonth(cache, '2026-09', 'b', '');
    settleMonth(cache, '2026-09', 'b', 'september');
    settleMonth(cache, '2026-11', 'a', 'november');
    expect(cache.months['2026-11']?.data).toBe('november');
    expect(cache.months['2026-09']?.data).toBe('september');
  });

  it(`drops the least recently fetched month beyond ${MAX_CACHED_MONTHS}`, () => {
    const cache = emptyMonthCache<number>();
    for (let m = 1; m <= MAX_CACHED_MONTHS; m++) {
      beginMonth(cache, `2026-0${m}`, `r${m}`, m);
    }
    beginMonth(cache, '2026-01', 'again', 1); // January is fetched again: now the most recent
    beginMonth(cache, '2026-09', 'r9', 9);
    expect(Object.keys(cache.months).sort()).toEqual([
      '2026-01',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-09',
    ]);
  });
});

describe('money in by month', () => {
  const asRoot = (state: ReturnType<typeof incomeReducer>) => ({income: state}) as unknown as RootState; // the selectors read only `income`

  it('Home on November and Money on October both keep their own rows', () => {
    let state = incomeReducer(undefined, {type: 'init'});
    state = incomeReducer(state, fetchIncomesByMonth.pending('h', '2026-11'));
    state = incomeReducer(state, fetchIncomesByMonth.fulfilled([income('n', 2500, '2026-11-08')], 'h', '2026-11'));
    state = incomeReducer(state, fetchIncomesByMonth.pending('m', '2026-10'));
    state = incomeReducer(state, fetchIncomesByMonth.fulfilled([income('o', 50000, '2026-10-07')], 'm', '2026-10'));
    expect(selectReceived(asRoot(state), '2026-11')).toBe(2500);
    expect(selectReceived(asRoot(state), '2026-10')).toBe(50000);
    expect(selectIncomes(asRoot(state), '2026-08')).toEqual([]);
  });

  it('a failed fetch empties only its month', () => {
    let state = incomeReducer(undefined, {type: 'init'});
    state = incomeReducer(state, fetchIncomesByMonth.pending('a', '2026-11'));
    state = incomeReducer(state, fetchIncomesByMonth.fulfilled([income('n', 1, '2026-11-01')], 'a', '2026-11'));
    state = incomeReducer(state, fetchIncomesByMonth.pending('b', '2026-10'));
    state = incomeReducer(state, fetchIncomesByMonth.rejected(new Error('disk'), 'b', '2026-10'));
    expect(selectIncomes(asRoot(state), '2026-10')).toEqual([]);
    expect(selectReceived(asRoot(state), '2026-11')).toBe(1);
  });
});
