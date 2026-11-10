import {useEffect, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {fetchBudgetsByMonth, selectCurrentBudget} from '../../../store/slices/budgetDataSlice';
import {getAllowanceSpend} from '../../../data/services/periodSummaryService';
import {computeDailyAllowance} from '../../../domain/budgetMath';
import {formatDate, getDaysInMonthByYearMonth, toDayKey} from '../../../domain/dates';
import {fromMoneyUnits, toMoneyUnits} from '../../../domain/money';
import {appendErrorLog} from '../../../platform/errorLog';

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
  // Once per date, not per keystroke in the amount: the day key (domain/dates, the app's one day rule) and its month.
  const expenseDateStr = useMemo(() => toDayKey(createdAt), [createdAt]);
  const expenseYearMonth = expenseDateStr.slice(0, 7);
  // Null until this month's budgets land: never the month another screen fetched.
  const currentBudget = useAppSelector(state => selectCurrentBudget(state, expenseYearMonth));

  useEffect(() => {
    void dispatch(fetchBudgetsByMonth(expenseYearMonth));
  }, [dispatch, expenseYearMonth]);

  // The day's spend and the spend before it come from periodSummaryService,
  // the one place spending is figured from the database (audit §4.1).
  //
  // The spend is kept with the read it came from. A failed read, or one still
  // running for a newly picked date, leaves no figure, and the hint shows
  // nothing: zero spent would have read as the whole daily budget "left
  // today", a confident wrong number (audit 2026-11-08 §3.12).
  const readKey = `${userId}|${expenseYearMonth}|${expenseDateStr}`;
  const [monthSpend, setMonthSpend] = useState<{key: string; daySpend: number; spentBeforeDay: number} | null>(null);
  useEffect(() => {
    let cancelled = false;
    getAllowanceSpend(userId, expenseDateStr)
      .then(({spentOnDay, spentBeforeDay}) => {
        if (!cancelled) {
          setMonthSpend({key: readKey, daySpend: spentOnDay, spentBeforeDay});
        }
      })
      .catch(error => {
        // Informational only (the daily-allowance hint); never blocks saving.
        appendErrorLog(error, false);
        if (!cancelled) {
          setMonthSpend(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [readKey, userId, expenseYearMonth, expenseDateStr]);

  const originalAmount = original?.amount ?? 0;
  const originalDate = original?.date ?? '';
  return useMemo(() => {
    if (!currentBudget || monthSpend?.key !== readKey) {
      return null;
    }

    const dayOfMonth = Number.parseInt(expenseDateStr.slice(8, 10), 10) || 1;
    const daysInMonthCount = getDaysInMonthByYearMonth(expenseYearMonth);
    // The allowance adapts only when the entry's month is the real current
    // month — a backdated entry gets the plain monthly average.
    const isEntryInCurrentMonth = expenseYearMonth === formatDate(new Date(), 'YYYY-MM');

    // When editing, the stored amount is inside the read spend only where the
    // stored row is: on the entry's day, or earlier in the same month. Take it
    // out of that figure alone, so the amount in the input is not counted
    // twice; an entry moved here from another month or a later day was never
    // in it. Exact money units throughout (R10).
    const originalDay = originalDate ? toDayKey(originalDate) : '';
    const originalUnits = toMoneyUnits(originalAmount);
    const onEntryDayUnits = originalDay === expenseDateStr ? originalUnits : 0;
    const beforeDayUnits =
      originalDay.startsWith(`${expenseYearMonth}-`) && originalDay < expenseDateStr ? originalUnits : 0;
    const otherSpendTodayUnits = Math.max(toMoneyUnits(monthSpend.daySpend) - onEntryDayUnits, 0);
    const spentBefore = fromMoneyUnits(Math.max(toMoneyUnits(monthSpend.spentBeforeDay) - beforeDayUnits, 0));

    const {allowance} = computeDailyAllowance({
      monthlyBudget: currentBudget.amount,
      spentBeforeToday: spentBefore,
      dayOfMonth,
      daysInMonth: daysInMonthCount,
      isCurrentMonth: isEntryInCurrentMonth,
    });

    const enteredAmount = Number.parseFloat(amount);
    const enteredUnits = Number.isFinite(enteredAmount) ? toMoneyUnits(enteredAmount) : 0;
    const dailyRemaining = fromMoneyUnits(toMoneyUnits(allowance) - otherSpendTodayUnits - enteredUnits);

    return {dailyBudget: allowance, dailyRemaining, exceeded: dailyRemaining < 0};
  }, [currentBudget, readKey, expenseYearMonth, expenseDateStr, monthSpend, amount, originalAmount, originalDate]);
};
