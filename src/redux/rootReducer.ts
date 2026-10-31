import {combineReducers} from 'redux';
import currencyDataReducer from './slice/currencyDataSlice';
import userNameReducer from './slice/userNameSlice';
import userIdReducer from './slice/userIdSlice';
import categoryReducer from './slice/categoryDataSlice';
import expenseReducer from './slice/expenseDataSlice';
import debtorReducer from './slice/debtorDataSlice';
import debtReducer from './slice/debtDataSlice';
import individualDebtorReducer from './slice/individualDebtorDataSlice';
import monthSelectionReducer from './slice/monthSelectionSlice';
import budgetReducer from './slice/budgetDataSlice';
import dataErrorReducer from './slice/dataErrorSlice';

const rootReducer = combineReducers({
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
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
