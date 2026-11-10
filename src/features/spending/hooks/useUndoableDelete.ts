import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, AppState} from 'react-native';
import {createPendingDeletes} from '../pendingDeletes';
import {appendErrorLog} from '../../../platform/errorLog';

const EMPTY_IDS: ReadonlySet<string> = new Set();
const UNDO_WINDOW_MS = 3000;
/** A screen reader needs time to hear the strip and reach Undo (M29). */
const SCREEN_READER_UNDO_WINDOW_MS = 20000;

interface UndoableDeleteOptions {
  /** Deletes for real once the undo window closes. */
  commit: (id: string) => Promise<void>;
  /** The commit threw; the row is already back on screen. */
  onCommitFailed: (error: unknown) => Promise<void>;
  /** Ids currently in the list's data. */
  presentIds: readonly string[];
}

/**
 * Swipe-to-delete with a 3 s undo (S7): a deleted row is pending (shows Undo),
 * then committed and hidden until the data no longer contains it. One timer
 * per row; pending deletes are committed, never dropped, when the list goes
 * or the app leaves the foreground.
 */
export const useUndoableDelete = ({commit, onCommitFailed, presentIds}: UndoableDeleteOptions) => {
  // Rows awaiting undo, and rows being deleted (hidden until the refetch no
  // longer contains them).
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(EMPTY_IDS);

  const commitDelete = useCallback(
    async (id: string) => {
      setRemovedIds(prev => new Set([...prev, id]));
      try {
        await commit(id);
      } catch (error) {
        // The row was hidden optimistically. Put it back (only this one) and
        // let the caller record and report it — a delete that quietly did
        // nothing is the worst outcome.
        setRemovedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await onCommitFailed(error);
      }
    },
    [commit, onCommitFailed],
  );

  // The undo timers outlive any single render; they must call the latest
  // commit. A layout effect runs before anything else can, so a timer can
  // never observe a stale month/date.
  const commitRef = useRef(commitDelete);
  useLayoutEffect(() => {
    commitRef.current = commitDelete;
  }, [commitDelete]);
  const screenReaderRef = useRef(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then(enabled => {
        if (live) {
          screenReaderRef.current = enabled;
        }
      })
      .catch((error: unknown) => {
        // Unknown: keep the short window, but leave a trace (a screen reader
        // user then gets 3 s, which M29 says they cannot reach).
        appendErrorLog(error, false);
      });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', enabled => {
      screenReaderRef.current = enabled;
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  const pendingRef = useRef(
    createPendingDeletes<ReturnType<typeof setTimeout>>({
      delayMs: () => (screenReaderRef.current ? SCREEN_READER_UNDO_WINDOW_MS : UNDO_WINDOW_MS),
      // commitDelete catches its own failures; the promise is deliberately not awaited.
      onCommit: id => {
        void commitRef.current(id);
      },
      onChange: setPendingIds,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: clearTimeout,
    }),
  );
  // Commit rather than drop pending deletes when the list goes away:
  // cancelling would silently resurrect rows the user deleted.
  useEffect(() => {
    const pending = pendingRef.current;
    return () => pending.flushAll();
  }, []);
  // ...and when the app leaves the foreground: a kill inside the window
  // (swiping it away, the OS reclaiming memory) never reaches the unmount, and
  // the row came back on the next launch (2.7.1 gate, Moto). iOS can kill from
  // the app switcher straight after 'inactive', so anything but 'active' counts.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        pendingRef.current.flushAll();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const present = new Set(presentIds);
    // A row being deleted stays hidden while a refetch (pull-to-refresh, a
    // sibling commit's refetch) still contains it; it is forgotten once gone.
    setRemovedIds(prev => {
      if (prev.size === 0) {
        return prev;
      }
      const next = new Set([...prev].filter(id => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // A pending row that left the data (month switched) has lost its Undo
    // affordance: commit it now rather than 3 s later with no trace.
    for (const id of pendingIds) {
      if (!present.has(id)) {
        pendingRef.current.flush(id);
      }
    }
  }, [presentIds, pendingIds]);

  const schedule = useCallback((id: string) => pendingRef.current.schedule(id), []);
  const undo = useCallback((id: string) => pendingRef.current.undo(id), []);

  return {pendingIds, removedIds, schedule, undo};
};
