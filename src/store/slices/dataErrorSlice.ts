import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';

/**
 * The last failed data load per thunk (M1, v2.7.1), keyed by the thunk's
 * type without its phase ('expense/fetchByMonth'). Written by
 * `thunkRejectionMiddleware` for every rejection and cleared only when the
 * SAME thunk later succeeds — a successful day or category fetch must not
 * hide a failed month fetch. Screens ask by domain prefix ('expense') and
 * render a banner; `DataErrorDialog` shows one dialog per session.
 */
interface DataErrorState {
  byThunk: Record<string, string>;
}

const initialState: DataErrorState = {
  byThunk: {},
};

const dataErrorSlice = createSlice({
  name: 'dataError',
  initialState,
  reducers: {
    dataErrorOccurred: (state, action: PayloadAction<{thunk: string; message: string}>) => {
      state.byThunk[action.payload.thunk] = action.payload.message;
    },
    dataErrorCleared: (state, action: PayloadAction<string>) => {
      delete state.byThunk[action.payload];
    },
  },
});

export const {dataErrorOccurred, dataErrorCleared} = dataErrorSlice.actions;

/** The first error of any thunk in `domains` ('expense' matches 'expense/…'), or null. */
export const selectDataError = (state: RootState, domains: readonly string[]): string | null => {
  for (const [thunk, message] of Object.entries(state.dataError.byThunk)) {
    if (domains.some(domain => thunk.startsWith(`${domain}/`))) {
      return message;
    }
  }
  return null;
};

export const selectHasAnyDataError = (state: RootState): boolean => Object.keys(state.dataError.byThunk).length > 0;

export const dataErrorReducer = dataErrorSlice.reducer;
