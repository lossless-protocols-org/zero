/**
 * Home's and Reports' month (useMonthView over useMonthNavigation): which
 * month, stepping it, and how it stands — spent net of refunds, money in,
 * and the budget — read from the real store over the LokiJS database. The
 * one stand-in is React Navigation's focus effect (no navigator under test),
 * which runs as a plain effect. Before this suite the two hooks behind Home
 * had 1 of 40 and 1 of 35 lines covered (audit 2026-11-08 §7.6).
 */
import {act} from '@testing-library/react-native';
import {store} from '../../../../src/store/store';
import {resetSession} from '../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../src/store/slices/userIdSlice';
import {setMonthSelection} from '../../../../src/store/slices/monthSelectionSlice';
import {createRefund} from '../../../../src/data/services/refundService';
import {createIncome} from '../../../../src/data/services/incomeService';
import {useMonthView} from '../../../../src/ui/hooks/useMonthView';
import {useMonthNavigation} from '../../../../src/ui/hooks/useMonthNavigation';
import * as services from '../../../harness/services';
import {renderHookInApp} from '../../../harness/render';
import {monthStartChanged} from '../../../../src/store/monthStartChanged';
import {setStoredMonthStartDay} from '../../../../src/pro/monthStart';
import {setEntitlement} from '../../../harness/mocks/entitlement';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../harness/mocks/focusEffect'),
}));

// 15 Nov 2026: November is the current month, October the one before.
const NOW = new Date(2026, 10, 15, 12, 0, 0);

beforeAll(async () => {
  jest.useFakeTimers({now: NOW, advanceTimers: true});
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  await services.createExpense(userId, 'Groceries', 3000, '', food, '2026-10-02T10:00:00');
  const shoes = await services.createExpense(userId, 'Shoes', 2000, '', food, '2026-10-20T09:00:00');
  await createRefund(shoes, {amount: 500, date: '2026-10-21T11:00:00', note: ''});
  await createIncome(userId, {categoryId: `inc_${userId}`, amount: 40_000, date: '2026-10-01', note: ''});
  await services.upsertBudget(userId, 4000, {kind: 'month', yearMonth: '2026-10'});
  await services.createExpense(userId, 'Chai', 20, '', food, '2026-11-15T08:00:00');
  await store.dispatch(fetchUserData());
});
afterAll(() => jest.useRealTimers());

const showMonth = async (monthIndex: number, year: number) => {
  store.dispatch(setMonthSelection({monthIndex, year}));
  const view = await renderHookInApp(() => useMonthView());
  await act(() => Promise.resolve()); // the focus refetch lands
  return view.result;
};

it('a past month: its spending net of refunds, money in, and the budget it went over', async () => {
  const view = await showMonth(9, 2026);
  expect(view.current.month).toMatchObject({yearMonth: '2026-10', days: 31, isCurrent: false, canGoForward: true});
  expect(view.current.totals).toEqual({spent: 4500, count: 2, today: 0, refunded: 500, received: 40_000});
  expect(view.current.budget).toMatchObject({amount: 4000, exceeded: true, left: 0, over: 500});
});

it('the current month: today counts, no step forward, and no budget when none is set', async () => {
  const view = await showMonth(10, 2026);
  expect(view.current.month).toMatchObject({yearMonth: '2026-11', isCurrent: true, canGoForward: false});
  expect(view.current.totals).toMatchObject({spent: 20, count: 1, today: 20});
  expect(view.current.budget).toBeNull();
});

it('steps a month at a time, across a year, but never into the future', async () => {
  const view = await showMonth(0, 2026);
  await act(() => view.current.month.shift(-1));
  expect(view.current.month.yearMonth).toBe('2025-12');
  await act(() => view.current.month.select(10, 2026));
  await act(() => view.current.month.shift(1));
  expect(view.current.month.yearMonth).toBe('2026-11');
});

// 3.0 (P11): months that start on the user's salary day (Pro).
describe('with months starting on the 20th', () => {
  beforeAll(() => {
    setEntitlement({state: 'lifetime'});
    setStoredMonthStartDay(20);
  });
  afterAll(() => {
    setStoredMonthStartDay(1);
    setEntitlement();
  });

  it('on the 15th "this month" is still the one that began on 20 October, named by its days', async () => {
    store.dispatch(monthStartChanged(NOW));
    const view = await renderHookInApp(() => useMonthView());
    await act(() => Promise.resolve());
    expect(view.result.current.month).toMatchObject({
      yearMonth: '2026-10',
      period: {start: '2026-10-20', next: '2026-11-20'},
      days: 31,
      isCurrent: true,
      canGoForward: false,
    });
    expect(view.result.current.month.label).toMatch(/20.*19/);
    // Shoes (20 Oct) less its refund (21 Oct), and today's chai; groceries on the 2nd are the month before.
    expect(view.result.current.totals).toMatchObject({spent: 1520, count: 2, today: 20, refunded: 500});
    // The October budget is this month's (it is named by the month it starts in): day 27 of 31.
    expect(view.result.current.budget).toMatchObject({amount: 4000, exceeded: false, left: 2480});
  });

  it('the month before holds what was dated before the 20th, and can step forward', async () => {
    store.dispatch(monthStartChanged(NOW));
    const view = await renderHookInApp(() => useMonthView());
    await act(() => view.result.current.month.shift(-1));
    await act(() => Promise.resolve());
    expect(view.result.current.month).toMatchObject({yearMonth: '2026-09', isCurrent: false, canGoForward: true});
    expect(view.result.current.totals).toMatchObject({spent: 3000, count: 1, received: 40_000});
    // Never past the month today is in.
    await act(() => view.result.current.month.shift(1));
    await act(() => view.result.current.month.shift(1));
    expect(view.result.current.month.yearMonth).toBe('2026-10');
  });

  it('when Pro ends the same screen shows the calendar month again', async () => {
    store.dispatch(monthStartChanged(NOW));
    const view = await renderHookInApp(() => useMonthView());
    await act(() => Promise.resolve());
    await act(async () => {
      setEntitlement({state: 'expired'});
      store.dispatch(monthStartChanged(NOW));
    });
    await act(() => Promise.resolve());
    expect(view.result.current.month).toMatchObject({
      yearMonth: '2026-11',
      period: {start: '2026-11-01', next: '2026-12-01'},
      days: 30,
    });
    expect(view.result.current.totals).toMatchObject({spent: 20, count: 1});
    setEntitlement({state: 'lifetime'});
  });
});

// The Money tab keeps a month of its own; nothing in the store resets it (review 2026-11-12).
it('a selection of its own goes back to today’s month when the start day changes', async () => {
  const view = await renderHookInApp(() => useMonthNavigation({shared: false}));
  expect(view.result.current).toMatchObject({yearMonth: '2026-11', isCurrentMonth: true});
  await act(async () => {
    setEntitlement({state: 'lifetime'});
    setStoredMonthStartDay(20);
  });
  // On the 15th, with months starting on the 20th, '2026-11' would be days that have not come.
  expect(view.result.current).toMatchObject({yearMonth: '2026-10', isCurrentMonth: true, canGoForward: false});
  // A month picked on purpose is also reset: its key names other days now.
  await act(() => view.result.current.shiftMonth(-1));
  expect(view.result.current.yearMonth).toBe('2026-09');
  await act(async () => {
    setStoredMonthStartDay(1);
  });
  expect(view.result.current).toMatchObject({yearMonth: '2026-11', isCurrentMonth: true});
  await act(async () => setEntitlement());
});
