import {useCallback, useEffect, useState} from 'react';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useMonthView} from '../../../../ui/hooks/useMonthView';
import {useUserName} from '../../../../ui/hooks/useUserName';
import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import {
  fetchExpensesByMonth,
  selectExpenseData,
  selectMonthRefunds,
  selectRefundedByExpense,
} from '../../../../store/slices/expenseDataSlice';

/**
 * Home: the month (useMonthView: which month, its totals and budget), the
 * month's list, and pull-to-refresh. Grouped by what the screen draws; it
 * returned 24 flat fields, some never read (audit 2026-11-08 §5). The session
 * (user, currency, categories) is loaded by the app shell
 * (store/bootstrapSession), not here.
 */
export const useHome = () => {
  const dispatch = useAppDispatch();
  const {userName} = useUserName();
  const {month, totals, budget} = useMonthView();
  const {yearMonth} = month;

  // The shown month's own slot: another month fetched elsewhere never lands here.
  const transactions = useAppSelector(state => selectExpenseData(state, yearMonth));
  const refunds = useAppSelector(state => selectMonthRefunds(state, yearMonth));
  const refundedByExpense = useAppSelector(state => selectRefundedByExpense(state, yearMonth));

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);
  useEffect(() => {
    if (!refreshing) {
      return;
    }
    void dispatch(fetchExpensesByMonth(yearMonth)).finally(() => {
      setRefreshing(false);
    });
  }, [dispatch, refreshing, yearMonth]);

  return {
    colors: useThemeColors(),
    userName,
    refresh: {refreshing, onRefresh},
    month,
    totals,
    budget,
    // In stored order: TransactionList orders and groups them (listSort.arrangeRows), once.
    list: {transactions, refunds, refundedByExpense},
  };
};
