import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {
  catchUp,
  getRules,
  getUpcoming,
  skipOccurrence,
  startFromToday,
  type DueAsk,
  type RuleData,
  type Upcoming,
} from '../../../data/services/recurringService';
import type {WatchedTable} from '../../../data/services/tableChanges';
import {todayIsoDay} from '../../../domain/dates';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {appendErrorLog} from '../../../platform/errorLog';
import {rerunProducers} from '../../../pro/producers';
import {useDialog} from '../../../ui/context/DialogContext';
import {useFreshWhileFocused} from '../../../ui/hooks/useFreshWhileFocused';
import {useRecurringState} from '../../../ui/hooks/useRecurringState';

/** A week of what is coming: the strip at the top of the list. */
const UPCOMING_DAYS = 7;
const TABLES: readonly WatchedTable[] = ['recurring_rules', 'categories', 'accounts'];

/**
 * The Recurring screen: every rule, what is coming this week, occurrences
 * waiting for an amount, and rules behind by more than one occurrence with
 * the two ways out ("add them" or "start from today"), each a deliberate tap.
 */
export const useRecurring = () => {
  const {t} = useTranslation();
  const {showAlert, showDialog} = useDialog();
  const userId = useAppSelector(selectUserId);
  const {behind, asks} = useRecurringState();
  const [rules, setRules] = useState<RuleData[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const request = useRef(0);

  const read = useCallback(() => {
    if (!userId) {
      return;
    }
    const mine = ++request.current;
    Promise.all([getRules(userId), getUpcoming(userId, todayIsoDay(), UPCOMING_DAYS)])
      .then(([nextRules, nextUpcoming]) => {
        if (mine === request.current) {
          setRules(nextRules);
          setUpcoming(nextUpcoming);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
  }, [userId]);
  useFreshWhileFocused(read, TABLES);

  /** Runs the change, then the producers (what is made and reminded follows at once); says so if it failed. */
  const act = useCallback(
    async (change: () => Promise<unknown>) => {
      try {
        await change();
        await rerunProducers();
      } catch (error) {
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('recurring.saveFailed')});
      }
      read();
    },
    [read, showAlert, t],
  );

  const addMissed = useCallback((ruleId: string) => act(() => catchUp(ruleId, todayIsoDay())), [act]);
  const skipMissed = useCallback((ruleId: string) => act(() => startFromToday(ruleId, todayIsoDay())), [act]);
  const skipAsk = useCallback(
    async (ask: DueAsk) => {
      const confirmed = await showDialog({
        type: 'warning',
        message: t('recurring.skipConfirm', {title: ask.title, date: formatDisplayDate(ask.day, 'dayMonth')}),
      });
      if (confirmed) {
        await act(() => skipOccurrence(ask.ruleId, ask.index));
      }
    },
    [act, showDialog, t],
  );

  return {rules, upcoming, behind, asks, addMissed, skipMissed, skipAsk};
};
