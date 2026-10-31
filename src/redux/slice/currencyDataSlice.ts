import {createAsyncThunk, createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {getCurrencyByUserId} from '../../watermelondb/services';
import {selectUserId} from './userIdSlice';

interface CurrencyState {
  currencyId: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
}

const initialState: CurrencyState = {
  currencyId: '',
  currencyName: '',
  currencyCode: '',
  currencySymbol: '',
};

export const fetchCurrency = createAsyncThunk<CurrencyState | null, void, {state: RootState; rejectValue: string}>(
  'currency/fetch',
  async (_, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const currency = await getCurrencyByUserId(userId);
      if (currency) {
        return {
          currencyId: String(currency.id),
          currencyName: currency.name,
          currencySymbol: currency.symbol,
          currencyCode: currency.code,
        };
      }
      return null;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch currency');
    }
  },
);

const currencyDataSlice = createSlice({
  name: 'currencyData',
  initialState,
  reducers: {
    setCurrencyData: (state, action: PayloadAction<CurrencyState>) => {
      state.currencyId = action.payload.currencyId;
      state.currencyName = action.payload.currencyName;
      state.currencyCode = action.payload.currencyCode;
      state.currencySymbol = action.payload.currencySymbol;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchCurrency.fulfilled, (state, action) => {
      if (action.payload) {
        state.currencyId = action.payload.currencyId;
        state.currencyName = action.payload.currencyName;
        state.currencySymbol = action.payload.currencySymbol;
        state.currencyCode = action.payload.currencyCode;
      }
    });
  },
});

export const selectCurrencyId = (state: RootState) => state.currencyData.currencyId;
export const selectCurrencyName = (state: RootState) => state.currencyData.currencyName;
export const selectCurrencyCode = (state: RootState) => state.currencyData.currencyCode;
export const selectCurrencySymbol = (state: RootState) => state.currencyData.currencySymbol;

export const {setCurrencyData} = currencyDataSlice.actions;

export default currencyDataSlice.reducer;
