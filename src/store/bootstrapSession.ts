import {createAsyncThunk} from '@reduxjs/toolkit';
import type {RootState} from './rootReducer';
import type {AppDispatch} from './store';
import {fetchUserData, selectUserId} from './slices/userIdSlice';
import {fetchCurrency} from './slices/currencyDataSlice';
import {fetchCategories} from './slices/categoryDataSlice';
import {ensureIncomeCategory} from '../data/services/categoryService';
import {appendErrorLog} from '../platform/errorLog';

/**
 * Starts a session: who the user is, then what every screen assumes is
 * loaded (their currency and categories). The app shell runs it where a
 * session begins (App once onboarded, the quick-add sheet's own root, the
 * onboarding step that creates the user, a restore), so no screen bootstraps
 * on its own; Home, the quick-add sheet and onboarding each carried a copy
 * (audit 2026-11-08 §4.2).
 *
 * It is also where the one invariant money in rests on is checked, once per
 * session: every user has an active income category. Nothing should ever
 * need repairing; when something did, Diagnostics says so.
 *
 * Never rejects: each step's failure is already logged and surfaced by
 * thunkRejectionMiddleware, and the screens show what loaded.
 */
export const bootstrapSession = createAsyncThunk<void, void, {state: RootState; dispatch: AppDispatch}>(
  'session/bootstrap',
  async (_, {dispatch, getState}) => {
    await dispatch(fetchUserData());
    const userId = selectUserId(getState());
    if (!userId) {
      return; // no user row: the failure is already surfaced; nothing else can load
    }
    try {
      if (await ensureIncomeCategory(userId)) {
        appendErrorLog(
          new Error('bootstrapSession: the income category was missing or archived and was restored'),
          false,
        );
      }
    } catch (error) {
      appendErrorLog(error, false);
    }
    await Promise.all([dispatch(fetchCurrency()), dispatch(fetchCategories())]);
  },
);
