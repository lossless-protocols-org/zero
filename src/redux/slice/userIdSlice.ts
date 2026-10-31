import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {getAllUsers} from '../../watermelondb/services';

/** rejectWithValue payload when the users table is empty (M2). */
export const NO_USER_ROW = 'No user row';

interface UserState {
  userId: string;
}

const initialState: UserState = {
  userId: '',
};

interface UserData {
  userId: string;
  userName: string;
  userEmail: string;
}

export const fetchUserData = createAsyncThunk<UserData, void, {state: RootState; rejectValue: string}>(
  'user/fetchData',
  async (_, {rejectWithValue}) => {
    try {
      const users = await getAllUsers();
      const user = users[0];
      if (!user) {
        // Running on as `user_id = ''` wrote rows no per-user query can see
        // and an unrestorable backup (M2, v2.7.1); thunkRejectionMiddleware
        // logs and surfaces this rejection.
        return rejectWithValue(NO_USER_ROW);
      }
      return {
        userId: String(user.id),
        userName: user.username,
        userEmail: user.email,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch user data');
    }
  },
);

const userIdSlice = createSlice({
  name: 'userId',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchUserData.fulfilled, (state, action) => {
        state.userId = action.payload.userId;
      })
      .addCase(fetchUserData.rejected, (state, action) => {
        // The row is gone: a stale id would let writers create rows no
        // future user can see. Other failures keep the last known id.
        if (action.payload === NO_USER_ROW) {
          state.userId = '';
        }
      });
  },
});

export const selectUserId = (state: RootState) => state.userId.userId;

export default userIdSlice.reducer;
