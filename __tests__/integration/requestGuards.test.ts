/**
 * The day list, the category list and the debts keep only their newest
 * request's answer: switching days, categories or people quickly cannot let
 * an older, slower read land last and fill the screen with the wrong rows
 * (audit 2026-11-08 §3.11).
 */
import {rootReducer, type RootState} from '../../src/store/rootReducer';
import {
  fetchEverydayExpenses,
  fetchExpensesByCategory,
  selectFilteredPeriod,
  type ListFilter,
} from '../../src/store/slices/expenseDataSlice';
import {fetchAllDebts, fetchDebtsByDebtor, selectAllDebts, selectDebtsOf} from '../../src/store/slices/debtDataSlice';
import {fetchDebtors, selectDebtorData} from '../../src/store/slices/debtorDataSlice';
import {fetchIndividualDebtor, selectIndividualDebtorData} from '../../src/store/slices/individualDebtorDataSlice';
import {fetchCategories, selectCategoryData} from '../../src/store/slices/categoryDataSlice';
import type {CategoryData, DebtorData, ExpenseWithCategory, DebtData} from '../../src/domain/types';

type Action = Parameters<typeof rootReducer>[1];
const run = (...actions: Action[]): RootState =>
  actions.reduce<RootState>(rootReducer, rootReducer(undefined, {type: '@@INIT'}));

// Only the id is read by these assertions; the rest of the row is irrelevant here.
const expense = (id: string) => ({id}) as unknown as ExpenseWithCategory;
const debt = (id: string, debtorId: string) => ({id, debtorId}) as unknown as DebtData;
const period = (...ids: string[]) => ({expenses: ids.map(expense), refunds: [], refundedByExpense: {}});
const ids = (rows: ReadonlyArray<{id: string}>) => rows.map(r => r.id);
/** The rows a screen asking for `filter` gets. */
const shown = (state: RootState, filter: ListFilter) => ids(selectFilteredPeriod(state, filter).expenses);
const day = (date: string): ListFilter => ({kind: 'day', date});
const food = (yearMonth: string): ListFilter => ({kind: 'category', categoryId: 'food', yearMonth});

describe('day and category lists', () => {
  it('an older day landing after a newer one is dropped', () => {
    const state = run(
      fetchEverydayExpenses.pending('old', '2026-11-01'),
      fetchEverydayExpenses.pending('new', '2026-11-02'),
      fetchEverydayExpenses.fulfilled(period('nov2'), 'new', '2026-11-02'),
      fetchEverydayExpenses.fulfilled(period('nov1'), 'old', '2026-11-01'),
    );
    expect(shown(state, day('2026-11-02'))).toEqual(['nov2']);
    expect(shown(state, day('2026-11-01'))).toEqual([]);
  });

  it('a day request superseded by a category request does not overwrite it', () => {
    const state = run(
      fetchEverydayExpenses.pending('day', '2026-11-01'),
      fetchExpensesByCategory.pending('cat', {categoryId: 'food', yearMonth: '2026-11'}),
      fetchExpensesByCategory.fulfilled(period('f1'), 'cat', {categoryId: 'food', yearMonth: '2026-11'}),
      fetchEverydayExpenses.fulfilled(period('d1'), 'day', '2026-11-01'),
    );
    expect(shown(state, food('2026-11'))).toEqual(['f1']);
    expect(shown(state, day('2026-11-01'))).toEqual([]);
  });

  it('a failed newest request shows an empty list for its own filter, never the previous rows', () => {
    const state = run(
      fetchEverydayExpenses.pending('a', '2026-11-01'),
      fetchEverydayExpenses.fulfilled(period('nov1'), 'a', '2026-11-01'),
      fetchEverydayExpenses.pending('b', '2026-11-02'),
      fetchEverydayExpenses.rejected(null, 'b', '2026-11-02', 'database is locked'),
    );
    expect(shown(state, day('2026-11-02'))).toEqual([]);
    expect(shown(state, day('2026-11-01'))).toEqual([]);
  });

  it('a failed older request leaves the newer answer alone', () => {
    const state = run(
      fetchExpensesByCategory.pending('old', {categoryId: 'food', yearMonth: '2026-10'}),
      fetchExpensesByCategory.pending('new', {categoryId: 'food', yearMonth: '2026-11'}),
      fetchExpensesByCategory.fulfilled(period('f'), 'new', {categoryId: 'food', yearMonth: '2026-11'}),
      fetchExpensesByCategory.rejected(null, 'old', {categoryId: 'food', yearMonth: '2026-10'}),
    );
    expect(shown(state, food('2026-11'))).toEqual(['f']);
  });

  it('the same day asked for by a category screen shows nothing (the filter is typed, not a string)', () => {
    const state = run(
      fetchEverydayExpenses.pending('d', '2026-11-02'),
      fetchEverydayExpenses.fulfilled(period('nov2'), 'd', '2026-11-02'),
    );
    expect(shown(state, {kind: 'category', categoryId: '2026-11-02', yearMonth: ''})).toEqual([]);
  });
});

describe('debts', () => {
  it("one person's slower read cannot replace the next person's debts", () => {
    const state = run(
      fetchDebtsByDebtor.pending('a', 'asha'),
      fetchDebtsByDebtor.pending('b', 'bilal'),
      fetchDebtsByDebtor.fulfilled([debt('d2', 'bilal')], 'b', 'bilal'),
      fetchDebtsByDebtor.fulfilled([debt('d1', 'asha')], 'a', 'asha'),
    );
    expect(ids(selectDebtsOf(state, 'bilal'))).toEqual(['d2']);
    expect(selectDebtsOf(state, 'asha')).toEqual([]);
  });

  it("another person's debts, still loaded, read as none", () => {
    const state = run(
      fetchDebtsByDebtor.pending('a', 'asha'),
      fetchDebtsByDebtor.fulfilled([debt('d1', 'asha')], 'a', 'asha'),
      fetchDebtsByDebtor.pending('b', 'bilal'),
    );
    expect(selectDebtsOf(state, 'bilal')).toEqual([]);
  });

  it('a failed read clears the list for that person', () => {
    const state = run(
      fetchDebtsByDebtor.pending('a', 'asha'),
      fetchDebtsByDebtor.fulfilled([debt('d1', 'asha')], 'a', 'asha'),
      fetchDebtsByDebtor.pending('a2', 'asha'),
      fetchDebtsByDebtor.rejected(null, 'a2', 'asha', 'database is locked'),
    );
    expect(selectDebtsOf(state, 'asha')).toEqual([]);
  });

  it('a refetch of every debt that started earlier cannot land over a later one', () => {
    const state = run(
      fetchAllDebts.pending('before-write', undefined),
      fetchAllDebts.pending('after-write', undefined),
      fetchAllDebts.fulfilled([debt('d1', 'asha'), debt('d2', 'asha')], 'after-write', undefined),
      fetchAllDebts.fulfilled([debt('d1', 'asha')], 'before-write', undefined),
    );
    expect(ids(selectAllDebts(state))).toEqual(['d1', 'd2']);
  });
});

/**
 * Appendix A: the debtor list, all debts, a person's header and the
 * categories had no `rejected` handling and no guard, so a failed read left
 * the previous figures under the "couldn't load" banner, and overlapping
 * reads (focus and the session follower, since the one refresh model) could
 * land out of order. Screen data clears on failure; the categories keep
 * their last read (every form needs them, and they are not a figure).
 */
describe('debtors, all debts, a person and the categories', () => {
  const debtor = (id: string) => ({id, title: id}) as unknown as DebtorData; // only id and title are read
  const category = (id: string) => ({id, name: id, categoryStatus: true}) as unknown as CategoryData; // as above

  it('a failed debtor read clears the list; an older read landing late is dropped', () => {
    const loaded = run(fetchDebtors.pending('r1'), fetchDebtors.fulfilled([debtor('ravi')], 'r1'));
    expect(ids(selectDebtorData(loaded))).toEqual(['ravi']);
    const failed = [fetchDebtors.pending('r2'), fetchDebtors.rejected(null, 'r2')].reduce(rootReducer, loaded);
    expect(selectDebtorData(failed)).toEqual([]);
    const late = run(
      fetchDebtors.pending('old'),
      fetchDebtors.pending('new'),
      fetchDebtors.fulfilled([debtor('new')], 'new'),
      fetchDebtors.fulfilled([debtor('old')], 'old'),
    );
    expect(ids(selectDebtorData(late))).toEqual(['new']);
  });

  it('a failed read of all debts clears the total', () => {
    const state = run(
      fetchAllDebts.pending('r1'),
      fetchAllDebts.fulfilled([debt('d1', 'ravi')], 'r1'),
      fetchAllDebts.pending('r2'),
      fetchAllDebts.rejected(null, 'r2'),
    );
    expect(selectAllDebts(state)).toEqual([]);
  });

  it("a failed person read shows no header, never another person's", () => {
    const state = run(
      fetchIndividualDebtor.pending('r1', 'ravi'),
      fetchIndividualDebtor.fulfilled(debtor('ravi'), 'r1', 'ravi'),
      fetchIndividualDebtor.pending('r2', 'asha'),
      fetchIndividualDebtor.rejected(null, 'r2', 'asha'),
    );
    expect(selectIndividualDebtorData(state)).toBeNull();
  });

  it('a failed category read keeps the categories last read; an older read landing late is dropped', () => {
    const loaded = run(
      fetchCategories.pending('r1'),
      fetchCategories.fulfilled({expense: [category('food')], income: []}, 'r1'),
    );
    const failed = run(
      fetchCategories.pending('r1'),
      fetchCategories.fulfilled({expense: [category('food')], income: []}, 'r1'),
      fetchCategories.pending('r2'),
      fetchCategories.rejected(null, 'r2'),
    );
    expect(ids(selectCategoryData(failed))).toEqual(ids(selectCategoryData(loaded)));
    const late = run(
      fetchCategories.pending('old'),
      fetchCategories.pending('new'),
      fetchCategories.fulfilled({expense: [category('new')], income: []}, 'new'),
      fetchCategories.fulfilled({expense: [category('old')], income: []}, 'old'),
    );
    expect(ids(selectCategoryData(late))).toEqual(['new']);
  });
});
