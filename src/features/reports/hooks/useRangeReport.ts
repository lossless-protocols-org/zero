import {useCallback, useMemo, useRef, useState} from 'react';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {getAllExpensesByMonth} from '../../../data/services/expenseService';
import {getRefundRowsByMonth} from '../../../data/services/refundService';
import {getIncomesByMonth} from '../../../data/services/incomeService';
import {shiftIsoDay, todayIsoDay} from '../../../domain/dates';
import {sumAmounts} from '../../../domain/money';
import {spendingOf, toSpendRows} from '../../../domain/periodMath';
import {daysIn, rangePeriod, type Period} from '../../../domain/period';
import type {ExpenseWithCategory, IsoDay, RefundListRow} from '../../../domain/types';
import {appendErrorLog} from '../../../platform/errorLog';
import {useFreshWhileFocused} from '../../../ui/hooks/useFreshWhileFocused';

/** The range the screen opens on: the last 30 days, today included. */
const DEFAULT_DAYS = 30;

interface Loaded {
  /** The range these rows were read for: never shown under another. */
  key: string;
  expenses: ExpenseWithCategory[];
  refunds: RefundListRow[];
  received: number;
}

/**
 * Reports for any two days (3.0 Pro, plan P11): the same reads a month uses
 * (the services take a period), over the range the user picks, so its
 * figures are a month's figures by the same rules (spending net of the
 * refunds dated in the range, R2). Its rows are this screen's own: they
 * never enter the month slots Home and Reports read.
 */
export const useRangeReport = () => {
  const userId = useAppSelector(selectUserId);
  const today = todayIsoDay();
  const [from, setFrom] = useState<IsoDay>(() => shiftIsoDay(today, -(DEFAULT_DAYS - 1)));
  const [to, setTo] = useState<IsoDay>(today);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const period: Period = useMemo(() => rangePeriod(from, to), [from, to]);
  const key = `${userId}|${period.start}|${period.next}`;

  useFreshWhileFocused(
    useCallback(() => {
      if (!userId) {
        return;
      }
      const mine = ++request.current;
      Promise.all([
        getAllExpensesByMonth(userId, period),
        getRefundRowsByMonth(userId, period),
        getIncomesByMonth(userId, period),
      ])
        .then(([expenses, refunds, incomes]) => {
          // Only the newest read lands: a slower, older range must not fill the screen.
          if (mine === request.current) {
            setLoaded({key, expenses, refunds, received: sumAmounts(incomes)});
            setFailed(false);
          }
        })
        .catch((error: unknown) => {
          appendErrorLog(error, false);
          if (mine === request.current) {
            setFailed(true);
          }
        });
    }, [userId, period, key]),
    ['expenses', 'refunds', 'incomes', 'categories'],
  );

  // Until the picked range's own rows land, nothing: never the last range's figures under new dates.
  const current = loaded?.key === key ? loaded : null;
  const rows = useMemo(() => (current ? toSpendRows(current.expenses, current.refunds) : []), [current]);
  const totals = useMemo(() => {
    const spending = spendingOf(current?.expenses ?? [], current?.refunds ?? []);
    return {
      spent: spending.spent,
      refunded: spending.refunded,
      count: spending.count,
      received: current?.received ?? 0,
    };
  }, [current]);

  /** Moves one end; the other follows when the range would otherwise end before it starts. */
  const pickFrom = useCallback(
    (day: IsoDay) => {
      setFrom(day);
      setTo(end => (end < day ? day : end));
    },
    [setFrom, setTo],
  );
  const pickTo = useCallback(
    (day: IsoDay) => {
      setTo(day);
      setFrom(start => (start > day ? day : start));
    },
    [setFrom, setTo],
  );

  return {
    from,
    to,
    today,
    pickFrom,
    pickTo,
    period,
    days: daysIn(period),
    ready: current !== null,
    failed,
    expenses: current?.expenses ?? [],
    refunds: current?.refunds ?? [],
    rows,
    totals,
  };
};
