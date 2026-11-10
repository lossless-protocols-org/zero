import {createAsyncThunk, createSelector, createSlice} from '@reduxjs/toolkit';
import {beginMonth, emptyMonthCache, settleMonth, type MonthCache} from '../monthCache';
import type {RootState} from '../rootReducer';
import {ExpenseWithCategory} from '../../domain/types';
import {
  getAllExpensesByMonth,
  getAllExpensesByDate,
  getAllExpensesByCategoryAndMonth,
} from '../../data/services/expenseService';
import {
  getRefundedAmountsByCategoryAndMonth,
  getRefundedAmountsByDate,
  getRefundedAmountsByMonth,
  getRefundRowsByCategoryAndMonth,
  getRefundRowsByDate,
  getRefundRowsByMonth,
} from '../../data/services/refundService';
import {selectUserId} from './userIdSlice';
import type {AppDispatch} from '../store';
import {onDay, spendingOf, toSpendRows} from '../../domain/periodMath';
import type {RefundListRow} from '../../domain/types';

/**
 * What one spending list needs, fetched together so the three can never come
 * from different periods: the expenses, the refunds DATED in the period (they
 * lower its spending, R2) and, for the badge, how much came back on each of
 * these expenses whenever it came back.
 */
interface SpendingPeriod {
  expenses: ExpenseWithCategory[];
  refunds: RefundListRow[];
  refundedByExpense: Record<string, number>;
}

const EMPTY_REFUNDED: Record<string, number> = {};

const EMPTY_PERIOD: SpendingPeriod = {expenses: [], refunds: [], refundedByExpense: EMPTY_REFUNDED};

/**
 * Months live in per-month slots (store/monthCache): Home and Reports read the
 * month they show, and a fetch of any other month (the widget queue, the
 * quick-add sheet, a back-dated add) can no longer put its rows under the
 * label of the month on screen (audit 2026-11-08 §3.2).
 */
/** What the day screen or the category screen asked for. */
export type ListFilter = {kind: 'day'; date: string} | {kind: 'category'; categoryId: string; yearMonth: string};

const sameFilter = (a: ListFilter, b: ListFilter): boolean => {
  if (a.kind === 'day' && b.kind === 'day') {
    return a.date === b.date;
  }
  if (a.kind === 'category' && b.kind === 'category') {
    return a.categoryId === b.categoryId && a.yearMonth === b.yearMonth;
  }
  return false;
};

interface ExpenseState extends MonthCache<SpendingPeriod> {
  /**
   * The day's or the category's rows, with the filter they answer. One slot
   * shared by the two screens, so a screen reads it only through
   * selectFilteredPeriod with its own filter: until the answer to that filter
   * lands, the screen gets nothing rather than the other screen's rows. The
   * filter was a string key ("2026-11-02", "cat:2026-11") compared by hand on
   * each screen (audit 2026-11-08, Appendix A).
   */
  filtered: {filter: ListFilter; period: SpendingPeriod} | null;
  /**
   * The newest day or category request. Only its answer is stored: switching
   * days or categories quickly could otherwise let a slower, older query land
   * last and fill the list with the wrong rows (audit 2026-11-08 §3.11).
   */
  filterRequestId: string | null;
}

const initialState: ExpenseState = {
  ...emptyMonthCache<SpendingPeriod>(),
  filtered: null,
  filterRequestId: null,
};

/** Stores a day's or category's rows when `requestId` is still the newest such request. */
const settleFilter = (state: ExpenseState, requestId: string, filter: ListFilter, period: SpendingPeriod): void => {
  if (state.filterRequestId === requestId) {
    state.filtered = {filter, period};
  }
};

/**
 * A list's period, read together so the three can never disagree: the
 * expenses, the refunds dated in the period, and how much came back on each
 * of those expenses.
 */
const readPeriod = async (
  expenses: Promise<ExpenseWithCategory[]>,
  refunds: Promise<RefundListRow[]>,
  refunded: Promise<Record<string, number>>,
): Promise<SpendingPeriod> => {
  const [periodExpenses, periodRefunds, refundedByExpense] = await Promise.all([expenses, refunds, refunded]);
  return {expenses: periodExpenses, refunds: periodRefunds, refundedByExpense};
};

export const fetchExpensesByMonth = createAsyncThunk<SpendingPeriod, string, {state: RootState; rejectValue: string}>(
  'expense/fetchByMonth',
  async (yearMonth: string, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      return await readPeriod(
        getAllExpensesByMonth(userId, yearMonth),
        getRefundRowsByMonth(userId, yearMonth),
        getRefundedAmountsByMonth(userId, yearMonth),
      );
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch expenses');
    }
  },
);

export const fetchEverydayExpenses = createAsyncThunk<SpendingPeriod, string, {state: RootState; rejectValue: string}>(
  'expense/fetchByDate',
  async (date: string, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      return await readPeriod(
        getAllExpensesByDate(userId, date),
        getRefundRowsByDate(userId, date),
        getRefundedAmountsByDate(userId, date),
      );
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch everyday expenses');
    }
  },
);

export const fetchExpensesByCategory = createAsyncThunk<
  SpendingPeriod,
  {categoryId: string; yearMonth: string},
  {state: RootState; rejectValue: string}
>('expense/fetchByCategory', async ({categoryId, yearMonth}, {getState, rejectWithValue}) => {
  try {
    const userId = selectUserId(getState());
    return await readPeriod(
      getAllExpensesByCategoryAndMonth(userId, categoryId, yearMonth),
      getRefundRowsByCategoryAndMonth(userId, categoryId, yearMonth),
      getRefundedAmountsByCategoryAndMonth(userId, categoryId, yearMonth),
    );
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch category expenses');
  }
});

/**
 * Reloads the expenses a list is showing after a write (L1, v2.7.1). A
 * day-scoped list (the Everyday screen) refetches its day's MONTH, derived
 * from the date, plus the day itself. There is deliberately no whole-table
 * fallback any more: at 10k rows it hydrated several MB into Redux for a
 * month view that Home refetched (and discarded) on its next focus.
 */
export const refetchExpenses = async (
  dispatch: AppDispatch,
  scope: {targetMonth?: string; targetDate?: string},
): Promise<void> => {
  // Route params default to '' when missing, so '' counts as absent too.
  const month = scope.targetMonth || scope.targetDate?.slice(0, 7);
  if (!month) {
    throw new Error('refetchExpenses needs a month or a date');
  }
  // A rejected fetch is logged and surfaced by thunkRejectionMiddleware.
  await Promise.all([
    dispatch(fetchExpensesByMonth(month)),
    scope.targetDate ? dispatch(fetchEverydayExpenses(scope.targetDate)) : undefined,
  ]);
};

const expenseDataSlice = createSlice({
  name: 'expense',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchExpensesByMonth.pending, (state, action) => {
        beginMonth(state, action.meta.arg, action.meta.requestId, EMPTY_PERIOD);
      })
      .addCase(fetchExpensesByMonth.fulfilled, (state, action) => {
        settleMonth(state, action.meta.arg, action.meta.requestId, action.payload);
      })
      .addCase(fetchExpensesByMonth.rejected, (state, action) => {
        // An empty month, never stale rows under its label; the failure itself
        // is surfaced by thunkRejectionMiddleware.
        settleMonth(state, action.meta.arg, action.meta.requestId, EMPTY_PERIOD);
      })
      .addCase(fetchEverydayExpenses.pending, (state, action) => {
        state.filterRequestId = action.meta.requestId;
      })
      .addCase(fetchEverydayExpenses.fulfilled, (state, action) => {
        settleFilter(state, action.meta.requestId, {kind: 'day', date: action.meta.arg}, action.payload);
      })
      .addCase(fetchEverydayExpenses.rejected, (state, action) => {
        // An empty day, never the previous day's rows under its date (as a failed month).
        settleFilter(state, action.meta.requestId, {kind: 'day', date: action.meta.arg}, EMPTY_PERIOD);
      })
      .addCase(fetchExpensesByCategory.pending, (state, action) => {
        state.filterRequestId = action.meta.requestId;
      })
      .addCase(fetchExpensesByCategory.fulfilled, (state, action) => {
        settleFilter(state, action.meta.requestId, {kind: 'category', ...action.meta.arg}, action.payload);
      })
      .addCase(fetchExpensesByCategory.rejected, (state, action) => {
        settleFilter(state, action.meta.requestId, {kind: 'category', ...action.meta.arg}, EMPTY_PERIOD);
      });
  },
});

/** `yearMonth` as last loaded: its expenses, the refunds dated in it, and what came back on each. */
const selectPeriod = (state: RootState, yearMonth: string): SpendingPeriod =>
  state.expense.months[yearMonth]?.data ?? EMPTY_PERIOD;

export const selectExpenseData = (state: RootState, yearMonth: string) => selectPeriod(state, yearMonth).expenses;
export const selectMonthRefunds = (state: RootState, yearMonth: string) => selectPeriod(state, yearMonth).refunds;
export const selectRefundedByExpense = (state: RootState, yearMonth: string) =>
  selectPeriod(state, yearMonth).refundedByExpense;

/**
 * `yearMonth`'s spending (net of the refunds dated in it, R2), its expense
 * count, the part dated `today` (YYYY-MM-DD, by local day so a row stored
 * with a zone suffix still counts), and what came back.
 */
export const selectMonthTotals = createSelector(
  [selectPeriod, (_state: RootState, _yearMonth: string, today: string) => today],
  ({expenses, refunds}, today) => {
    // spendingOf / onDay: the same rule periodSummaryService applies to the database (audit §4.1).
    const month = spendingOf(expenses, refunds);
    return {
      total: month.spent,
      count: month.count,
      today: spendingOf(onDay(expenses, today), onDay(refunds, today)).spent,
      refunded: month.refunded,
    };
  },
);

/** `yearMonth`'s expenses and refunds as one signed list, for Reports' donut and heatmap. */
export const selectMonthSpendRows = createSelector([selectPeriod], ({expenses, refunds}) =>
  toSpendRows(expenses, refunds),
);

/**
 * The rows for `filter` (a day, or a category's month), or none until the
 * answer to that filter has landed. The same object while nothing changes,
 * so a screen can depend on it.
 */
export const selectFilteredPeriod = (state: RootState, filter: ListFilter): SpendingPeriod => {
  const filtered = state.expense.filtered;
  return filtered && sameFilter(filtered.filter, filter) ? filtered.period : EMPTY_PERIOD;
};

export const expenseReducer = expenseDataSlice.reducer;
