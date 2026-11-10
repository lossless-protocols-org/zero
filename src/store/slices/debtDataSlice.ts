import {createAsyncThunk, createEntityAdapter, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {DebtData as Debt} from '../../domain/types';
import {getAllDebtsByUserIdAndDebtorId, getAllDebtsByUserId} from '../../data/services/debtService';
import {selectUserId} from './userIdSlice';

const debtsAdapter = createEntityAdapter<Debt>();

/**
 * One debtor's debts (the entities) and everyone's (`allDebts`). Each keeps
 * only its newest request's answer: opening one person and then another, or a
 * refetch after a write racing the focus fetch, could otherwise let an older,
 * slower read land last (audit 2026-11-08 §3.11).
 */
const initialState = debtsAdapter.getInitialState<{
  allDebts: Debt[];
  /** Whose debts the entities are; null before the first answer. */
  debtorId: string | null;
  debtorRequestId: string | null;
  allRequestId: string | null;
}>({
  allDebts: [],
  debtorId: null,
  debtorRequestId: null,
  allRequestId: null,
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
      .addCase(fetchDebtsByDebtor.pending, (state, action) => {
        state.debtorRequestId = action.meta.requestId;
      })
      .addCase(fetchDebtsByDebtor.fulfilled, (state, action) => {
        if (state.debtorRequestId === action.meta.requestId) {
          debtsAdapter.setAll(state, action.payload);
          state.debtorId = action.meta.arg;
        }
      })
      .addCase(fetchDebtsByDebtor.rejected, (state, action) => {
        // Nothing, never the previous person's debts under this one's name;
        // thunkRejectionMiddleware surfaces the failure.
        if (state.debtorRequestId === action.meta.requestId) {
          debtsAdapter.removeAll(state);
          state.debtorId = action.meta.arg;
        }
      })
      .addCase(fetchAllDebts.pending, (state, action) => {
        state.allRequestId = action.meta.requestId;
      })
      .addCase(fetchAllDebts.fulfilled, (state, action) => {
        if (state.allRequestId === action.meta.requestId) {
          state.allDebts = action.payload;
        }
      })
      .addCase(fetchAllDebts.rejected, (state, action) => {
        // No total, rather than an older one under the "couldn't load" banner (as a failed month).
        if (state.allRequestId === action.meta.requestId) {
          state.allDebts = [];
        }
      });
  },
});

const debtSelectors = debtsAdapter.getSelectors<RootState>(state => state.debt);

const NO_DEBTS: Debt[] = [];

/** `debtorId`'s debts, or none while another person's are still loaded. */
export const selectDebtsOf = (state: RootState, debtorId: string): Debt[] =>
  state.debt.debtorId === debtorId ? debtSelectors.selectAll(state) : NO_DEBTS;

export const selectAllDebts = (state: RootState) => state.debt.allDebts;

export const debtReducer = debtDataSlice.reducer;
