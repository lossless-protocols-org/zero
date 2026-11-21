import {useCallback, useMemo, useRef, useState} from 'react';
import {useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {getDueThrough, type Upcoming} from '../../data/services/recurringService';
import type {WatchedTable} from '../../data/services/tableChanges';
import {billsInBudget, stillToPay} from '../../domain/commitments';
import {todayIsoDay} from '../../domain/dates';
import {lastDayOf} from '../../domain/period';
import {appendErrorLog} from '../../platform/errorLog';
import {useFreshWhileFocused} from './useFreshWhileFocused';
import {useCurrentPeriod} from './useMonthStartDay';

// A rule's next occurrence moves when one is made, confirmed or skipped, and all of those write the rule.
const TABLES: readonly WatchedTable[] = ['recurring_rules', 'accounts'];
const NONE: readonly Upcoming[] = [];

/**
 * What recurring entries still hold for the rest of the user's month (Pro;
 * UX revamp v2): every occurrence from today to the day before the next
 * month starts, what leaves the money to spend, and the part of it that is
 * spending (a budget's bills). `enabled` false reads nothing and answers
 * with nothing due, so a free user's screens are exactly as they were.
 */
export const useCommitments = (enabled: boolean) => {
  const userId = useAppSelector(selectUserId);
  const period = useCurrentPeriod();
  const lastDay = lastDayOf(period);
  const [due, setDue] = useState<readonly Upcoming[]>(NONE);
  const request = useRef(0);

  const read = useCallback(() => {
    if (!enabled || !userId) {
      return;
    }
    const mine = ++request.current;
    getDueThrough(userId, todayIsoDay(), lastDay)
      .then(found => {
        if (mine === request.current) {
          setDue(found);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
  }, [enabled, userId, lastDay]);
  useFreshWhileFocused(read, TABLES);

  const shown = enabled ? due : NONE;
  return useMemo(
    () => ({due: shown, still: stillToPay(shown), bills: billsInBudget(shown), lastDay, nextStart: period.next}),
    [shown, lastDay, period.next],
  );
};
