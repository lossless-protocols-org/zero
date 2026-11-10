/**
 * L1 (v2.7.1): after a delete, TransactionList refetches the month it shows.
 * The Everyday screen only knows its day, and used to fall back to
 * `fetchExpenses()` — the whole expenses table into Redux (at 10k rows a
 * multi-MB transient plus a full sort), which Home then threw away on focus.
 * Now the month is derived from the day, and the whole-table thunk and
 * services are gone. LokiJS harness as in importService.test.ts.
 *
 * Tickets: M10, audit 2026-11-08 §3.2.
 */
import type {ExportData} from '../../../../src/data/backup/export/format';
import {importAllData} from '../../../../src/data/services/importService';
import {store} from '../../../../src/store/store';
import {fetchUserData} from '../../../../src/store/slices/userIdSlice';
import * as expenseSlice from '../../../../src/store/slices/expenseDataSlice';
import * as services from '../../../harness/services';
import * as errorLog from '../../../../src/platform/errorLog';
import * as expenseService from '../../../../src/data/services/expenseService';

const backup = (): ExportData => ({
  users: [{username: 'Ada', email: ''}],
  categories: [{name: 'Fuel', kind: 'expense', categoryStatus: true, icon: 'car', color: '#111111'}],
  expenses: [
    {title: 'Oct 5 a', amount: 1, description: '', category: {name: 'Fuel'}, date: '2026-10-05T09:00:00'},
    {title: 'Oct 5 b', amount: 2, description: '', category: {name: 'Fuel'}, date: '2026-10-05T18:00:00'},
    {title: 'Oct 20', amount: 4, description: '', category: {name: 'Fuel'}, date: '2026-10-20T12:00:00'},
    {title: 'Sep 30', amount: 8, description: '', category: {name: 'Fuel'}, date: '2026-09-30T23:59:59'},
    {title: 'Nov 1', amount: 16, description: '', category: {name: 'Fuel'}, date: '2026-11-01T00:00:00'},
  ],
  currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
  debtors: [],
  debts: [],
  budgets: [],
  accounts: [],
  incomes: [],
});

const titles = (rows: ReadonlyArray<{title: string}>): string[] => rows.map(r => r.title).sort();

describe('expense refetch scope', () => {
  beforeAll(async () => {
    await importAllData(backup());
    await store.dispatch(fetchUserData());
  });

  it('a day-scoped list refetches only that day’s month, plus the day itself', async () => {
    await expenseSlice.refetchExpenses(store.dispatch, {targetDate: '2026-10-05'});
    const state = store.getState();
    expect(titles(expenseSlice.selectExpenseData(state, '2026-10'))).toEqual(['Oct 20', 'Oct 5 a', 'Oct 5 b']);
    expect(titles(expenseSlice.selectFilteredPeriod(state, {kind: 'day', date: '2026-10-05'}).expenses)).toEqual([
      'Oct 5 a',
      'Oct 5 b',
    ]);
  });

  it('a month-scoped list refetches that month after the row set changed', async () => {
    await expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '2026-10'});
    const oct20 = expenseSlice.selectExpenseData(store.getState(), '2026-10').find(e => e.title === 'Oct 20');
    expect(oct20).toBeDefined();
    await services.deleteExpenseById(String(oct20?.id));
    // Same month again: nothing may skip the query, or the deleted row stays on screen.
    await expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '2026-10'});
    expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-10'))).toEqual(['Oct 5 a', 'Oct 5 b']);
    await expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '2026-09'});
    expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-09'))).toEqual(['Sep 30']);
  });

  it("treats '' (a missing route param) as absent and refuses an empty scope", async () => {
    await expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '', targetDate: '2026-11-01'});
    expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-11'))).toEqual(['Nov 1']);
    await expect(expenseSlice.refetchExpenses(store.dispatch, {targetMonth: ''})).rejects.toThrow(
      'needs a month or a date',
    );
    await expect(expenseSlice.refetchExpenses(store.dispatch, {targetDate: ''})).rejects.toThrow(
      'needs a month or a date',
    );
  });

  it('records a failed month fetch in the error log instead of dropping it', async () => {
    const logSpy = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    const querySpy = jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('disk gone'));
    await expect(expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '2026-10'})).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('disk gone');
    querySpy.mockRestore();
    logSpy.mockRestore();
  });

  it('a plain month fetch always queries; there is no cache to invalidate', async () => {
    expect('invalidateExpenseCache' in expenseSlice).toBe(false);
    expect('cachedYearMonth' in store.getState().expense).toBe(false);
    const querySpy = jest.spyOn(expenseService, 'getAllExpensesByMonth');
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-10'));
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-10'));
    expect(querySpy).toHaveBeenCalledTimes(2);
    querySpy.mockRestore();
  });

  it('a slow month that lands last fills its own month and leaves the shown one alone', async () => {
    const real = expenseService.getAllExpensesByMonth;
    let releaseSeptember: () => void = () => undefined;
    const septemberGate = new Promise<void>(resolve => {
      releaseSeptember = resolve;
    });
    const querySpy = jest
      .spyOn(expenseService, 'getAllExpensesByMonth')
      .mockImplementation(async (userId, yearMonth) => {
        const rows = await real(userId, yearMonth);
        if (yearMonth === '2026-09') {
          await septemberGate;
        }
        return rows;
      });
    const september = store.dispatch(expenseSlice.fetchExpensesByMonth('2026-09'));
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    releaseSeptember();
    await september;
    expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-11'))).toEqual(['Nov 1']);
    expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-09'))).toEqual(['Sep 30']);
    querySpy.mockRestore();
  });

  it('within one month the newest request wins, even when an older one resolves last', async () => {
    const real = expenseService.getAllExpensesByMonth;
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const querySpy = jest
      .spyOn(expenseService, 'getAllExpensesByMonth')
      .mockImplementation(async (userId, yearMonth) => {
        calls++;
        if (calls === 1) {
          await firstGate;
          return []; // the older answer, stale by the time it lands
        }
        return real(userId, yearMonth);
      });
    const older = store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    releaseFirst();
    await older;
    expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-11'))).toEqual(['Nov 1']);
    querySpy.mockRestore();
  });

  it('fetching another month (widget queue, quick add) never changes the month on screen', async () => {
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    const shown = expenseSlice.selectExpenseData(store.getState(), '2026-11');
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-09'));
    expect(expenseSlice.selectExpenseData(store.getState(), '2026-11')).toBe(shown);
    expect(expenseSlice.selectMonthTotals(store.getState(), '2026-11', '2026-11-01').count).toBe(1);
  });

  it('a failed fetch empties that month instead of keeping stale rows, and touches no other month', async () => {
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-10'));
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-11'))).toEqual(['Nov 1']);
    const querySpy = jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('disk gone'));
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-10'));
    expect(expenseSlice.selectExpenseData(store.getState(), '2026-10')).toEqual([]);
    expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-11'))).toEqual(['Nov 1']);
    querySpy.mockRestore();
  });
});
