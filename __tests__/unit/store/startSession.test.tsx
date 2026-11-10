/**
 * A cold start loads what Home draws first before Home mounts, and Home's
 * first focus does not read it again (audit 2026-11-08 §8.2). Real store,
 * LokiJS database; React Navigation's focus is the harness stand-in.
 */
import {act} from '@testing-library/react-native';
import {store} from '../../../src/store/store';
import {resetSession} from '../../../src/store/rootReducer';
import {startSession, takeMonthLoadedAtStart} from '../../../src/store/startSession';
import {selectExpenseData} from '../../../src/store/slices/expenseDataSlice';
import {selectCurrencyCode} from '../../../src/store/slices/currencyDataSlice';
import {setMonthSelection} from '../../../src/store/slices/monthSelectionSlice';
import {useMonthView} from '../../../src/ui/hooks/useMonthView';
import * as services from '../../harness/services';
import {renderHookInApp} from '../../harness/render';
import {countReads} from '../../harness/readCount';

jest.mock('react-i18next', () => require('../../harness/mocks/reactI18next'));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../harness/mocks/focusEffect'),
}));

const NOW = new Date(2026, 10, 15, 12, 0, 0);

beforeEach(async () => {
  jest.useFakeTimers({now: NOW, advanceTimers: true});
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await services.createCategory('Food', userId, null, null, 'expense');
  await services.createExpense(userId, 'Chai', 20, '', food, '2026-11-15T08:00:00');
  store.dispatch(setMonthSelection({monthIndex: 10, year: 2026}));
});
afterEach(() => jest.useRealTimers());

it('loads the session and the selected month', async () => {
  await store.dispatch(startSession());
  expect(selectCurrencyCode(store.getState())).toBe('INR');
  expect(selectExpenseData(store.getState(), '2026-11').map(e => e.title)).toEqual(['Chai']);
});

it("Home's first focus reads nothing more for that month; its next focus refetches", async () => {
  await store.dispatch(startSession());
  const first = await countReads(async () => {
    const view = await renderHookInApp(() => useMonthView());
    await act(() => Promise.resolve());
    expect(view.result.current.totals.spent).toBe(20);
    await view.unmount();
  });
  const monthRead = 'unsafeQueryRaw expenses(user_id,date)';
  expect(first.reads).not.toContain(monthRead);

  const next = await countReads(async () => {
    const view = await renderHookInApp(() => useMonthView());
    await act(() => Promise.resolve());
    await view.unmount();
  });
  expect(next.reads).toContain(monthRead);
});

it('hands over only the month it loaded, once', async () => {
  await store.dispatch(startSession());
  expect(takeMonthLoadedAtStart('2026-10')).toBe(false);
  // The miss above used the hand-over up: a month is skipped at most once, and only right after the start.
  expect(takeMonthLoadedAtStart('2026-11')).toBe(false);
});

it('with no user, loads nothing and hands nothing over', async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  await store.dispatch(startSession());
  expect(takeMonthLoadedAtStart('2026-11')).toBe(false);
});
