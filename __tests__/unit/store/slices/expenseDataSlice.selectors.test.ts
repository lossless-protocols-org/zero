/**
 * M12 (v2.7.1): Home summed the month (total, count, today) inline, and three
 * other screens hand-rolled the same reduce. One memoised selector for the
 * month, one `sumAmounts` for any list.
 *
 * Tickets: R2.
 */
import type {ExpenseWithCategory} from '../../../../src/domain/types';
import type {RefundListRow} from '../../../../src/domain/types';
import {store} from '../../../../src/store/store';
import {fetchExpensesByMonth, selectMonthTotals} from '../../../../src/store/slices/expenseDataSlice';
import {sumAmounts} from '../../../../src/domain/money';
/** The month thunk's payload: expenses, the month's refunds, refunded per expense. */
type SpendingPeriod = Parameters<typeof fetchExpensesByMonth.fulfilled>[0];

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
  const period: SpendingPeriod = {expenses: rows, refunds: [], refundedByExpense: {}};
  store.dispatch(fetchExpensesByMonth.pending('r1', '2026-10'));
  store.dispatch(fetchExpensesByMonth.fulfilled(period, 'r1', '2026-10'));
  const first = selectMonthTotals(store.getState(), '2026-10', '2026-10-30');
  expect(first).toEqual({total: 22, count: 3, today: 15, refunded: 0});
  expect(selectMonthTotals(store.getState(), '2026-10', '2026-10-30')).toBe(first);
  expect(selectMonthTotals(store.getState(), '2026-10', '2026-11-01').today).toBe(0);
  // A month nobody loaded is empty, never another month's figures.
  expect(selectMonthTotals(store.getState(), '2026-09', '2026-09-30')).toEqual({
    total: 0,
    count: 0,
    today: 0,
    refunded: 0,
  });
});

it('counts a row stored with a zone suffix on its local day (toDayKey, not startsWith)', () => {
  const period: SpendingPeriod = {
    expenses: [row('z', 9, '2026-10-30T09:00:00.000Z'), row('y', 1, '2026-10-30')],
    refunds: [],
    refundedByExpense: {},
  };
  store.dispatch(fetchExpensesByMonth.pending('rz', '2026-10'));
  store.dispatch(fetchExpensesByMonth.fulfilled(period, 'rz', '2026-10'));
  const local = new Date('2026-10-30T09:00:00.000Z');
  const localDay = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  expect(selectMonthTotals(store.getState(), '2026-10', localDay).today).toBe(localDay === '2026-10-30' ? 10 : 9);
});

it('nets the refunds dated in the month, today included, and counts only expenses', () => {
  const refund = (id: string, amount: number, date: string): RefundListRow => ({
    id,
    expenseId: 'a',
    amount,
    date,
    note: '',
    title: 'a',
    categoryId: 'c',
  });
  const period: SpendingPeriod = {
    expenses: [row('a', 10, '2026-10-30T09:00:00'), row('b', 0.2, '2026-10-02T12:00:00')],
    refunds: [refund('r1', 4, '2026-10-30T18:00:00'), refund('r2', 0.1, '2026-10-05T10:00:00')],
    refundedByExpense: {a: 4},
  };
  store.dispatch(fetchExpensesByMonth.pending('r2', '2026-10'));
  store.dispatch(fetchExpensesByMonth.fulfilled(period, 'r2', '2026-10'));
  expect(selectMonthTotals(store.getState(), '2026-10', '2026-10-30')).toEqual({
    total: 6.1,
    count: 2,
    today: 6,
    refunded: 4.1,
  });
});
