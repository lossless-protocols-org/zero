import {createAsyncThunk, createEntityAdapter, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {DebtorData as Debtor, getAllDebtorsByUserId} from '../../watermelondb/services';
import {selectUserId} from './userIdSlice';

const debtorsAdapter = createEntityAdapter<Debtor>();

const initialState = debtorsAdapter.getInitialState();

export const fetchDebtors = createAsyncThunk<Debtor[], void, {state: RootState; rejectValue: string}>(
  'debtor/fetchAll',
  async (_, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const debtors = await getAllDebtorsByUserId(userId);
      return debtors;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch debtors');
    }
  },
);

const debtorDataSlice = createSlice({
  name: 'debtor',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(fetchDebtors.fulfilled, (state, action) => {
      debtorsAdapter.setAll(state, action.payload);
    });
  },
});

const debtorSelectors = debtorsAdapter.getSelectors<RootState>(state => state.debtor);

export const selectDebtorData = debtorSelectors.selectAll;

export default debtorDataSlice.reducer;
