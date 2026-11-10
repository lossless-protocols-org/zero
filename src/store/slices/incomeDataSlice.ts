import {createAsyncThunk, createSelector, createSlice} from '@reduxjs/toolkit';
import {beginMonth, emptyMonthCache, settleMonth, type MonthCache} from '../monthCache';
import type {RootState} from '../rootReducer';
import {getIncomesByMonth} from '../../data/services/incomeService';
import {selectUserId} from './userIdSlice';
import {sumAmounts} from '../../domain/money';
import type {IncomeData} from '../../domain/types';

/**
 * Money in by month (schema v5), read by Home's money-in line, Reports and
 * the Money tab, which may show different months at once (the Money tab keeps
 * its own month). Each month has its own slot (store/monthCache): a fetch for
 * one month never changes another's, the newest request for a month wins,
 * and a failure empties that month rather than leaving stale rows under it.
 */
type IncomeState = MonthCache<IncomeData[]>;

const NO_INCOMES: IncomeData[] = [];
const initialState: IncomeState = emptyMonthCache<IncomeData[]>();

export const fetchIncomesByMonth = createAsyncThunk<IncomeData[], string, {state: RootState; rejectValue: string}>(
  'income/fetchByMonth',
  async (yearMonth, {getState, rejectWithValue}) => {
    try {
      return await getIncomesByMonth(selectUserId(getState()), yearMonth);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch money in');
    }
  },
);

const incomeDataSlice = createSlice({
  name: 'income',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchIncomesByMonth.pending, (state, action) => {
        beginMonth(state, action.meta.arg, action.meta.requestId, NO_INCOMES);
      })
      .addCase(fetchIncomesByMonth.fulfilled, (state, action) => {
        settleMonth(state, action.meta.arg, action.meta.requestId, action.payload);
      })
      .addCase(fetchIncomesByMonth.rejected, (state, action) => {
        settleMonth(state, action.meta.arg, action.meta.requestId, NO_INCOMES);
      });
  },
});

/** `yearMonth`'s incomes as last loaded, else none (never another month's). */
export const selectIncomes = (state: RootState, yearMonth: string): IncomeData[] =>
  state.income.months[yearMonth]?.data ?? NO_INCOMES;

/** What came in during `yearMonth`. */
export const selectReceived = createSelector([selectIncomes], incomes => sumAmounts(incomes));

export const incomeReducer = incomeDataSlice.reducer;
