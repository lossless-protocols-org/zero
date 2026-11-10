import {useCallback, useRef} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {observeTables, type WatchedTable} from '../../data/services/tableChanges';

/**
 * The one way a screen keeps what it shows up to date (audit 2026-11-08,
 * Appendix A: "refresh-after-write is a manual contract", "two refresh models
 * for one figure"): `read` runs when the screen gains focus, and again after
 * every write to `tables` while it stays focused, whoever wrote: a form on
 * top of it, a swipe-delete in it, the quick-add sheet over the app, the
 * widget's queue. A writer no longer has to know which screens to refetch,
 * and a screen behind another one does no work until it is shown again.
 *
 * Writes that land in the same tick are read once. `read` must be stable
 * (useCallback) and safe to call while an earlier read is still in flight:
 * the store's per-request guards keep the newest.
 */
export const useFreshWhileFocused = (read: () => void, tables: readonly WatchedTable[]): void => {
  // Re-subscribe when the set of tables changes, not when a caller passes a new array with the same tables.
  const tablesKey = tables.join(',');
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  useFocusEffect(
    useCallback(() => {
      read();
      let first = true;
      let pending: ReturnType<typeof setTimeout> | null = null;
      // The watch emits once on subscribe: that is the focus read above.
      const subscription = observeTables(tablesRef.current).subscribe(() => {
        if (first) {
          first = false;
          return;
        }
        pending ??= setTimeout(() => {
          pending = null;
          read();
        }, 0);
      });
      return () => {
        subscription.unsubscribe();
        if (pending !== null) {
          clearTimeout(pending);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- tablesKey is `tables` by value (read through the ref)
    }, [read, tablesKey]),
  );
};
