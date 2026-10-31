import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {fetchUserData, NO_USER_ROW} from './userIdSlice';

const initialState = {
  userName: '',
};

const userNameSlice = createSlice({
  name: 'userName',
  initialState,
  reducers: {
    setUserName: (state, action: PayloadAction<string>) => {
      state.userName = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchUserData.fulfilled, (state, action) => {
        state.userName = action.payload.userName;
      })
      .addCase(fetchUserData.rejected, (state, action) => {
        if (action.payload === NO_USER_ROW) {
          state.userName = '';
        }
      });
  },
});

export const selectUserName = (state: RootState) => state.userName.userName;

export const {setUserName} = userNameSlice.actions;

export default userNameSlice.reducer;
