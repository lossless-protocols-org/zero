import {useEffect, useMemo, useState} from 'react';
import {useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {loadAvailableYears, subscribeToYears} from '../../data/services/availableYearsCache';
import {hasExpenseBefore} from '../../data/services/expenseService';
import {appendErrorLog, logRejection} from '../../platform/errorLog';
import {DEFAULT_MONTH_START_DAY, periodKeyOf, yearOfKey} from '../../domain/period';
import {useMonthStartDay} from './useMonthStartDay';

/**
 * The years the month picker offers: every year with an expense, and always
 * the current one. One hook for Home, Reports and the Money tab, which each
 * carried a copy of this block (audit 2026-11-08 §4.1). It also follows the
 * cache: an expense saved in a new year shows up in a picker already open,
 * where the copies only read the cache when the user changed.
 */
export const useAvailableYears = (): number[] => {
  const userId = useAppSelector(selectUserId);
  const [loaded, setLoaded] = useState<{userId: string; years: number[]} | null>(null);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }
    let live = true;
    const unsubscribe = subscribeToYears((changedUserId, years) => {
      if (live && changedUserId === userId) {
        setLoaded({userId, years});
      }
    });
    logRejection(
      loadAvailableYears(userId).then(years => {
        if (live && years.length > 0) {
          setLoaded({userId, years});
        }
      }),
    );
    return () => {
      live = false;
      unsubscribe();
    };
  }, [userId]);

  // Another user's years (before a restore's reset lands) are never offered.
  const years = loaded?.userId === userId ? loaded.years : null;

  // The cache lists the calendar years of the rows. When months start on another day (P11) a
  // year's first days belong to the month that began the December before: the year before the
  // earliest one is offered when it holds such a day, and "this year" is the year of the month
  // today is in (on 3 January, with months from the 7th, still last year).
  const monthStartDay = useMonthStartDay();
  const earliest = years && years.length > 0 ? Math.min(...years) : null;
  const [before, setBefore] = useState<{key: string; year: number} | null>(null);
  const beforeKey = `${userId}|${monthStartDay}|${earliest}`;
  useEffect(() => {
    if (!userId || earliest === null || monthStartDay === DEFAULT_MONTH_START_DAY) {
      return undefined;
    }
    let live = true;
    const day = `${earliest}-01-${String(monthStartDay).padStart(2, '0')}`;
    hasExpenseBefore(userId, day)
      .then(has => {
        if (live && has) {
          setBefore({key: beforeKey, year: earliest - 1});
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
    return () => {
      live = false;
    };
  }, [userId, earliest, monthStartDay, beforeKey]);

  const thisYear = yearOfKey(periodKeyOf(new Date(), monthStartDay));
  const extra = before?.key === beforeKey ? before.year : null;
  // Stable between renders, so a memoised picker does not redraw for nothing.
  return useMemo(() => {
    const all = new Set([...(years ?? []), thisYear, ...(extra === null ? [] : [extra])]);
    return [...all].filter(year => year <= thisYear).sort((a, b) => a - b);
  }, [years, thisYear, extra]);
};
