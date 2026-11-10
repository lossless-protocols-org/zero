import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {DebtorData as DebtorDocType} from '../../domain/types';
import {getDebtorByDebtorId} from '../../data/services/debtorService';

interface IndividualDebtorState {
  individualDebtorData: DebtorDocType | null;
  /** The newest read; an older one that lands later is dropped. */
  requestId: string | null;
}

const initialState: IndividualDebtorState = {
  individualDebtorData: null,
  requestId: null,
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
    builder
      .addCase(fetchIndividualDebtor.pending, (state, action) => {
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchIndividualDebtor.fulfilled, (state, action) => {
        if (state.requestId === action.meta.requestId) {
          state.individualDebtorData = action.payload;
        }
      })
      .addCase(fetchIndividualDebtor.rejected, (state, action) => {
        // No header rather than another person's (thunkRejectionMiddleware surfaces the failure).
        if (state.requestId === action.meta.requestId) {
          state.individualDebtorData = null;
        }
      });
  },
});

export const selectIndividualDebtorData = (state: RootState) => state.individualDebtor.individualDebtorData;

export const {clearIndividualDebtor} = individualDebtorSlice.actions;

export const individualDebtorReducer = individualDebtorSlice.reducer;
