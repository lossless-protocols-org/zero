import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useMonthNavigation} from '../../../../ui/hooks/useMonthNavigation';
import {fetchDebtors, selectDebtorData} from '../../../../store/slices/debtorDataSlice';
import {fetchAllDebts, selectAllDebts} from '../../../../store/slices/debtDataSlice';
import {fetchIncomesByMonth, selectIncomes, selectReceived} from '../../../../store/slices/incomeDataSlice';
import {selectIncomeCategories} from '../../../../store/slices/categoryDataSlice';
import {selectUserId} from '../../../../store/slices/userIdSlice';
import {useCallback, useMemo, useRef, useState} from 'react';
import {useAvailableYears} from '../../../../ui/hooks/useAvailableYears';
import {DebtorData as Debtor} from '../../../../domain/types';
import {copyIncomesFromMonth, getIncomesByMonth} from '../../../../data/services/incomeService';
import {getMonthSummary} from '../../../../data/services/periodSummaryService';
import {useFreshWhileFocused} from '../../../../ui/hooks/useFreshWhileFocused';
import {debtorGroupOf, netDebt, type DebtorGroup} from '../../../../domain/debtType';
import {appendErrorLog} from '../../../../platform/errorLog';
import {shiftYearMonth} from '../../../../domain/dates';
import {keptOf} from '../../../../domain/periodMath';

/** The month before 'YYYY-MM'. */
const previousMonth = (yearMonth: string): string => shiftYearMonth(yearMonth, -1);

/**
 * The Money tab (2.8): what came in this month, what was kept, and the debts
 * screen it grew out of. Its month is its own (owner, 2.8): moving it never
 * moves Home's or Reports' month, so Kept is read for this month from the
 * database, not from Home's loaded expenses.
 */
export const useMoney = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const month = useMonthNavigation({shared: false});
  const {yearMonth} = month;

  // Debts, as the Debts tab had them.
  const debtors = useAppSelector(selectDebtorData);
  const allDebts = useAppSelector(selectAllDebts);
  const [debtorType, setDebtorType] = useState<DebtorGroup>('people');
  const {personDebtors, otherAccountsDebtors} = useMemo(
    () => ({
      personDebtors: debtors.filter((debtor: Debtor) => debtorGroupOf(debtor.type) === 'people'),
      otherAccountsDebtors: debtors.filter((debtor: Debtor) => debtorGroupOf(debtor.type) === 'accounts'),
    }),
    [debtors],
  );
  const totalDebts = useMemo(() => netDebt(allDebts), [allDebts]);

  // Money in for the month, and the month's spending (net of refunds) for Kept.
  const incomes = useAppSelector(state => selectIncomes(state, yearMonth));
  const received = useAppSelector(state => selectReceived(state, yearMonth));
  // This month's net spending, from the database (Home's store holds Home's month).
  // Kept with the month it was read for: until this month's read lands, or
  // when it fails, Kept is unknown and not shown. It used to show received −
  // 0, or received − last month's spending (audit 2026-11-08 §3.12). Read the
  // way every screen reads (useFreshWhileFocused): on focus and after writes
  // while focused, never while hidden behind Home.
  const readKey = `${userId}|${yearMonth}`;
  const [spentRead, setSpentRead] = useState<{key: string; spent: number | null} | null>(null);
  const latestSpentRead = useRef(0);
  useFreshWhileFocused(
    useCallback(() => {
      if (!userId) {
        return;
      }
      const request = ++latestSpentRead.current;
      getMonthSummary(userId, yearMonth)
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
    }, [readKey, userId, yearMonth]),
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
      void dispatch(fetchDebtors());
      void dispatch(fetchAllDebts());
      if (!userId) {
        return;
      }
      void dispatch(fetchIncomesByMonth(yearMonth));
      // Offer "Same as last month" only when there is something to copy.
      const request = ++latestCopyCheck.current;
      getIncomesByMonth(userId, previousMonth(yearMonth))
        .then(rows => {
          if (request === latestCopyCheck.current) {
            setLastMonthHadIncome(rows.length > 0);
          }
        })
        .catch((error: unknown) => appendErrorLog(error, false));
    }, [dispatch, userId, yearMonth]),
    ['debts', 'debtors', 'incomes'],
  );

  /** Copies last month's money in onto the 1st of this month; false when it failed. */
  const copyLastMonth = useCallback(async (): Promise<boolean> => {
    try {
      await copyIncomesFromMonth(userId, previousMonth(yearMonth), yearMonth);
    } catch (error) {
      appendErrorLog(error, false);
      return false;
    }
    return true; // the copied entries show through useFreshWhileFocused
  }, [userId, yearMonth]);

  return {
    colors,
    month,
    availableYears,
    previousYearMonth: previousMonth(yearMonth),
    incomes,
    incomeCategories,
    received,
    kept,
    canCopyLastMonth: incomes.length === 0 && lastMonthHadIncome,
    copyLastMonth,
    allDebts,
    debtorType,
    setDebtorType,
    personDebtors,
    otherAccountsDebtors,
    totalDebts,
    debtors,
  };
};
