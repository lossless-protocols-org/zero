/**
 * The budget slice holds one fetched month, but four screens fetch it with
 * different months. Selectors now take the month the screen shows and answer
 * null for any other; only the newest fetch lands.
 */
import type {BudgetData} from '../src/watermelondb/services';

// required after module init so the store is real; each cast names the module's own type
const store = (require('../src/redux/store') as typeof import('../src/redux/store')).default;
const slice = require('../src/redux/slice/budgetDataSlice') as typeof import('../src/redux/slice/budgetDataSlice');

const monthly = (amount: number, start: string): BudgetData => ({
  id: `m${amount}`,
  userId: 'u',
  amount,
  monthKey: {kind: 'recurring', start},
  budgetType: 'monthly',
});

it('answers only for the month that was fetched', () => {
  store.dispatch(slice.fetchBudgetsByMonth.pending('r1', '2026-09'));
  store.dispatch(
    slice.fetchBudgetsByMonth.fulfilled({budgets: [monthly(20000, '2026-09')], yearMonth: '2026-09'}, 'r1', '2026-09'),
  );
  expect(slice.selectCurrentBudget(store.getState(), '2026-09')?.amount).toBe(20000);
  expect(slice.selectCurrentBudget(store.getState(), '2026-08')).toBeNull();
});

it('ignores an older fetch that lands after a newer one', () => {
  store.dispatch(slice.fetchBudgetsByMonth.pending('old', '2026-08'));
  store.dispatch(slice.fetchBudgetsByMonth.pending('new', '2026-10'));
  store.dispatch(
    slice.fetchBudgetsByMonth.fulfilled({budgets: [monthly(30000, '2026-10')], yearMonth: '2026-10'}, 'new', '2026-10'),
  );
  store.dispatch(slice.fetchBudgetsByMonth.fulfilled({budgets: [], yearMonth: '2026-08'}, 'old', '2026-08'));
  expect(slice.selectCurrentBudget(store.getState(), '2026-10')?.amount).toBe(30000);
});
