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
import * as services from '../../../harness/services';
import {renderHookInApp} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
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
