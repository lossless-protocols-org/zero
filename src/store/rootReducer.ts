import {combineReducers, type UnknownAction} from 'redux';
import {createAction} from '@reduxjs/toolkit';
import {currencyDataReducer} from './slices/currencyDataSlice';
import {userNameReducer} from './slices/userNameSlice';
import {userIdReducer} from './slices/userIdSlice';
import {categoryReducer} from './slices/categoryDataSlice';
import {expenseReducer} from './slices/expenseDataSlice';
import {debtorReducer} from './slices/debtorDataSlice';
import {debtReducer} from './slices/debtDataSlice';
import {individualDebtorReducer} from './slices/individualDebtorDataSlice';
import {monthSelectionReducer} from './slices/monthSelectionSlice';
import {budgetReducer} from './slices/budgetDataSlice';
import {dataErrorReducer} from './slices/dataErrorSlice';
import {incomeReducer} from './slices/incomeDataSlice';

const appReducer = combineReducers({
  currencyData: currencyDataReducer,
  userName: userNameReducer,
  userId: userIdReducer,
  category: categoryReducer,
  expense: expenseReducer,
  debtor: debtorReducer,
  debt: debtReducer,
  individualDebtor: individualDebtorReducer,
  monthSelection: monthSelectionReducer,
  budget: budgetReducer,
  dataError: dataErrorReducer,
  income: incomeReducer,
});

/**
 * Every slice back to its initial state: after "Delete all data" and after a
 * restore, nothing of the previous user (their id, currency, categories,
 * cached months, selected month, data-error flag) may outlive the data it
 * came from (audit 2026-11-08 §3.10). A fetch still in flight is dropped as it
 * lands: every month and filter guard compares request ids the reset cleared.
 */
export const resetSession = createAction('session/reset');

export type RootState = ReturnType<typeof appReducer>;

export const rootReducer = (state: RootState | undefined, action: UnknownAction): RootState =>
  appReducer(resetSession.match(action) ? undefined : state, action);
