import {createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {monthIndexOfKey, yearOfKey} from '../../domain/period';
import {monthKeyNow} from '../../pro/monthStart';
import {monthStartChanged} from '../monthStartChanged';

interface MonthSelection {
  monthIndex: number;
  year: number;
}

interface MonthSelectionState extends MonthSelection {
  /**
   * The selection is "this month", whatever month that is. True when it was
   * set to the month it was set in; a warm start into a new month then moves
   * it along (audit 2026-11-08 §3.9), and a month picked on purpose stays.
   */
  followsToday: boolean;
}

/**
 * The month `now` is in, as the user's month start day cuts it (P11): on the
 * 3rd, with months starting on the 7th, that is still last month's.
 */
const monthOf = (now: Date): MonthSelection => {
  const key = monthKeyNow(now);
  return {monthIndex: monthIndexOfKey(key), year: yearOfKey(key)};
};

const isMonthOf = (selection: MonthSelection, now: Date): boolean => {
  const current = monthOf(now);
  return selection.monthIndex === current.monthIndex && selection.year === current.year;
};

/**
 * A function, not a value: Redux Toolkit calls it whenever the state is
 * undefined, so the store and every `resetSession` start on the month it is
 * then, never the month this module was loaded in.
 */
const initialMonthSelection = (): MonthSelectionState => ({...monthOf(new Date()), followsToday: true});

const monthSelectionSlice = createSlice({
  name: 'monthSelection',
  initialState: initialMonthSelection,
  reducers: {
    setMonthSelection: {
      reducer: (_state, action: {payload: MonthSelectionState}) => action.payload,
      prepare: (selection: MonthSelection, now: Date = new Date()) => ({
        payload: {...selection, followsToday: isMonthOf(selection, now)},
      }),
    },
    /** On resume: a selection that follows today moves to today's month. */
    followToday: {
      reducer: (state, action: {payload: MonthSelection}) => {
        if (state.followsToday) {
          state.monthIndex = action.payload.monthIndex;
          state.year = action.payload.year;
        }
      },
      prepare: (now: Date = new Date()) => ({payload: monthOf(now)}),
    },
  },
  extraReducers: builder => {
    // P11: the months are cut on another day now, so "the month on screen" means other days.
    // Back to the month today is in, following it, as on a fresh start.
    builder.addCase(monthStartChanged, (_state, action) => ({
      ...monthOf(new Date(action.payload.now)),
      followsToday: true,
    }));
  },
});

export const selectMonthIndex = (state: RootState) => state.monthSelection.monthIndex;
export const selectYear = (state: RootState) => state.monthSelection.year;

export const {setMonthSelection, followToday} = monthSelectionSlice.actions;

export const monthSelectionReducer = monthSelectionSlice.reducer;
