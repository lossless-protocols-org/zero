import {createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';

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

const monthOf = (now: Date): MonthSelection => ({monthIndex: now.getMonth(), year: now.getFullYear()});

const isMonthOf = (selection: MonthSelection, now: Date): boolean =>
  selection.monthIndex === now.getMonth() && selection.year === now.getFullYear();

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
});

export const selectMonthIndex = (state: RootState) => state.monthSelection.monthIndex;
export const selectYear = (state: RootState) => state.monthSelection.year;

export const {setMonthSelection, followToday} = monthSelectionSlice.actions;

export const monthSelectionReducer = monthSelectionSlice.reducer;
