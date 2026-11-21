import {useSyncExternalStore} from 'react';
import {getRecurringState, subscribeRecurringState, type RecurringState} from '../../pro/recurringState';

/** What the last materialiser run left for the user: rules behind, and occurrences to confirm (3.0, P9). */
export const useRecurringState = (): RecurringState =>
  useSyncExternalStore(subscribeRecurringState, getRecurringState, getRecurringState);
