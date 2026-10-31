import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {DebtorData as DebtorDocType, getDebtorByDebtorId} from '../../watermelondb/services';

interface IndividualDebtorState {
  individualDebtorData: DebtorDocType | null;
}

const initialState: IndividualDebtorState = {
  individualDebtorData: null,
};

export const fetchIndividualDebtor = createAsyncThunk<
  DebtorDocType | null,
  string,
  {state: RootState; rejectValue: string}
>('individualDebtor/fetchById', async (debtorId: string, {rejectWithValue}) => {
  try {
    const debtor = await getDebtorByDebtorId(debtorId);
    return debtor;
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch debtor');
  }
});

const individualDebtorSlice = createSlice({
  name: 'individualDebtor',
  initialState,
  reducers: {
    clearIndividualDebtor: state => {
      state.individualDebtorData = null;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchIndividualDebtor.fulfilled, (state, action) => {
      state.individualDebtorData = action.payload;
    });
  },
});

export const selectIndividualDebtorData = (state: RootState) => state.individualDebtor.individualDebtorData;

export const {clearIndividualDebtor} = individualDebtorSlice.actions;

export default individualDebtorSlice.reducer;
