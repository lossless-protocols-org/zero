import {createAsyncThunk, createSelector, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {BudgetData, getBudgetsByMonth} from '../../watermelondb/services/budgetService';
import {resolveBudget} from '../../utils/budgetMath';
import {selectUserId} from './userIdSlice';

interface BudgetState {
  budgets: BudgetData[];
  /** The month the rows were fetched for; selectors answer only for it. */
  yearMonth: string | null;
  /** The newest fetch; an older one that resolves later is dropped. */
  requestId: string | null;
}

const initialState: BudgetState = {
  budgets: [],
  yearMonth: null,
  requestId: null,
};

export const fetchBudgetsByMonth = createAsyncThunk<
  {budgets: BudgetData[]; yearMonth: string},
  string,
  {state: RootState; rejectValue: string}
>('budget/fetchByMonth', async (yearMonth: string, {getState, rejectWithValue}) => {
  try {
    const userId = selectUserId(getState());
    const budgets = await getBudgetsByMonth(userId, yearMonth);
    return {budgets, yearMonth};
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch budgets');
  }
});

const budgetDataSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchBudgetsByMonth.pending, (state, action) => {
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchBudgetsByMonth.fulfilled, (state, action) => {
        if (action.meta.requestId === state.requestId) {
          state.budgets = action.payload.budgets;
          state.yearMonth = action.payload.yearMonth;
        }
      });
  },
});

const selectBudgetRows = (state: RootState) => state.budget.budgets;
const selectBudgetYearMonth = (state: RootState) => state.budget.yearMonth;
const selectShownMonth = (_state: RootState, yearMonth: string) => yearMonth;

/**
 * The overall monthly budget in force for `yearMonth`, or null — also null
 * while the slice holds another month: four screens share it, each fetching
 * the month it shows, and must never show each other's budget.
 */
export const selectCurrentBudget = createSelector(
  [selectBudgetRows, selectBudgetYearMonth, selectShownMonth],
  (rows, fetchedMonth, yearMonth): BudgetData | null => {
    if (fetchedMonth !== yearMonth) {
      return null;
    }
    return resolveBudget(
      rows.filter(b => b.budgetType === 'monthly'),
      yearMonth,
    );
  },
);

/** Per-category budgets in force for `yearMonth`, keyed by category id; empty while another month is held. */
export const selectCategoryBudgets = createSelector(
  [selectBudgetRows, selectBudgetYearMonth, selectShownMonth],
  (rows, fetchedMonth, yearMonth): Record<string, BudgetData> => {
    const result: Record<string, BudgetData> = {};
    if (fetchedMonth !== yearMonth) {
      return result;
    }
    const byCategory = new Map<string, BudgetData[]>();
    for (const row of rows) {
      if (row.budgetType !== 'category' || !row.categoryId) {
        continue;
      }
      const list = byCategory.get(row.categoryId) ?? [];
      list.push(row);
      byCategory.set(row.categoryId, list);
    }
    for (const [categoryId, list] of byCategory) {
      const resolved = resolveBudget(list, yearMonth);
      if (resolved) {
        result[categoryId] = resolved;
      }
    }
    return result;
  },
);

export default budgetDataSlice.reducer;
