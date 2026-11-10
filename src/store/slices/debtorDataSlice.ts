import {createAsyncThunk, createEntityAdapter, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {DebtorData as Debtor} from '../../domain/types';
import {getAllDebtorsByUserId} from '../../data/services/debtorService';
import {selectUserId} from './userIdSlice';

const debtorsAdapter = createEntityAdapter<Debtor>();

const initialState = debtorsAdapter.getInitialState<{requestId: string | null}>({requestId: null});

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
    builder
      .addCase(fetchDebtors.pending, (state, action) => {
        state.requestId = action.meta.requestId; // the newest read wins
      })
      .addCase(fetchDebtors.fulfilled, (state, action) => {
        if (state.requestId === action.meta.requestId) {
          debtorsAdapter.setAll(state, action.payload);
        }
      })
      .addCase(fetchDebtors.rejected, (state, action) => {
        // No one, rather than balances from an older read under the "couldn't load" banner
        // (audit 2026-11-08, Appendix A); thunkRejectionMiddleware surfaces the failure.
        if (state.requestId === action.meta.requestId) {
          debtorsAdapter.removeAll(state);
        }
      });
  },
});

const debtorSelectors = debtorsAdapter.getSelectors<RootState>(state => state.debtor);

export const selectDebtorData = debtorSelectors.selectAll;

export const debtorReducer = debtorDataSlice.reducer;
