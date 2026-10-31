import {createAsyncThunk, createEntityAdapter, createSelector, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {CategoryData as Category, getAllCategoriesByUserId} from '../../watermelondb/services';
import {selectUserId} from './userIdSlice';

const categoriesAdapter = createEntityAdapter<Category>();

const initialState = categoriesAdapter.getInitialState();

export const fetchCategories = createAsyncThunk<Category[], void, {state: RootState; rejectValue: string}>(
  'category/fetchAll',
  async (_, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const categories = await getAllCategoriesByUserId(userId);
      return categories;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch categories');
    }
  },
);

const categoryDataSlice = createSlice({
  name: 'category',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(fetchCategories.fulfilled, (state, action) => {
      categoriesAdapter.setAll(state, action.payload);
    });
  },
});

const categorySelectors = categoriesAdapter.getSelectors<RootState>(state => state.category);

export const selectCategoryData = categorySelectors.selectAll;

export const selectActiveCategories = createSelector([selectCategoryData], categoryData =>
  categoryData.filter((category: Category) => category.categoryStatus === true),
);

export default categoryDataSlice.reducer;
