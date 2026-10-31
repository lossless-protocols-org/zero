/**
 * L1 (v2.7.1): after a delete, TransactionList refetches the month it shows.
 * The Everyday screen only knows its day, and used to fall back to
 * `fetchExpenses()` — the whole expenses table into Redux (at 10k rows a
 * multi-MB transient plus a full sort), which Home then threw away on focus.
 * Now the month is derived from the day, and the whole-table thunk and
 * services are gone. LokiJS harness as in importService.test.ts.
 */
import type {ExportData} from '../src/backend/export/format';

jest.mock('../src/watermelondb/database', () =>
  require('../src/testing/lokiDatabase').lokiDatabaseModule('expenseRefetchTest'),
);

const {importAllData} =
  require('../src/watermelondb/services/importService') as typeof import('../src/watermelondb/services/importService');
const store = (require('../src/redux/store') as typeof import('../src/redux/store')).default;
const {fetchUserData} = require('../src/redux/slice/userIdSlice') as typeof import('../src/redux/slice/userIdSlice');
const expenseSlice =
  require('../src/redux/slice/expenseDataSlice') as typeof import('../src/redux/slice/expenseDataSlice');
const services = require('../src/watermelondb/services') as typeof import('../src/watermelondb/services');

const fs = require('fs');
const path = require('path');
declare const __dirname: string;

const backup = (): ExportData => ({
  users: [{username: 'Ada', email: ''}],
  categories: [{name: 'Fuel', categoryStatus: true, icon: 'car', color: '#111111'}],
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
});

const titles = (rows: ReadonlyArray<{title: string}>): string[] => rows.map(r => r.title).sort();

/** Every TS/TSX file under src, for the static "zero importers" checks. */
const listSources = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listSources(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

describe('expense refetch scope (L1)', () => {
  beforeAll(async () => {
    await importAllData(backup());
    await store.dispatch(fetchUserData());
  });

  it('a day-scoped list refetches only that day’s month, plus the day itself', async () => {
    await expenseSlice.refetchExpenses(store.dispatch, {targetDate: '2026-10-05'});
    const state = store.getState();
    expect(titles(expenseSlice.selectExpenseData(state))).toEqual(['Oct 20', 'Oct 5 a', 'Oct 5 b']);
    expect(titles(expenseSlice.selectFilteredExpenses(state))).toEqual(['Oct 5 a', 'Oct 5 b']);
  });

  it('a month-scoped list refetches that month after the row set changed', async () => {
    await expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '2026-10'});
    const oct20 = expenseSlice.selectExpenseData(store.getState()).find(e => e.title === 'Oct 20');
    expect(oct20).toBeDefined();
    await services.deleteExpenseById(String(oct20?.id));
    // Same month again: nothing may skip the query, or the deleted row stays on screen.
    await expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '2026-10'});
    expect(titles(expenseSlice.selectExpenseData(store.getState()))).toEqual(['Oct 5 a', 'Oct 5 b']);
    await expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '2026-09'});
    expect(titles(expenseSlice.selectExpenseData(store.getState()))).toEqual(['Sep 30']);
  });

  it("treats '' (a missing route param) as absent and refuses an empty scope", async () => {
    await expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '', targetDate: '2026-11-01'});
    expect(titles(expenseSlice.selectExpenseData(store.getState()))).toEqual(['Nov 1']);
    await expect(expenseSlice.refetchExpenses(store.dispatch, {targetMonth: ''})).rejects.toThrow(
      'needs a month or a date',
    );
    await expect(expenseSlice.refetchExpenses(store.dispatch, {targetDate: ''})).rejects.toThrow(
      'needs a month or a date',
    );
  });

  it('records a failed month fetch in the error log instead of dropping it', async () => {
    const errorLog = require('../src/utils/errorLog') as typeof import('../src/utils/errorLog');
    const logSpy = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    // services/index.ts re-exports through getters, so spy on the defining module;
    // the cast names the module's own type
    const expenseService =
      require('../src/watermelondb/services/expenseService') as typeof import('../src/watermelondb/services/expenseService');
    const querySpy = jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('disk gone'));
    await expect(expenseSlice.refetchExpenses(store.dispatch, {targetMonth: '2026-10'})).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('disk gone');
    querySpy.mockRestore();
    logSpy.mockRestore();
  });

  it('M10: a plain month fetch always queries; there is no cache to invalidate', async () => {
    expect('invalidateExpenseCache' in expenseSlice).toBe(false);
    expect('cachedYearMonth' in store.getState().expense).toBe(false);
    // the cast names the module's own type
    const expenseService =
      require('../src/watermelondb/services/expenseService') as typeof import('../src/watermelondb/services/expenseService');
    const querySpy = jest.spyOn(expenseService, 'getAllExpensesByMonth');
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-10'));
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-10'));
    expect(querySpy).toHaveBeenCalledTimes(2);
    querySpy.mockRestore();
  });

  it('M10: an older month response that lands last does not overwrite the newer month', async () => {
    // the cast names the module's own type
    const expenseService =
      require('../src/watermelondb/services/expenseService') as typeof import('../src/watermelondb/services/expenseService');
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
    expect(titles(expenseSlice.selectExpenseData(store.getState()))).toEqual(['Nov 1']);
    querySpy.mockRestore();
  });

  it('M10: a failed fetch of the newest month clears the old month instead of showing it under the new label', async () => {
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    expect(titles(expenseSlice.selectExpenseData(store.getState()))).toEqual(['Nov 1']);
    // services/index.ts re-exports through getters, so spy on the defining module;
    // the cast names the module's own type
    const expenseService =
      require('../src/watermelondb/services/expenseService') as typeof import('../src/watermelondb/services/expenseService');
    const querySpy = jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('disk gone'));
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-10'));
    expect(expenseSlice.selectExpenseData(store.getState())).toEqual([]);
    querySpy.mockRestore();
  });

  it('the whole-table thunk and services no longer exist', () => {
    expect('fetchExpenses' in expenseSlice).toBe(false);
    expect('getAllExpensesByUserId' in services).toBe(false);
    expect('getAllExpensesByUserIdWithCategory' in services).toBe(false);
  });

  it('nothing in src/ or App.tsx imports them', () => {
    const root = path.resolve(__dirname, '..');
    const files = [...listSources(path.join(root, 'src')), path.join(root, 'App.tsx')];
    const offenders = files.filter(f =>
      /\b(fetchExpenses|getAllExpensesByUserId|getAllExpensesByUserIdWithCategory)\b/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders.map((f: string) => path.relative(root, f))).toEqual([]);
  });
});
