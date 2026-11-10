import {useCallback, useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {fetchExpensesByMonth, selectMonthTotals} from '../../store/slices/expenseDataSlice';
import {fetchIncomesByMonth, selectReceived} from '../../store/slices/incomeDataSlice';
import {fetchBudgetsByMonth, selectCurrentBudget} from '../../store/slices/budgetDataSlice';
import {selectUserId} from '../../store/slices/userIdSlice';
import {daysInMonth, formatDate} from '../../domain/dates';
import {budgetStatus} from '../../domain/budgetMath';
import {formatDisplayDate} from '../../platform/dateFormat';
import {useMonthNavigation} from './useMonthNavigation';
import {useFreshWhileFocused} from './useFreshWhileFocused';
import type {WatchedTable} from '../../data/services/tableChanges';

/** What a month's figures are read from: rows, refunds, money in, budgets, and the category names joined onto rows. */
const MONTH_TABLES: readonly WatchedTable[] = ['expenses', 'refunds', 'incomes', 'budgets', 'categories'];
import {takeMonthLoadedAtStart} from '../../store/startSession';
import {useAvailableYears} from './useAvailableYears';

/**
 * The month Home and Reports show, and how it stands: one hook for what both
 * screens built (audit 2026-11-08 §5). Groups, memoised, so a screen can memo
 * on them:
 * - `month`: which month, stepping and picking it;
 * - `totals`: spent (net of refunds, R2), entries, today's part, money back, money in;
 * - `budget`: the month against its budget (domain/budgetMath.budgetStatus), or null.
 *
 * Reads the month's expenses, budgets and money in on focus, and again after
 * any write to what they come from while the screen is focused
 * (useFreshWhileFocused): rows carry joined category names, which other
 * screens edit. The one exception is the first focus after a cold start,
 * when App has just loaded this month (store/startSession).
 */
export const useMonthView = () => {
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const nav = useMonthNavigation();
  const availableYears = useAvailableYears();
  const {yearMonth, isCurrentMonth, selectedYear, selectedMonthIndex} = nav;

  useFreshWhileFocused(
    useCallback(() => {
      if (userId && !takeMonthLoadedAtStart(yearMonth)) {
        void dispatch(fetchExpensesByMonth(yearMonth));
        void dispatch(fetchBudgetsByMonth(yearMonth));
        void dispatch(fetchIncomesByMonth(yearMonth));
      }
    }, [dispatch, userId, yearMonth]),
    MONTH_TABLES,
  );

  // Today's key once per render, not inside the selector (it ran dayjs on every store dispatch).
  const today = formatDate(new Date(), 'YYYY-MM-DD');
  const monthTotals = useAppSelector(state => selectMonthTotals(state, yearMonth, today));
  const received = useAppSelector(state => selectReceived(state, yearMonth));
  const budgetAmount = useAppSelector(state => selectCurrentBudget(state, yearMonth))?.amount;

  const todaySpent = isCurrentMonth ? monthTotals.today : 0;
  const totals = useMemo(
    () => ({
      spent: monthTotals.total,
      count: monthTotals.count,
      today: todaySpent,
      refunded: monthTotals.refunded,
      received,
    }),
    [monthTotals, todaySpent, received],
  );

  // Read now, not at import: "today" moves at midnight.
  const dayOfMonth = new Date().getDate();
  const days = daysInMonth(selectedYear, selectedMonthIndex);
  const budget = useMemo(
    () =>
      budgetAmount === undefined
        ? null
        : budgetStatus({
            budget: budgetAmount,
            spent: totals.spent,
            spentToday: totals.today,
            dayOfMonth,
            daysInMonth: days,
            isCurrentMonth,
          }),
    [budgetAmount, totals, dayOfMonth, days, isCurrentMonth],
  );

  const month = useMemo(
    () => ({
      name: nav.selectedMonthName,
      /** "November 2026" in the locale's own order (never name and year joined here). */
      label: formatDisplayDate(`${yearMonth}-01`, 'monthYearLong'),
      index: selectedMonthIndex,
      year: selectedYear,
      yearMonth,
      days,
      isCurrent: isCurrentMonth,
      canGoForward: nav.canGoForward,
      availableYears,
      select: nav.handleMonthYearSelect,
      shift: nav.shiftMonth,
    }),
    [
      // selectedMonthName also changes with the language, which the label follows.
      nav.selectedMonthName,
      selectedMonthIndex,
      selectedYear,
      yearMonth,
      days,
      isCurrentMonth,
      nav.canGoForward,
      availableYears,
      nav.handleMonthYearSelect,
      nav.shiftMonth,
    ],
  );

  return {month, totals, budget};
};
