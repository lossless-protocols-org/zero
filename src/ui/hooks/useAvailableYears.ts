import {useEffect, useMemo, useState} from 'react';
import {useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {loadAvailableYears, subscribeToYears} from '../../data/services/availableYearsCache';
import {logRejection} from '../../platform/errorLog';

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

  // Stable between renders, so a memoised picker does not redraw for nothing.
  const thisYearOnly = useMemo(() => [new Date().getFullYear()], []);
  // Another user's years (before a restore's reset lands) are never offered.
  return loaded?.userId === userId ? loaded.years : thisYearOnly;
};
