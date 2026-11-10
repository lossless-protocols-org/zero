import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import type {RouteProp} from '@react-navigation/native';
import {useFreshWhileFocused} from '../../../../ui/hooks/useFreshWhileFocused';
import {useCallback, useMemo} from 'react';
import {fetchExpensesByCategory, selectFilteredPeriod} from '../../../../store/slices/expenseDataSlice';
import type {HomeStackParamList} from '../../../../navigation/types';
import {DEFAULTS} from '../../../../domain/sanitize';
import {netSpent} from '../../../../domain/periodMath';
import {selectCategoryData} from '../../../../store/slices/categoryDataSlice';
import {formatDate} from '../../../../domain/dates';
import {useTranslation} from 'react-i18next';
import {displayCategoryName} from '../../../../i18n/displayNames';

export type CategoryTransactionRouteProp = RouteProp<HomeStackParamList, 'CategoryTransactionScreen'>;

export const useCategoryTransaction = (route: CategoryTransactionRouteProp) => {
  const dispatch = useAppDispatch();
  const colors = useThemeColors();
  const {t} = useTranslation();

  const {categoryId, yearMonth} = route.params;
  // This category's month only: until it lands, nothing rather than the day screen's rows (one shared slot).
  const {
    expenses: transactions,
    refunds,
    refundedByExpense,
  } = useAppSelector(state => selectFilteredPeriod(state, {kind: 'category', categoryId, yearMonth}));
  // Name, colour and icon come from the store, not the route, so an edit made
  // meanwhile shows here (M19). The list holds soft-deleted categories too.
  const category = useAppSelector(state => selectCategoryData(state).find(c => c.id === categoryId));
  const categoryName = category ? displayCategoryName(category.name, t) : '';
  const categoryColor = category?.color ?? DEFAULTS.color;
  const categoryIcon = category?.icon;
  const monthLabel = formatDate(`${yearMonth}-01`, 'MMMM YYYY');

  useFreshWhileFocused(
    useCallback(() => {
      void dispatch(fetchExpensesByCategory({categoryId, yearMonth}));
    }, [dispatch, categoryId, yearMonth]),
    ['expenses', 'refunds', 'categories'],
  );

  // Net of those refunds (R2).
  const totalAmount = useMemo(() => netSpent(transactions, refunds), [transactions, refunds]);

  return {
    refunds,
    refundedByExpense,
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
