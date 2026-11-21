import {useCallback, useRef, useState} from 'react';
import {useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {getRules, getUpcoming, type Upcoming} from '../../data/services/recurringService';
import type {WatchedTable} from '../../data/services/tableChanges';
import {todayIsoDay} from '../../domain/dates';
import {appendErrorLog} from '../../platform/errorLog';
import {useFreshWhileFocused} from './useFreshWhileFocused';
import {useRecurringState} from './useRecurringState';

const TABLES: readonly WatchedTable[] = ['recurring_rules'];

/**
 * The Money tab's recurring line (Pro, P9): how many rules, the next thing
 * coming in the week, and how many occurrences wait for the user. Mounted
 * only inside `<ProSlot feature="recurring">`.
 */
export const useRecurringSummary = () => {
  const userId = useAppSelector(selectUserId);
  const {behind, asks} = useRecurringState();
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<Upcoming | null>(null);
  const request = useRef(0);

  const read = useCallback(() => {
    if (!userId) {
      return;
    }
    const mine = ++request.current;
    Promise.all([getRules(userId), getUpcoming(userId, todayIsoDay(), 7)])
      .then(([rules, upcoming]) => {
        if (mine === request.current) {
          setCount(rules.length);
          setNext(upcoming[0] ?? null);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
  }, [userId]);
  useFreshWhileFocused(read, TABLES);

  return {count, next, waiting: behind.length + asks.length};
};
