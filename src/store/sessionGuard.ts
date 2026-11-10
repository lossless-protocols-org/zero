import {isFulfilled, isPending, isRejected, type Middleware} from '@reduxjs/toolkit';
import {resetSession, type RootState} from './rootReducer';

/**
 * Drops the result of any fetch that started before a `resetSession`
 * (audit 2026-11-08 §3.10). The month caches and filtered lists compare
 * request ids already, but the whole-table slices (user id, currency,
 * categories, debtors) take whatever lands, so a read that began before
 * "Delete all data" could put the deleted user's id back after the reset.
 * Placed before every other middleware so a dropped result is not logged or
 * surfaced either: it belongs to data that no longer exists.
 */
export const createSessionGuard = (): Middleware<object, RootState> => {
  const inFlight = new Set<string>();
  const stale = new Set<string>();
  return () => next => action => {
    if (resetSession.match(action)) {
      for (const id of inFlight) {
        stale.add(id);
      }
      inFlight.clear();
    } else if (isPending(action)) {
      inFlight.add(action.meta.requestId);
    } else if (isFulfilled(action) || isRejected(action)) {
      const {requestId} = action.meta;
      inFlight.delete(requestId);
      if (stale.delete(requestId)) {
        return action;
      }
    }
    return next(action);
  };
};
