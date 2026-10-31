import {createAsyncThunk, createEntityAdapter, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {DebtData as Debt, getAllDebtsByUserIdAndDebtorId, getAllDebtsByUserId} from '../../watermelondb/services';
import {selectUserId} from './userIdSlice';

const debtsAdapter = createEntityAdapter<Debt>();

const initialState = debtsAdapter.getInitialState<{allDebts: Debt[]}>({
  allDebts: [],
});

export const fetchDebtsByDebtor = createAsyncThunk<Debt[], string, {state: RootState; rejectValue: string}>(
  'debt/fetchByDebtor',
  async (debtorId: string, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const debts = await getAllDebtsByUserIdAndDebtorId(userId, debtorId);
      return debts;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch debts');
    }
  },
);

export const fetchAllDebts = createAsyncThunk<Debt[], void, {state: RootState; rejectValue: string}>(
  'debt/fetchAll',
  async (_, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      // getAllDebtsByUserId returns plain debts; the old DebtWithDebtor cast
      // promised a `debtor` relation that was never populated or read.
      return await getAllDebtsByUserId(userId);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch all debts');
    }
  },
);

const debtDataSlice = createSlice({
  name: 'debt',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchDebtsByDebtor.fulfilled, (state, action) => {
        debtsAdapter.setAll(state, action.payload);
      })
      .addCase(fetchAllDebts.fulfilled, (state, action) => {
        state.allDebts = action.payload;
      });
  },
});

const debtSelectors = debtsAdapter.getSelectors<RootState>(state => state.debt);

export const selectDebtData = debtSelectors.selectAll;

export const selectAllDebts = (state: RootState) => state.debt.allDebts;

export default debtDataSlice.reducer;
