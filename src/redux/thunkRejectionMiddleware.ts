import {isFulfilled, isRejected, type Middleware} from '@reduxjs/toolkit';
import {appendErrorLog} from '../utils/errorLog';
import {dataErrorCleared, dataErrorOccurred} from './slice/dataErrorSlice';
import type {RootState} from './rootReducer';

/** 'expense/fetchByMonth/rejected' → 'expense/fetchByMonth'. */
const thunkOf = (type: string): string => type.slice(0, type.lastIndexOf('/'));

/**
 * The one place every thunk failure becomes visible (M1, v2.7.1).
 * `rejectWithValue` resolves the dispatch promise, so the unhandled-rejection
 * tracker never sees it, and no screen read the per-slice `error` fields —
 * a locked database showed Home as "no transactions" with no record. Each
 * rejection is written to the error log and to `dataError`; a later success
 * of the same thunk clears it. A thunk skipped by its `condition`, or
 * aborted, is not a failure. The log entry carries the thunk and its
 * message; the original stack is not kept (rejectValue is a string).
 */
export const thunkRejectionMiddleware: Middleware<object, RootState> = api => next => action => {
  if (isRejected(action) && !action.meta.condition && !action.meta.aborted) {
    const message = typeof action.payload === 'string' ? action.payload : (action.error.message ?? 'Unknown error');
    appendErrorLog(new Error(`${thunkOf(action.type)}: ${message}`), false);
    api.dispatch(dataErrorOccurred({thunk: thunkOf(action.type), message}));
  } else if (isFulfilled(action)) {
    const thunk = thunkOf(action.type);
    if (api.getState().dataError.byThunk[thunk] !== undefined) {
      api.dispatch(dataErrorCleared(thunk));
    }
  }
  return next(action);
};
