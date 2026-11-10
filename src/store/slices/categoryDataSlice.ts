import {createAsyncThunk, createEntityAdapter, createSelector, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '../rootReducer';
import {CategoryData as Category} from '../../domain/types';
import {getAllCategoriesByUserId} from '../../data/services/categoryService';
import {selectUserId} from './userIdSlice';

/**
 * The entity list holds EXPENSE categories (every picker, budget and report
 * reads it); income categories are kept beside it (R5: the two never mix in a
 * list). Both arrive in one fetch, each in the user's order.
 */
const categoriesAdapter = createEntityAdapter<Category>();

interface CategoryExtraState {
  incomeCategories: Category[];
  /** The newest read; an older one that lands later is dropped (reads overlap: focus, the session follower). */
  requestId: string | null;
}

const initialState = categoriesAdapter.getInitialState<CategoryExtraState>({incomeCategories: [], requestId: null});

export const fetchCategories = createAsyncThunk<
  {expense: Category[]; income: Category[]},
  void,
  {state: RootState; rejectValue: string}
>('category/fetchAll', async (_, {getState, rejectWithValue}) => {
  try {
    const userId = selectUserId(getState());
    const [expense, income] = await Promise.all([
      getAllCategoriesByUserId(userId, 'expense'),
      getAllCategoriesByUserId(userId, 'income'),
    ]);
    return {expense, income};
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch categories');
  }
});

const categoryDataSlice = createSlice({
  name: 'category',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchCategories.pending, (state, action) => {
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        if (state.requestId === action.meta.requestId) {
          categoriesAdapter.setAll(state, action.payload.expense);
          state.incomeCategories = action.payload.income;
        }
      });
    // A failed read keeps the categories last read, on purpose (audit 2026-11-08,
    // Appendix A). Unlike a month's figures, they are not a number that could
    // read wrong: they change only through writes, which the session follows,
    // and emptying them would leave every form with no category to pick.
    // thunkRejectionMiddleware surfaces the failure.
  },
});

const categorySelectors = categoriesAdapter.getSelectors<RootState>(state => state.category);

/** Expense categories, active and archived, in the user's order. */
export const selectCategoryData = categorySelectors.selectAll;

export const selectActiveCategories = createSelector([selectCategoryData], categoryData =>
  categoryData.filter((category: Category) => category.categoryStatus === true),
);

/** Income categories, active and archived, in the user's order. */
export const selectIncomeCategories = (state: RootState) => state.category.incomeCategories;

export const selectActiveIncomeCategories = createSelector([selectIncomeCategories], categories =>
  categories.filter(category => category.categoryStatus),
);

export const categoryReducer = categoryDataSlice.reducer;
