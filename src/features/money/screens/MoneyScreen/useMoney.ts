import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useMonthNavigation} from '../../../../ui/hooks/useMonthNavigation';
import {fetchIncomesByMonth, selectIncomes, selectReceived} from '../../../../store/slices/incomeDataSlice';
import {selectIncomeCategories} from '../../../../store/slices/categoryDataSlice';
import {selectUserId} from '../../../../store/slices/userIdSlice';
import {useCallback, useMemo, useRef, useState} from 'react';
import {useAvailableYears} from '../../../../ui/hooks/useAvailableYears';
import {copyIncomesFromMonth, getIncomesByMonth} from '../../../../data/services/incomeService';
import {getMonthSummary} from '../../../../data/services/periodSummaryService';
import {useFreshWhileFocused} from '../../../../ui/hooks/useFreshWhileFocused';
import {appendErrorLog} from '../../../../platform/errorLog';
import {periodFor, shiftPeriodKey} from '../../../../domain/period';
import {useMonthStartDay} from '../../../../ui/hooks/useMonthStartDay';
import {keptOf} from '../../../../domain/periodMath';
import {useProFeature} from '../../../../ui/hooks/useProFeature';

/** The month before 'YYYY-MM'. */
const previousMonth = (yearMonth: string): string => shiftPeriodKey(yearMonth, -1);

/**
 * The Money tab: what came in this month and what was kept (debts have their
 * own tab since the held-and-owed model, A2). Its month is its own (owner, 2.8): moving it never
 * moves Home's or Reports' month, so Kept is read for this month from the
 * database, not from Home's loaded expenses.
 */
export const useMoney = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const month = useMonthNavigation({shared: false});
  const {yearMonth} = month;
  // The days this month and the one before cover, as the user's month start day cuts them (P11).
  const monthStartDay = useMonthStartDay();
  const period = useMemo(() => periodFor(yearMonth, monthStartDay), [yearMonth, monthStartDay]);
  const previousPeriod = useMemo(() => periodFor(previousMonth(yearMonth), monthStartDay), [yearMonth, monthStartDay]);

  // Money in for the month, and the month's spending (net of refunds) for Kept.
  const incomes = useAppSelector(state => selectIncomes(state, yearMonth));
  const received = useAppSelector(state => selectReceived(state, yearMonth));
  // This month's net spending, from the database (Home's store holds Home's month).
  // Kept with the month it was read for: until this month's read lands, or
  // when it fails, Kept is unknown and not shown. It used to show received −
  // 0, or received − last month's spending (audit 2026-11-08 §3.12). Read the
  // way every screen reads (useFreshWhileFocused): on focus and after writes
  // while focused, never while hidden behind Home.
  const readKey = `${userId}|${period.start}`;
  const [spentRead, setSpentRead] = useState<{key: string; spent: number | null} | null>(null);
  const latestSpentRead = useRef(0);
  useFreshWhileFocused(
    useCallback(() => {
      if (!userId) {
        return;
      }
      const request = ++latestSpentRead.current;
      getMonthSummary(userId, period)
        .then(summary => {
          if (request === latestSpentRead.current) {
            setSpentRead({key: readKey, spent: summary.spent});
          }
        })
        .catch((error: unknown) => {
          appendErrorLog(error, false);
          if (request === latestSpentRead.current) {
            setSpentRead({key: readKey, spent: null});
          }
        });
    }, [readKey, userId, period]),
    ['expenses', 'refunds'],
  );
  const spent = spentRead?.key === readKey ? spentRead.spent : null;
  const kept = spent === null ? null : keptOf(received, spent);
  const incomeCategories = useAppSelector(selectIncomeCategories);
  const [lastMonthHadIncome, setLastMonthHadIncome] = useState(false);
  // The month picker's years, as Home and Reports have them.
  const availableYears = useAvailableYears();

  const latestCopyCheck = useRef(0);
  useFreshWhileFocused(
    useCallback(() => {
      if (!userId) {
        return;
      }
      void dispatch(fetchIncomesByMonth(yearMonth));
      // Offer "Same as last month" only when there is something to copy.
      const request = ++latestCopyCheck.current;
      getIncomesByMonth(userId, previousPeriod)
        .then(rows => {
          if (request === latestCopyCheck.current) {
            setLastMonthHadIncome(rows.length > 0);
          }
        })
        .catch((error: unknown) => appendErrorLog(error, false));
      // period: the same key covers other days once the month start day changes, so it is read again.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, userId, yearMonth, previousPeriod, period]),
    ['incomes'],
  );

  // With Pro a copy keeps its account; without it every copy is a new entry on the default (3.0).
  const keepAccounts = useProFeature('accounts');
  /** Copies last month's money in onto the first day of this month; false when it failed. */
  const copyLastMonth = useCallback(async (): Promise<boolean> => {
    try {
      await copyIncomesFromMonth(userId, previousPeriod, period, {keepAccounts});
    } catch (error) {
      appendErrorLog(error, false);
      return false;
    }
    return true; // the copied entries show through useFreshWhileFocused
  }, [userId, previousPeriod, period, keepAccounts]);

  return {
    colors,
    month,
    availableYears,
    previousYearMonth: previousMonth(yearMonth),
    period,
    previousPeriod,
    incomes,
    incomeCategories,
    received,
    kept,
    canCopyLastMonth: incomes.length === 0 && lastMonthHadIncome,
    copyLastMonth,
  };
};
