/**
 * The Money tab's Kept figure (received − this month's spending, read from
 * the database). It is read while the tab is focused only, once per focus and
 * once per write, and never while hidden (audit 2026-11-08 §8.3: it used to
 * read twice on mount and after every write to six tables while Home was on
 * screen). Real store and LokiJS database; React Navigation's focus is a
 * mount/unmount stand-in (harness/mocks/focusEffect).
 */
import {act, waitFor} from '@testing-library/react-native';
import {store} from '../../../../../../src/store/store';
import {resetSession} from '../../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../../src/store/slices/userIdSlice';
import * as summaries from '../../../../../../src/data/services/periodSummaryService';
import {createIncome} from '../../../../../../src/data/services/incomeService';
import {useMoney} from '../../../../../../src/features/money/screens/MoneyScreen/useMoney';
import * as services from '../../../../../harness/services';
import {renderHookInApp} from '../../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../../harness/mocks/reactI18next'));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../../harness/mocks/focusEffect'),
}));

const NOW = new Date(2026, 10, 15, 12, 0, 0);
let userId = '';
let food = '';

beforeAll(async () => {
  jest.useFakeTimers({now: NOW, advanceTimers: true});
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  food = await services.createCategory('Food', userId, null, null, 'expense');
  await createIncome(userId, {categoryId: `inc_${userId}`, amount: 1000, date: '2026-11-01', note: ''});
  await services.createExpense(userId, 'Groceries', 300, '', food, '2026-11-02T10:00:00');
  await store.dispatch(fetchUserData());
});
afterAll(() => jest.useRealTimers());

const settle = () => act(() => Promise.resolve());

it('reads the month once on focus, shows Kept, and reads again after a write', async () => {
  const reads = jest.spyOn(summaries, 'getMonthSummary');
  const view = await renderHookInApp(() => useMoney());
  await settle();
  expect(reads).toHaveBeenCalledTimes(1);
  expect(view.result.current.kept).toBe(700);

  await act(() => services.createExpense(userId, 'Bus', 50, '', food, '2026-11-03T10:00:00'));
  await waitFor(() => expect(view.result.current.kept).toBe(650));
  expect(reads).toHaveBeenCalledTimes(2);
  reads.mockRestore();
  await view.unmount();
});

it('stops reading when the tab loses focus', async () => {
  const view = await renderHookInApp(() => useMoney());
  await settle();
  const reads = jest.spyOn(summaries, 'getMonthSummary');
  await view.unmount(); // the focus stand-in: leaving the tab runs the effect's cleanup
  await services.createExpense(userId, 'Taxi', 80, '', food, '2026-11-04T10:00:00');
  await settle();
  expect(reads).not.toHaveBeenCalled();
  reads.mockRestore();
});
