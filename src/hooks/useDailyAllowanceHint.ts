import {useEffect, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../redux/hooks';
import {selectUserId} from '../redux/slice/userIdSlice';
import {fetchBudgetsByMonth, selectCurrentBudget} from '../redux/slice/budgetDataSlice';
import {getAllExpensesByMonth} from '../watermelondb/services';
import {computeDailyAllowance} from '../utils/budgetMath';
import {formatDate, getDaysInMonthByYearMonth} from '../utils/dateUtils';
import {appendErrorLog} from '../utils/errorLog';

interface DailyAllowanceHintInput {
  /** The entry's date (ISO). */
  createdAt: string;
  /** The amount typed so far. */
  amount: string;
  /** The saved row when editing, so its own amount is not counted twice. */
  original?: {amount: number; date: string};
}

/**
 * The "daily budget · left today" line under the amount: null without a
 * budget for the entry's month. Informational only; never blocks saving.
 */
export const useDailyAllowanceHint = ({createdAt, amount, original}: DailyAllowanceHintInput) => {
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const expenseYearMonth = formatDate(createdAt, 'YYYY-MM');
  // Null until this month's budgets land: never the month another screen fetched.
  const currentBudget = useAppSelector(state => selectCurrentBudget(state, expenseYearMonth));
  const expenseDateStr = formatDate(createdAt, 'YYYY-MM-DD');

  useEffect(() => {
    void dispatch(fetchBudgetsByMonth(expenseYearMonth));
  }, [dispatch, expenseYearMonth]);

  // One month query yields BOTH the entry-day's spend and the spend before
  // that day — the adaptive allowance needs the latter, and this replaces the
  // previous per-day query without adding one.
  const [monthSpend, setMonthSpend] = useState({daySpend: 0, spentBeforeDay: 0});
  useEffect(() => {
    let cancelled = false;
    getAllExpensesByMonth(userId, expenseYearMonth)
      .then(expenses => {
        if (cancelled) {
          return;
        }
        let day = 0;
        let before = 0;
        for (const expense of expenses) {
          const expenseDay = expense.date.slice(0, 10);
          if (expenseDay === expenseDateStr) {
            day += expense.amount;
          } else if (expenseDay < expenseDateStr) {
            before += expense.amount;
          }
        }
        setMonthSpend({daySpend: day, spentBeforeDay: before});
      })
      .catch(error => {
        // Informational only (the daily-allowance hint); never blocks saving.
        appendErrorLog(error, false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, expenseYearMonth, expenseDateStr]);

  const originalAmount = original?.amount ?? 0;
  const originalDate = original?.date ?? '';
  return useMemo(() => {
    if (!currentBudget) {
      return null;
    }

    const dayOfMonth = Number.parseInt(expenseDateStr.slice(8, 10), 10) || 1;
    const daysInMonthCount = getDaysInMonthByYearMonth(expenseYearMonth);
    // The allowance adapts only when the entry's month is the real current
    // month — a backdated entry gets the plain monthly average.
    const isEntryInCurrentMonth = expenseYearMonth === formatDate(new Date(), 'YYYY-MM');

    // When editing, the stored amount is already inside the fetched spend —
    // subtract it so the amount in the input isn't counted twice.
    const originalOnEntryDay = expenseDateStr === originalDate.slice(0, 10) ? originalAmount : 0;
    const otherSpendToday = Math.max(monthSpend.daySpend - originalOnEntryDay, 0);
    const spentBefore = Math.max(monthSpend.spentBeforeDay - (originalAmount - originalOnEntryDay), 0);

    const {allowance} = computeDailyAllowance({
      monthlyBudget: currentBudget.amount,
      spentBeforeToday: spentBefore,
      dayOfMonth,
      daysInMonth: daysInMonthCount,
      isCurrentMonth: isEntryInCurrentMonth,
    });

    const enteredAmount = Number.parseFloat(amount) || 0;
    const dailyRemaining = allowance - otherSpendToday - enteredAmount;

    return {dailyBudget: allowance, dailyRemaining, exceeded: dailyRemaining < 0};
  }, [currentBudget, expenseYearMonth, expenseDateStr, monthSpend, amount, originalAmount, originalDate]);
};
