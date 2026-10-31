import {useCallback, useEffect, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../redux/hooks';
import {selectUserId} from '../redux/slice/userIdSlice';
import {selectCurrencyCode} from '../redux/slice/currencyDataSlice';
import {fetchCategories, selectActiveCategories} from '../redux/slice/categoryDataSlice';
import {fetchExpensesByMonth} from '../redux/slice/expenseDataSlice';
import {createExpense, updateExpenseById, type CategoryData, type ExpenseWithCategory} from '../watermelondb/services';
import {ensureYearInCache} from '../watermelondb/services/availableYearsCache';
import {createAmountSchema, expenseDescriptionSchema, expenseSchema} from '../i18n/validationSchema';
import {formatDate, getISODateTime} from '../utils/dateUtils';
import {goBack} from '../utils/navigationUtils';
import {useReportSaveFailure} from './useReportFailure';

/** The transaction being edited, as read from the database (M19). */
export type EditedExpense = ExpenseWithCategory;

/**
 * Re-selects the expense's category by id. Never by name: a soft-deleted
 * category is not in the active list, and matching a same-named active one
 * would move the expense on save without the user choosing it.
 */
const matchCategory = (categories: CategoryData[], target: {id: string} | undefined): CategoryData[] => {
  const match = target ? categories.find(category => category.id === target.id) : undefined;
  return match ? [match] : [];
};

/** State and save for the add/edit transaction form; `editing` absent = add. */
export const useExpenseForm = (editing?: EditedExpense) => {
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const categories = useAppSelector(selectActiveCategories);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<CategoryData[]>(
    editing ? matchCategory(categories, editing.category) : [],
  );
  const [createdAt, setCreatedAt] = useState(editing?.date ?? getISODateTime());
  const [expenseTitle, setExpenseTitle] = useState(editing?.title ?? '');
  const [expenseDescription, setExpenseDescription] = useState(editing?.description ?? '');
  const [expenseAmount, setExpenseAmount] = useState(editing ? String(editing.amount) : '');

  // Limits follow the currency: a yen has no decimals, COP amounts run into
  // the millions. A flat 1,000,000 cap blocked ordinary expenses (B6).
  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const expenseAmountError = hasInteracted ? amountSchema.safeParse(Number(expenseAmount)).error?.issues || [] : [];
  const isValid =
    expenseSchema.safeParse(expenseTitle).success &&
    expenseDescriptionSchema.safeParse(expenseDescription).success &&
    amountSchema.safeParse(Number(expenseAmount)).success;

  useEffect(() => {
    void dispatch(fetchCategories());
  }, [dispatch]);

  // In edit mode the initial state above runs before the category slice is
  // populated, which would leave the expense looking uncategorised (and the
  // Update button disabled). Re-sync once the categories actually arrive.
  const editingCategory = editing?.category;
  useEffect(() => {
    if (!editingCategory) {
      return;
    }
    setSelectedCategories(current => {
      if (current.length > 0) {
        return current;
      }
      const match = matchCategory(categories, editingCategory);
      return match.length ? match : current;
    });
  }, [editingCategory, categories]);

  // Gates validation errors: don't flag an amount until the user has left the
  // field, so "0." mid-typing doesn't render as an error.
  const handleAmountBlur = useCallback(() => {
    setHasInteracted(true);
  }, []);

  // A failed save used to be visible only in a __DEV__ console — in production
  // the tap did nothing and the user had no idea whether anything was stored (B5).
  const reportSaveFailure = useReportSaveFailure('transaction.saveFailed');

  const save = useCallback(async () => {
    const category = selectedCategories[0];
    if (!isValid || !category) {
      return;
    }
    try {
      if (editing) {
        await updateExpenseById(
          editing.id,
          category.id,
          expenseTitle,
          Number(expenseAmount),
          expenseDescription,
          createdAt,
        );
      } else {
        await createExpense(userId, expenseTitle, Number(expenseAmount), expenseDescription, category.id, createdAt);
      }
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    ensureYearInCache(userId, Number.parseInt(formatDate(createdAt, 'YYYY'), 10));
    await dispatch(fetchExpensesByMonth(formatDate(createdAt, 'YYYY-MM')));
    goBack();
  }, [
    isValid,
    selectedCategories,
    editing,
    userId,
    expenseTitle,
    expenseAmount,
    expenseDescription,
    createdAt,
    dispatch,
    reportSaveFailure,
  ]);

  const toggleCategorySelection = useCallback((category: CategoryData) => {
    // Compare by id, not object identity: fetchCategories() replaces the array
    // with fresh objects, and reference equality would then fail to deselect.
    setSelectedCategories(current => (current.some(selected => selected.id === category.id) ? [] : [category]));
  }, []);

  return {
    categories,
    selectedCategories,
    toggleCategorySelection,
    createdAt,
    setCreatedAt,
    expenseTitle,
    setExpenseTitle,
    expenseDescription,
    setExpenseDescription,
    expenseAmount,
    setExpenseAmount,
    expenseAmountError,
    handleAmountBlur,
    isValid,
    save,
  };
};
