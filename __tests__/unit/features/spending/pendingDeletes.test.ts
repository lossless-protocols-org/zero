/**
 * S7 / M4 (v2.7.1). Swipe-delete shows an undo row for 3 s, then commits.
 * The old per-day component kept ONE timeout and ONE pending id: a second
 * delete in the same day cleared the first timer and overwrote its id, so the
 * first delete was never committed and the row came back. Each pending delete
 * now has its own timer. Timers are injected so the test runs the same under
 * jest and bun.
 */
import {createPendingDeletes} from '../../../../src/features/spending/pendingDeletes';

const fakeTimers = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, {at: number; fn: () => void}>();
  return {
    setTimer: (fn: () => void, ms: number): number => {
      const id = nextId++;
      timers.set(id, {at: now + ms, fn});
      return id;
    },
    clearTimer: (id: number): void => {
      timers.delete(id);
    },
    advance: (ms: number): void => {
      now += ms;
      for (const [id, t] of [...timers.entries()].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now && timers.has(id)) {
          timers.delete(id);
          t.fn();
        }
      }
    },
    active: (): number => timers.size,
  };
};

const setup = () => {
  const timers = fakeTimers();
  const committed: string[] = [];
  const snapshots: string[][] = [];
  const pending = createPendingDeletes({
    delayMs: 3000,
    onCommit: id => committed.push(id),
    onChange: ids => snapshots.push([...ids].sort()),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  return {timers, committed, snapshots, pending};
};

describe('pending deletes', () => {
  it('commits after the undo window', () => {
    const {timers, committed, pending} = setup();
    pending.schedule('a');
    timers.advance(2999);
    expect(committed).toEqual([]);
    expect(pending.has('a')).toBe(true);
    timers.advance(1);
    expect(committed).toEqual(['a']);
    expect(pending.has('a')).toBe(false);
  });

  it('a second delete does not cancel the first: both commit, each on its own clock', () => {
    const {timers, committed, pending} = setup();
    pending.schedule('a');
    timers.advance(1000);
    pending.schedule('b');
    timers.advance(2000);
    expect(committed).toEqual(['a']);
    timers.advance(1000);
    expect(committed).toEqual(['a', 'b']);
  });

  it('undo cancels only that row', () => {
    const {timers, committed, pending} = setup();
    pending.schedule('a');
    pending.schedule('b');
    expect(pending.undo('a')).toBe(true);
    expect(pending.undo('a')).toBe(false);
    timers.advance(3000);
    expect(committed).toEqual(['b']);
    expect(timers.active()).toBe(0);
  });

  it('flushAll commits every pending delete immediately (unmount must not resurrect rows)', () => {
    const {timers, committed, pending} = setup();
    pending.schedule('a');
    pending.schedule('b');
    pending.flushAll();
    expect(committed.sort()).toEqual(['a', 'b']);
    expect(timers.active()).toBe(0);
    timers.advance(5000);
    expect(committed).toHaveLength(2);
  });

  it('reports the pending set on every change', () => {
    const {timers, snapshots, pending} = setup();
    pending.schedule('a');
    pending.schedule('b');
    pending.undo('a');
    timers.advance(3000);
    expect(snapshots).toEqual([['a'], ['a', 'b'], ['b'], []]);
  });

  it('flush(id) commits one row now and leaves the others on their clocks', () => {
    const {timers, committed, pending} = setup();
    pending.schedule('a');
    pending.schedule('b');
    expect(pending.flush('a')).toBe(true);
    expect(committed).toEqual(['a']);
    expect(pending.flush('a')).toBe(false);
    expect(timers.active()).toBe(1);
    timers.advance(3000);
    expect(committed).toEqual(['a', 'b']);
  });

  it('scheduling a row that is already pending restarts nothing and commits once', () => {
    const {timers, committed, pending} = setup();
    pending.schedule('a');
    timers.advance(2000);
    pending.schedule('a');
    expect(timers.active()).toBe(1); // no duplicate timer
    timers.advance(1000);
    expect(committed).toEqual(['a']); // on the original clock, not restarted
    timers.advance(5000);
    expect(committed).toEqual(['a']);
  });
});
