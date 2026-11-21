import type {DueAsk, RuleBehind} from '../data/services/recurringService';

/**
 * What the last materialiser run left for the user (3.0, plan P9): rules
 * behind by more than one occurrence ("add the missed entries, or start from
 * today?") and occurrences whose amount varies (to confirm). Held here, apart
 * from React, so the producer that fills it runs without a screen; the
 * Recurring screen and the one-time prompt read it through ui/hooks.
 * Empty without Pro: nothing ran.
 */
export interface RecurringState {
  behind: readonly RuleBehind[];
  asks: readonly DueAsk[];
}

const EMPTY: RecurringState = {behind: [], asks: []};
let state: RecurringState = EMPTY;
const listeners = new Set<() => void>();

export const getRecurringState = (): RecurringState => state;

export const setRecurringState = (next: RecurringState): void => {
  state = next.behind.length === 0 && next.asks.length === 0 ? EMPTY : next;
  listeners.forEach(listener => listener());
};

export const subscribeRecurringState = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
