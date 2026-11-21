import {useMemo, useSyncExternalStore} from 'react';
import {periodFor, periodKeyOf, type Period} from '../../domain/period';
import {getMonthStartDay, subscribeMonthStartDay} from '../../pro/monthStart';

/**
 * The day months start on now (3.0, plan P11): the user's day with Pro, the
 * 1st without. A screen that shows a month depends on this, so it draws (and
 * reads) again the moment the day changes.
 */
export const useMonthStartDay = (): number =>
  useSyncExternalStore(subscribeMonthStartDay, getMonthStartDay, getMonthStartDay);

/** The days the month named `yearMonth` covers now, `[start, next)`; the same object until the key or the day changes. */
export const useMonthPeriod = (yearMonth: string): Period => {
  const monthStartDay = useMonthStartDay();
  return useMemo(() => periodFor(yearMonth, monthStartDay), [yearMonth, monthStartDay]);
};

/** The days of the month it is now. Read per render: "now" moves at midnight on the start day. */
export const useCurrentPeriod = (): Period => {
  const monthStartDay = useMonthStartDay();
  const key = periodKeyOf(new Date(), monthStartDay);
  return useMemo(() => periodFor(key, monthStartDay), [key, monthStartDay]);
};
