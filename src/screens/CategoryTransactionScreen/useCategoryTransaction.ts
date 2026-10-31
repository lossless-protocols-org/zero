import useThemeColors from '../../hooks/useThemeColors';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {RouteProp, useFocusEffect} from '@react-navigation/native';
import {useCallback, useMemo} from 'react';
import {fetchExpensesByCategory, selectFilterKey, selectFilteredExpenses} from '../../redux/slice/expenseDataSlice';
import type {HomeStackParamList} from '../../navigation/types';
import {DEFAULTS} from '../../utils/sanitize';
import {sumAmounts} from '../../utils/numberUtils';
import {selectCategoryData} from '../../redux/slice/categoryDataSlice';
import {formatDate} from '../../utils/dateUtils';
import {useTranslation} from 'react-i18next';
import {displayCategoryName} from '../../i18n/displayNames';

export type CategoryTransactionRouteProp = RouteProp<HomeStackParamList, 'CategoryTransactionScreen'>;

const useCategoryTransaction = (route: CategoryTransactionRouteProp) => {
  const dispatch = useAppDispatch();
  const filteredExpenses = useAppSelector(selectFilteredExpenses);
  const filterKey = useAppSelector(selectFilterKey);
  const colors = useThemeColors();
  const {t} = useTranslation();

  const {categoryId, yearMonth} = route.params;
  // Name, colour and icon come from the store, not the route, so an edit made
  // meanwhile shows here (M19). The list holds soft-deleted categories too.
  const category = useAppSelector(state => selectCategoryData(state).find(c => c.id === categoryId));
  const categoryName = category ? displayCategoryName(category.name, t) : '';
  const categoryColor = category?.color ?? DEFAULTS.color;
  const categoryIcon = category?.icon;
  const monthLabel = formatDate(`${yearMonth}-01`, 'MMMM YYYY');

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchExpensesByCategory({categoryId, yearMonth}));
    }, [dispatch, categoryId, yearMonth]),
  );

  /**
   * Same shared-slot problem as EverydayTransactionScreen: until the store's
   * `filterKey` matches the category+month we asked for, the rows in it belong
   * to whichever screen ran last. Render nothing rather than someone else's
   * expenses. (The slice wrote this key from the start; nothing read it.)
   */
  const transactions = useMemo(
    () => (filterKey === `${categoryId}:${yearMonth}` ? filteredExpenses : []),
    [filterKey, categoryId, yearMonth, filteredExpenses],
  );

  const totalAmount = useMemo(() => sumAmounts(transactions), [transactions]);

  return {
    colors,
    transactions,
    totalAmount,
    categoryName,
    categoryColor,
    categoryIcon,
    monthLabel,
    categoryId,
    yearMonth,
  };
};

export default useCategoryTransaction;
