import {useCallback, useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {fetchExpensesByMonth, selectMonthTotals} from '../../store/slices/expenseDataSlice';
import {fetchIncomesByMonth, selectReceived} from '../../store/slices/incomeDataSlice';
import {fetchBudgetsByMonth, selectCurrentBudget} from '../../store/slices/budgetDataSlice';
import {selectUserId} from '../../store/slices/userIdSlice';
import {formatDate} from '../../domain/dates';
import {dayNumberIn, daysIn, periodFor} from '../../domain/period';
import {budgetStatus} from '../../domain/budgetMath';
import {useCommitments} from './useCommitments';
import {useProFeature} from './useProFeature';
import {formatMonthLabel} from '../../platform/dateFormat';
import {useMonthStartDay} from './useMonthStartDay';
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
  // The days this month covers: the calendar month, or from the user's month start day (P11).
  const monthStartDay = useMonthStartDay();
  const period = useMemo(() => periodFor(yearMonth, monthStartDay), [yearMonth, monthStartDay]);

  useFreshWhileFocused(
    useCallback(() => {
      if (userId && !takeMonthLoadedAtStart(yearMonth)) {
        void dispatch(fetchExpensesByMonth(yearMonth));
        void dispatch(fetchBudgetsByMonth(yearMonth));
        void dispatch(fetchIncomesByMonth(yearMonth));
      }
      // monthStartDay: the same key covers other days once the day changes, so the month is read again.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, userId, yearMonth, monthStartDay]),
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

  // Read now, not at import: "today" moves at midnight. Counted from the month's first day,
  // whichever day of the calendar that is.
  const dayOfMonth = dayNumberIn(period, today);
  const days = daysIn(period);
  // Pro: recurring expenses still to come this month are not free to spend (UX revamp v2).
  const recurringOn = useProFeature('recurring');
  const {bills} = useCommitments(recurringOn && isCurrentMonth && budgetAmount !== undefined);
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
            billsStillDue: bills,
          }),
    [budgetAmount, totals, dayOfMonth, days, isCurrentMonth, bills],
  );

  const month = useMemo(
    () => ({
      name: nav.selectedMonthName,
      /** "November 2026" in the locale's own order, or "7 Nov – 6 Dec" when months start on another day. */
      label: formatMonthLabel(period),
      /** The days the month covers, `[start, next)`. */
      period,
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
      period,
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
