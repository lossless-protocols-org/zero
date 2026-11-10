import {formatDisplayDate} from '../../../../platform/dateFormat';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import type {RouteProp} from '@react-navigation/native';
import {useFreshWhileFocused} from '../../../../ui/hooks/useFreshWhileFocused';
import {useCallback, useMemo} from 'react';
import {fetchEverydayExpenses, selectFilteredPeriod} from '../../../../store/slices/expenseDataSlice';
import type {HomeStackParamList} from '../../../../navigation/types';
import {netSpent} from '../../../../domain/periodMath';

export type EverydayTransactionRouteProp = RouteProp<HomeStackParamList, 'EverydayTransactionScreen'>;

export const useEverydayTransaction = (route: EverydayTransactionRouteProp) => {
  const dispatch = useAppDispatch();
  const expenseDate = route.params.isDate;
  // This day's rows only: until they land, nothing rather than the category screen's (one shared slot).
  const {
    expenses: allEverydayTransactions,
    refunds,
    refundedByExpense,
  } = useAppSelector(state => selectFilteredPeriod(state, {kind: 'day', date: expenseDate}));
  const formattedDate = formatDisplayDate(expenseDate, 'date');
  const colors = useThemeColors();

  useFreshWhileFocused(
    useCallback(() => {
      void dispatch(fetchEverydayExpenses(expenseDate));
    }, [dispatch, expenseDate]),
    ['expenses', 'refunds', 'categories'],
  );

  // Net of those refunds (R2).
  const totalAmountForTheDay = useMemo(
    () => netSpent(allEverydayTransactions, refunds),
    [allEverydayTransactions, refunds],
  );

  return {
    refunds,
    refundedByExpense,
    formattedDate,
    colors,
    expenseDate,
    allEverydayTransactions,
    totalAmountForTheDay,
  };
};
