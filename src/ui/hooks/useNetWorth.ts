import {useCallback, useRef, useState} from 'react';
import {useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {articulate, getNetWorth, type NetWorth, type PeriodArticulation} from '../../data/services/netWorthService';
import type {WatchedTable} from '../../data/services/tableChanges';
import {formatDate} from '../../domain/dates';
import {appendErrorLog} from '../../platform/errorLog';
import {useFreshWhileFocused} from './useFreshWhileFocused';
import {useCurrentPeriod} from './useMonthStartDay';

/** Every table a balance reads: a write to any of them can move net worth. */
export const POSITION_TABLES: readonly WatchedTable[] = [
  'accounts',
  'checkpoints',
  'transfers',
  'expenses',
  'refunds',
  'incomes',
  'debts',
];

/**
 * Net worth today, each account's balance, and this month's articulation
 * (R16) in words, read while the screen is focused and again after every
 * write to a table it depends on. `enabled` false reads nothing: a free
 * user's Money tab never works out positions it would not show.
 */
export const useNetWorth = (enabled: boolean) => {
  const userId = useAppSelector(selectUserId);
  const [worth, setWorth] = useState<NetWorth | null>(null);
  const [since, setSince] = useState<PeriodArticulation | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const monthStart = useCurrentPeriod().start;

  const read = useCallback(() => {
    if (!enabled || !userId) {
      return;
    }
    const mine = ++request.current;
    const today = formatDate(undefined);
    // "This month" is the user's month (P11): from its first day, whichever day of the calendar that is.
    Promise.all([getNetWorth(userId, today), articulate(userId, monthStart, today)])
      .then(([nextWorth, nextSince]) => {
        // Only the newest read lands: an older one finishing late would show stale balances.
        if (mine === request.current) {
          setWorth(nextWorth);
          setSince(nextSince);
          setFailed(false);
        }
      })
      .catch((error: unknown) => {
        appendErrorLog(error, false);
        if (mine === request.current) {
          setFailed(true);
        }
      });
  }, [enabled, userId, monthStart]);

  useFreshWhileFocused(read, POSITION_TABLES);

  return {worth, since, failed, reload: read};
};
