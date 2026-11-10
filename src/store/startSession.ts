import {createAsyncThunk} from '@reduxjs/toolkit';
import type {RootState} from './rootReducer';
import type {AppDispatch} from './store';
import {bootstrapSession} from './bootstrapSession';
import {selectUserId} from './slices/userIdSlice';
import {selectMonthIndex, selectYear} from './slices/monthSelectionSlice';
import {fetchExpensesByMonth} from './slices/expenseDataSlice';
import {fetchBudgetsByMonth} from './slices/budgetDataSlice';
import {fetchIncomesByMonth} from './slices/incomeDataSlice';
import {toYearMonth} from '../domain/dates';

/** The month a cold start loaded for Home, until Home's first focus takes it. */
let loadedAtStart: string | null = null;

/**
 * A cold start's reads, done before the first screen mounts (audit 2026-11-08
 * §8.2): the session (bootstrapSession), then the selected month's expenses,
 * budgets and money in, which is what Home draws first.
 *
 * Home used to mount empty, then load the user, re-render, then (its focus
 * effect waits for a user) load the month and re-render again: three commits
 * and four task hops between the database opening and the first rows. With
 * JSI each read is synchronous, so running them before the first frame costs
 * the same time and draws Home once, with its rows. App keeps the launch
 * screen up meanwhile.
 */
export const startSession = createAsyncThunk<void, void, {state: RootState; dispatch: AppDispatch}>(
  'session/start',
  async (_, {dispatch, getState}) => {
    await dispatch(bootstrapSession());
    const state = getState();
    if (!selectUserId(state)) {
      return; // no user: bootstrapSession has surfaced why, and Home has nothing to load
    }
    const yearMonth = toYearMonth(selectYear(state), selectMonthIndex(state));
    await Promise.all([
      dispatch(fetchExpensesByMonth(yearMonth)),
      dispatch(fetchBudgetsByMonth(yearMonth)),
      dispatch(fetchIncomesByMonth(yearMonth)),
    ]);
    loadedAtStart = yearMonth;
  },
);

/**
 * True once, for the month startSession loaded: the first focus of the
 * screen that shows it skips its refetch, which would read the same rows a
 * few milliseconds later. Any other month, and every later call, is false.
 */
export const takeMonthLoadedAtStart = (yearMonth: string): boolean => {
  const hit = loadedAtStart === yearMonth;
  loadedAtStart = null;
  return hit;
};
