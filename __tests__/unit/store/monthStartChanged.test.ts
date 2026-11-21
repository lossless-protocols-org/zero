/**
 * The store when months start on the user's day (plan P11): a month key
 * covers the days from that day, a date refetches the month it belongs to,
 * "this month" is the one today is in, and when the day that applies changes
 * (a new day, or Pro ending) every loaded month is dropped, never shown
 * under boundaries it was not read for. Real LokiJS database and store.
 */
import type {ExportData} from '../../../src/data/backup/export/format';
import {importAllData} from '../../../src/data/services/importService';
import {setMonthStartDay} from '../../../src/data/services/userService';
import {store} from '../../../src/store/store';
import {fetchUserData} from '../../../src/store/slices/userIdSlice';
import * as expenseSlice from '../../../src/store/slices/expenseDataSlice';
import {fetchIncomesByMonth, selectIncomes} from '../../../src/store/slices/incomeDataSlice';
import {
  followToday,
  monthSelectionReducer,
  selectMonthIndex,
  selectYear,
  setMonthSelection,
} from '../../../src/store/slices/monthSelectionSlice';
import {monthStartChanged} from '../../../src/store/monthStartChanged';
import {followSession} from '../../../src/store/followSession';
import {startSession} from '../../../src/store/startSession';
import {getMonthStartDay, setStoredMonthStartDay} from '../../../src/pro/monthStart';
import {periodKeyOf} from '../../../src/domain/period';
import {setEntitlement} from '../../harness/mocks/entitlement';

jest.mock('../../../src/pro/entitlementStore', () => require('../../harness/mocks/entitlement').entitlementStoreMock());

const backup = (): ExportData => ({
  users: [{username: 'Ada', email: '', monthStartDay: 7}],
  categories: [
    {name: 'Fuel', kind: 'expense', categoryStatus: true, icon: 'car', color: '#111111'},
    {name: 'Income', kind: 'income', categoryStatus: true, icon: 'coins', color: '#222222'},
  ],
  expenses: [
    {title: 'Nov 3', amount: 1, description: '', category: {name: 'Fuel'}, date: '2026-11-03T09:00:00'},
    {title: 'Nov 6', amount: 2, description: '', category: {name: 'Fuel'}, date: '2026-11-06T23:59:59'},
    {title: 'Nov 7', amount: 4, description: '', category: {name: 'Fuel'}, date: '2026-11-07T00:00:00'},
    {title: 'Dec 6', amount: 8, description: '', category: {name: 'Fuel'}, date: '2026-12-06T12:00:00'},
    {title: 'Dec 7', amount: 16, description: '', category: {name: 'Fuel'}, date: '2026-12-07T12:00:00'},
  ],
  currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
  debtors: [],
  debts: [],
  budgets: [],
  accounts: [],
  incomes: [{amount: 50_000, date: '2026-12-01', category: {name: 'Income'}, note: 'Salary'}],
  transfers: [],
  checkpoints: [],
  recurring: [],
});

const titles = (rows: ReadonlyArray<{title: string}>): string[] => rows.map(r => r.title).sort();
const november = () => titles(expenseSlice.selectExpenseData(store.getState(), '2026-11'));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

let userId = '';
beforeAll(async () => {
  ({userId} = await importAllData(backup()));
  setEntitlement({state: 'lifetime'});
  await store.dispatch(fetchUserData());
});

it('the session reads the user’s day from their row (kept by the restore)', () => {
  expect(getMonthStartDay()).toBe(7);
});

it('a month key covers the days from the start day to the day before the next', async () => {
  await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
  await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-10'));
  await store.dispatch(fetchIncomesByMonth('2026-11'));
  expect(november()).toEqual(['Dec 6', 'Nov 7']);
  expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-10'))).toEqual(['Nov 3', 'Nov 6']);
  // Salary on 1 December is November's money in (7 Nov to 6 Dec).
  expect(selectIncomes(store.getState(), '2026-11')).toHaveLength(1);
});

it('a date refetches the month it belongs to, not its calendar month', async () => {
  await store.dispatch(monthStartChanged());
  await expenseSlice.refetchExpenses(store.dispatch, {targetDate: '2026-11-03'});
  expect(store.getState().expense.months['2026-11']).toBeUndefined();
  expect(titles(expenseSlice.selectExpenseData(store.getState(), '2026-10'))).toEqual(['Nov 3', 'Nov 6']);
});

it('"this month" is the month today is in: before the start day, still last month’s', () => {
  const sixth = new Date(2026, 10, 6, 12);
  const seventh = new Date(2026, 10, 7, 0, 0, 1);
  const state = monthSelectionReducer(undefined, monthStartChanged(sixth));
  expect(state).toEqual({monthIndex: 9, year: 2026, followsToday: true});
  expect(monthSelectionReducer(state, followToday(seventh))).toEqual({monthIndex: 10, year: 2026, followsToday: true});
  // Picking the month today is in keeps following; another month does not.
  expect(monthSelectionReducer(state, setMonthSelection({monthIndex: 9, year: 2026}, sixth)).followsToday).toBe(true);
  expect(monthSelectionReducer(state, setMonthSelection({monthIndex: 10, year: 2026}, sixth)).followsToday).toBe(false);
  // 3 January belongs to December of the year before.
  expect(monthSelectionReducer(undefined, monthStartChanged(new Date(2027, 0, 3)))).toMatchObject({
    monthIndex: 11,
    year: 2026,
  });
});

it('a cold start opens on the month today is in, once the user’s day is known', async () => {
  await store.dispatch(startSession());
  const key = `${selectYear(store.getState())}-${String(selectMonthIndex(store.getState()) + 1).padStart(2, '0')}`;
  // The store began on the calendar month; startSession moved it once the user's day was read.
  expect(key).toBe(periodKeyOf(new Date(), 7));
});

describe('when the day that applies changes', () => {
  let stop: () => void = () => undefined;
  beforeAll(() => {
    stop = followSession(store.dispatch);
  });
  afterAll(() => stop());

  it('a new day in Settings: the loaded months are dropped and read again for the new days', async () => {
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    expect(november()).toEqual(['Dec 6', 'Nov 7']);
    await setMonthStartDay(userId, 4);
    await tick();
    await tick();
    expect(getMonthStartDay()).toBe(4);
    // Dropped: nothing is shown under the old boundaries.
    expect(store.getState().expense.months).toEqual({});
    expect(store.getState().income.months).toEqual({});
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    expect(november()).toEqual(['Nov 6', 'Nov 7']);
  });

  it('Pro ends: calendar months again, with the stored day kept', async () => {
    setEntitlement({state: 'expired'});
    expect(getMonthStartDay()).toBe(1);
    expect(store.getState().expense.months).toEqual({});
    await store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    expect(november()).toEqual(['Nov 3', 'Nov 6', 'Nov 7']);
    setEntitlement({state: 'lifetime'});
    expect(getMonthStartDay()).toBe(4);
    expect(store.getState().expense.months).toEqual({});
  });

  it('one day’s list stays (a day is the same day), a category’s month is dropped', async () => {
    await store.dispatch(expenseSlice.fetchEverydayExpenses('2026-11-07'));
    store.dispatch(monthStartChanged());
    expect(store.getState().expense.filtered).toMatchObject({filter: {kind: 'day', date: '2026-11-07'}});
    expect(titles(store.getState().expense.filtered?.period.expenses ?? [])).toEqual(['Nov 7']);
    const [expense] = store.getState().expense.filtered?.period.expenses ?? [];
    await store.dispatch(
      expenseSlice.fetchExpensesByCategory({categoryId: expense?.category?.id ?? '', yearMonth: '2026-11'}),
    );
    expect(store.getState().expense.filtered?.filter.kind).toBe('category');
    store.dispatch(monthStartChanged());
    expect(store.getState().expense.filtered).toBeNull();
  });

  it('a read still running for the old days is dropped when it lands', async () => {
    const slow = store.dispatch(expenseSlice.fetchExpensesByMonth('2026-11'));
    setStoredMonthStartDay(20);
    await slow;
    expect(store.getState().expense.months['2026-11']).toBeUndefined();
  });
});
