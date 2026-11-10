import type {AppDispatch} from './store';
import {fetchCategories} from './slices/categoryDataSlice';
import {fetchCurrency} from './slices/currencyDataSlice';
import {observeTables, type WatchedTable} from '../data/services/tableChanges';

/** Session data, the table it comes from, and how to read it again. */
const FOLLOWED: ReadonlyArray<{table: WatchedTable; read: (dispatch: AppDispatch) => unknown}> = [
  {table: 'categories', read: dispatch => dispatch(fetchCategories())},
  {table: 'currencies', read: dispatch => dispatch(fetchCurrency())},
];

/**
 * Keeps the session's shared data (the categories and the currency, which
 * every screen reads) equal to the database while the session runs: after
 * any write to their table, whoever wrote it, they are read again (audit
 * 2026-11-08, Appendix A: "refresh-after-write is a manual contract"). Forms
 * no longer refetch them, and Settings no longer patches the currency into
 * the store by hand. Screen data (a month, a day, debts) is kept fresh by
 * the screen showing it (ui/hooks/useFreshWhileFocused).
 *
 * Writes in the same tick are read once. Returns the function that stops.
 */
export const followSession = (dispatch: AppDispatch): (() => void) => {
  const stops = FOLLOWED.map(({table, read}) => {
    let first = true;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const subscription = observeTables([table]).subscribe(() => {
      if (first) {
        first = false; // the watch's first emission: the session was just loaded
        return;
      }
      pending ??= setTimeout(() => {
        pending = null;
        read(dispatch); // a failed read is logged and surfaced by thunkRejectionMiddleware
      }, 0);
    });
    return () => {
      subscription.unsubscribe();
      if (pending !== null) {
        clearTimeout(pending);
      }
    };
  });
  return () => stops.forEach(stop => stop());
};
