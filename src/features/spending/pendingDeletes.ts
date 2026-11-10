/**
 * Undo windows for swipe-delete (S7 / M4, v2.7.1). Every scheduled id gets
 * its own timer: the previous per-day implementation held one timer and one
 * pending id, so a second delete within the undo window cancelled the first
 * and that row silently came back.
 *
 * Timers are injected so the logic is testable without fake-timer support in
 * the runner; the component passes setTimeout/clearTimeout.
 */
interface PendingDeletesOptions<Handle> {
  /** The undo window; a function is read at each schedule (it can change while open). */
  delayMs: number | (() => number);
  /** The undo window elapsed (or the list went away): delete the row for real. */
  onCommit: (id: string) => void;
  /** The set of ids currently awaiting undo changed. */
  onChange: (ids: ReadonlySet<string>) => void;
  setTimer: (fn: () => void, ms: number) => Handle;
  clearTimer: (handle: Handle) => void;
}

interface PendingDeletes {
  /** Start the undo window for `id`; a no-op if it is already pending. */
  schedule: (id: string) => void;
  /** Cancel the delete; returns false if `id` was not pending. */
  undo: (id: string) => boolean;
  has: (id: string) => boolean;
  /** Commit `id` now (its row left the list); returns false if it was not pending. */
  flush: (id: string) => boolean;
  /** Commit everything still pending, now. Called when the list unmounts. */
  flushAll: () => void;
}

export const createPendingDeletes = <Handle>({
  delayMs,
  onCommit,
  onChange,
  setTimer,
  clearTimer,
}: PendingDeletesOptions<Handle>): PendingDeletes => {
  const timers = new Map<string, Handle>();
  const notify = (): void => onChange(new Set(timers.keys()));

  const commit = (id: string): boolean => {
    const handle = timers.get(id);
    if (handle === undefined) {
      return false;
    }
    clearTimer(handle);
    timers.delete(id);
    notify();
    onCommit(id);
    return true;
  };

  return {
    schedule: id => {
      if (timers.has(id)) {
        return;
      }
      timers.set(
        id,
        setTimer(() => commit(id), typeof delayMs === 'function' ? delayMs() : delayMs),
      );
      notify();
    },
    undo: id => {
      const handle = timers.get(id);
      if (handle === undefined) {
        return false;
      }
      clearTimer(handle);
      timers.delete(id);
      notify();
      return true;
    },
    has: id => timers.has(id),
    flush: commit,
    flushAll: () => {
      for (const id of [...timers.keys()]) {
        commit(id);
      }
    },
  };
};
