import {createAsyncThunk, createEntityAdapter, createSelector, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {
  ExpenseWithCategory,
  getAllExpensesByMonth,
  getAllExpensesByDate,
  getAllExpensesByCategoryAndMonth,
} from '../../watermelondb/services';
import {selectUserId} from './userIdSlice';
import type {AppDispatch} from '../store';
import {sumAmounts} from '../../utils/numberUtils';

const expensesAdapter = createEntityAdapter<ExpenseWithCategory>();

interface ExpenseExtraState {
  /** The newest month request; an older one that resolves later is dropped. */
  monthRequestId: string | null;
  filteredExpenses: ExpenseWithCategory[];
  filterKey: string | null;
}

const initialState = expensesAdapter.getInitialState<ExpenseExtraState>({
  monthRequestId: null,
  filteredExpenses: [],
  filterKey: null,
});

export const fetchExpensesByMonth = createAsyncThunk<
  ExpenseWithCategory[],
  string,
  {state: RootState; rejectValue: string}
>('expense/fetchByMonth', async (yearMonth: string, {getState, rejectWithValue}) => {
  try {
    const userId = selectUserId(getState());
    return await getAllExpensesByMonth(userId, yearMonth);
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch expenses');
  }
});

export const fetchEverydayExpenses = createAsyncThunk<
  ExpenseWithCategory[],
  string,
  {state: RootState; rejectValue: string}
>('expense/fetchByDate', async (date: string, {getState, rejectWithValue}) => {
  try {
    const userId = selectUserId(getState());
    const expenses = await getAllExpensesByDate(userId, date);
    return expenses;
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch everyday expenses');
  }
});

export const fetchExpensesByCategory = createAsyncThunk<
  ExpenseWithCategory[],
  {categoryId: string; yearMonth: string},
  {state: RootState; rejectValue: string}
>('expense/fetchByCategory', async ({categoryId, yearMonth}, {getState, rejectWithValue}) => {
  try {
    const userId = selectUserId(getState());
    const expenses = await getAllExpensesByCategoryAndMonth(userId, categoryId, yearMonth);
    return expenses;
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
        state.monthRequestId = action.meta.requestId;
      })
      .addCase(fetchExpensesByMonth.fulfilled, (state, action) => {
        if (action.meta.requestId === state.monthRequestId) {
          expensesAdapter.setAll(state, action.payload);
        }
      })
      .addCase(fetchExpensesByMonth.rejected, (state, action) => {
        // Keeping the previous month's rows would show them under the new
        // month's label; the failure itself is surfaced by thunkRejectionMiddleware.
        if (action.meta.requestId === state.monthRequestId) {
          expensesAdapter.removeAll(state);
        }
      })
      .addCase(fetchEverydayExpenses.fulfilled, (state, action) => {
        state.filterKey = action.meta.arg;
        state.filteredExpenses = action.payload;
      })
      .addCase(fetchExpensesByCategory.fulfilled, (state, action) => {
        state.filterKey = `${action.meta.arg.categoryId}:${action.meta.arg.yearMonth}`;
        state.filteredExpenses = action.payload;
      });
  },
});

const expenseSelectors = expensesAdapter.getSelectors<RootState>(state => state.expense);

export const selectExpenseData = expenseSelectors.selectAll;

/** The loaded month's total and count, and the part dated `today` (YYYY-MM-DD). */
export const selectMonthTotals = createSelector(
  [selectExpenseData, (_state: RootState, today: string) => today],
  (rows, today) => ({
    total: sumAmounts(rows),
    count: rows.length,
    today: sumAmounts(rows.filter(r => r.date.startsWith(today))),
  }),
);

export const selectFilteredExpenses = (state: RootState) => state.expense.filteredExpenses;
export const selectFilterKey = (state: RootState) => state.expense.filterKey;

export default expenseDataSlice.reducer;
