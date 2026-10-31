import {useCallback, useEffect, useMemo, useState} from 'react';
import useThemeColors from '../../hooks/useThemeColors';
import useMonthNavigation from '../../hooks/useMonthNavigation';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {fetchExpensesByMonth, selectExpenseData, selectMonthTotals} from '../../redux/slice/expenseDataSlice';
import {useUserName} from '../../hooks/useUserName';
import {fetchUserData, selectUserId} from '../../redux/slice/userIdSlice';
import {fetchCurrency} from '../../redux/slice/currencyDataSlice';
import {fetchCategories} from '../../redux/slice/categoryDataSlice';
import {fetchBudgetsByMonth, selectCurrentBudget} from '../../redux/slice/budgetDataSlice';
import {daysInMonth as countDaysInMonth, sortByDateDesc, formatDate} from '../../utils/dateUtils';
import {loadAvailableYears} from '../../watermelondb/services/availableYearsCache';
import {useFocusEffect} from '@react-navigation/native';
import {logRejection} from '../../utils/errorLog';

const useHome = () => {
  const colors = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const {
    selectedMonthIndex,
    selectedYear,
    selectedMonthName,
    yearMonth,
    isCurrentMonth,
    currentYear,
    canGoForward,
    handleMonthYearSelect,
    shiftMonth,
  } = useMonthNavigation();
  const [availableYears, setAvailableYears] = useState<number[]>(() => [currentYear]);

  const dispatch = useAppDispatch();

  const allTransactions = useAppSelector(selectExpenseData);
  const sortedTransactions = useMemo(() => sortByDateDesc(allTransactions), [allTransactions]);

  const {userName} = useUserName();
  const userId = useAppSelector(selectUserId);

  useEffect(() => {
    void dispatch(fetchUserData());
  }, [dispatch]);

  useEffect(() => {
    if (userId) {
      void dispatch(fetchCurrency());
      void dispatch(fetchCategories());
      logRejection(
        loadAvailableYears(userId).then(years => {
          if (years.length > 0) {
            setAvailableYears(years);
          }
        }),
      );
    }
  }, [dispatch, userId]);

  // The month is refetched on EVERY focus deliberately: rows carry joined
  // category name/icon/colour and the currency, which other screens edit
  // (Categories tab, Settings) with no hook into this slice. One indexed month
  // query per focus is cheaper than a stale label.
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        void dispatch(fetchExpensesByMonth(yearMonth));
        void dispatch(fetchBudgetsByMonth(yearMonth));
      }
    }, [dispatch, userId, yearMonth]),
  );

  const currentBudget = useAppSelector(state => selectCurrentBudget(state, yearMonth));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  useEffect(() => {
    if (!refreshing) return;

    void dispatch(fetchExpensesByMonth(yearMonth)).finally(() => {
      setRefreshing(false);
    });
  }, [dispatch, refreshing, yearMonth]);

  const monthTotals = useAppSelector(state => selectMonthTotals(state, formatDate(new Date(), 'YYYY-MM-DD')));
  const totalSpent = monthTotals.total;
  const transactionCount = monthTotals.count;
  const todayTotal = isCurrentMonth ? monthTotals.today : 0;

  const daysInMonth = countDaysInMonth(selectedYear, selectedMonthIndex);

  return {
    colors,
    refreshing,
    allTransactions,
    userName,
    userId,
    onRefresh,
    sortedTransactions,
    selectedYear,
    selectedMonthIndex,
    selectedMonthName,
    yearMonth,
    availableYears,
    totalSpent,
    transactionCount,
    todayTotal,
    isCurrentMonth,
    canGoForward,
    daysInMonth,
    currentBudget,
    handleMonthYearSelect,
    shiftMonth,
  };
};

export default useHome;
