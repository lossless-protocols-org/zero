import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import useThemeColors from '../../hooks/useThemeColors';
import useMonthNavigation from '../../hooks/useMonthNavigation';
import useBudgetActions from '../../hooks/useBudgetActions';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  getWeekdayShortNames,
  daysInMonth as countDaysInMonth,
  formatDate,
  formatDisplayDate,
} from '../../utils/dateUtils';
import {useFocusEffect} from '@react-navigation/native';
import {rotateWeekdays, weekStartPreference} from '../../utils/weekStart';
import {fetchExpensesByMonth, selectExpenseData} from '../../redux/slice/expenseDataSlice';
import {selectCurrencyCode, selectCurrencySymbol} from '../../redux/slice/currencyDataSlice';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {fetchBudgetsByMonth, selectCategoryBudgets, selectCurrentBudget} from '../../redux/slice/budgetDataSlice';
import {fetchCategories} from '../../redux/slice/categoryDataSlice';
import {loadAvailableYears} from '../../watermelondb/services/availableYearsCache';
import {logRejection} from '../../utils/errorLog';
import {sumAmounts} from '../../utils/numberUtils';
import {usePreference} from '../../hooks/usePreference';

const useReports = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
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

  const filteredTransactions = useAppSelector(selectExpenseData);
  const currencySymbol = useAppSelector(selectCurrencySymbol);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const categoryBudgets = useAppSelector(state => selectCategoryBudgets(state, yearMonth));

  // Subscribed: this screen stays mounted while Settings changes the option.
  const weekStart = usePreference(weekStartPreference);
  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchCategories());
    }, [dispatch]),
  );
  const dayNames = useMemo(() => rotateWeekdays(getWeekdayShortNames(), weekStart), [weekStart]);
  const userId = useAppSelector(selectUserId);

  useEffect(() => {
    if (userId) {
      logRejection(
        loadAvailableYears(userId).then(years => {
          if (years.length > 0) {
            setAvailableYears(years);
          }
        }),
      );
    }
  }, [userId]);

  // On focus, as Home does: the expense and budget slices hold one month for
  // every screen, so another screen may have replaced this one's meanwhile.
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        void dispatch(fetchExpensesByMonth(yearMonth));
        void dispatch(fetchBudgetsByMonth(yearMonth));
      }
    }, [dispatch, userId, yearMonth]),
  );

  const currentBudget = useAppSelector(state => selectCurrentBudget(state, yearMonth));

  const totalAmountForMonth = useMemo(() => sumAmounts(filteredTransactions ?? []), [filteredTransactions]);

  const daysInMonth = countDaysInMonth(selectedYear, selectedMonthIndex);

  const todayTotal = useMemo(() => {
    if (!isCurrentMonth) {
      return 0;
    }
    const todayStr = formatDate(new Date(), 'YYYY-MM-DD');
    return (filteredTransactions ?? []).reduce(
      (sum: number, t) => (t.date.startsWith(todayStr) ? sum + t.amount : sum),
      0,
    );
  }, [filteredTransactions, isCurrentMonth]);

  const monthLabel = `${selectedMonthName} ${selectedYear}`;
  // The header pill shares its row with two stat tiles: "Oct 2026", in the locale's form.
  const shortMonthLabel = formatDisplayDate(`${yearMonth}-01`, 'monthYear');
  const {handleBudgetSave, handleBudgetRemove} = useBudgetActions(yearMonth, monthLabel);

  return {
    colors,
    selectedYear,
    selectedMonthIndex,
    monthLabel,
    shortMonthLabel,
    yearMonth,
    filteredTransactions,
    currencySymbol,
    currencyCode,
    dayNames,
    weekStart,
    availableYears,
    handleMonthYearSelect,
    shiftMonth,
    canGoForward,
    totalAmountForMonth,
    daysInMonth,
    todayTotal,
    isCurrentMonth,
    currentBudget,
    categoryBudgets,
    handleBudgetSave,
    handleBudgetRemove,
  };
};

export default useReports;
