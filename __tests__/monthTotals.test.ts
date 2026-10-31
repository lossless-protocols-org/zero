/**
 * M12 (v2.7.1): Home summed the month (total, count, today) inline, and three
 * other screens hand-rolled the same reduce. One memoised selector for the
 * month, one `sumAmounts` for any list.
 */
import type {ExpenseWithCategory} from '../src/watermelondb/services';

// required after jest.mock so the mocks apply; each cast names the module's own type
const store = (require('../src/redux/store') as typeof import('../src/redux/store')).default;
const {fetchExpensesByMonth, selectMonthTotals} =
  require('../src/redux/slice/expenseDataSlice') as typeof import('../src/redux/slice/expenseDataSlice');
const {sumAmounts} = require('../src/utils/numberUtils') as typeof import('../src/utils/numberUtils');

const row = (id: string, amount: number, date: string): ExpenseWithCategory => ({
  id,
  title: id,
  amount,
  date,
  description: '',
  categoryId: 'c',
  userId: 'u',
});

it('sumAmounts adds any list of amounts', () => {
  expect(sumAmounts([])).toBe(0);
  expect(sumAmounts([{amount: 1.1}, {amount: 2.2}])).toBeCloseTo(3.3);
});

it('selectMonthTotals gives total, count and today, and is memoised', () => {
  const rows = [
    row('a', 10, '2026-10-30T09:00:00'),
    row('b', 5, '2026-10-30T20:00:00'),
    row('c', 7, '2026-10-02T12:00:00'),
  ];
  store.dispatch(fetchExpensesByMonth.pending('r1', '2026-10'));
  store.dispatch(fetchExpensesByMonth.fulfilled(rows, 'r1', '2026-10'));
  const first = selectMonthTotals(store.getState(), '2026-10-30');
  expect(first).toEqual({total: 22, count: 3, today: 15});
  expect(selectMonthTotals(store.getState(), '2026-10-30')).toBe(first);
  expect(selectMonthTotals(store.getState(), '2026-11-01').today).toBe(0);
});
