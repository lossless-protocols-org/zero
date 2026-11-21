import {appendErrorLog} from '../platform/errorLog';
import type {Entitlement} from './schema';

/**
 * Everything that acts without a tap follows the entitlement from here (3.0
 * law L4, handbook/blueprint/ZERO_3.0_ENTITLEMENT.md §5): recurring entries,
 * reminders, the automatic backup, what the widget may show. Each registers a
 * producer; `reconcile` hands every one the current entitlement.
 *
 * Level-triggered: a producer is told what is true now, on every cold start,
 * every return to the foreground and every change, and makes the world match.
 * It is never told "Pro just ended", so nothing depends on the app having
 * been running at that moment, and a pass cut short by a crash is simply run
 * again. A producer's `sync` must therefore be safe to call any number of
 * times with the same entitlement, and it must settle: producers run one
 * after another, so one that never finishes holds up the rest.
 */
export interface Producer {
  /** A stable name; registering the same key again replaces the earlier producer. */
  key: string;
  sync: (entitlement: Entitlement) => void | Promise<void>;
}

const producers = new Map<string, Producer>();

/**
 * Adds a producer; returns how to remove it. The app's: src/pro/producers.ts (plan P9).
 */
export const registerProducer = (producer: Producer): (() => void) => {
  producers.set(producer.key, producer);
  return () => {
    if (producers.get(producer.key) === producer) {
      producers.delete(producer.key);
    }
  };
};

let running: Promise<void> | null = null;
let waiting: Entitlement | null = null;

/** The entitlement that arrived while a pass was running, taken once. */
const takeWaiting = (): Entitlement | null => {
  const entitlement = waiting;
  waiting = null;
  return entitlement;
};

const pass = async (first: Entitlement): Promise<void> => {
  let entitlement: Entitlement | null = first;
  while (entitlement !== null) {
    for (const producer of [...producers.values()]) {
      try {
        await producer.sync(entitlement);
      } catch (error) {
        // One producer failing must not stop the others; the next pass tries it again.
        appendErrorLog(
          new Error(`reconcile ${producer.key}: ${error instanceof Error ? error.message : String(error)}`),
          false,
        );
      }
    }
    entitlement = takeWaiting();
  }
};

/**
 * Tells every producer the entitlement. Never rejects. One pass runs at a
 * time: a call made during a pass is followed by exactly one more pass with
 * the latest entitlement, so producers always end on what is true now and
 * never run two at once.
 */
export const reconcile = (entitlement: Entitlement): Promise<void> => {
  if (running) {
    waiting = entitlement;
    return running;
  }
  running = pass(entitlement).finally(() => {
    running = null;
    // A call that arrived after the pass took its last look, but before this ran, must not be
    // dropped (or left to run, stale, after some later one): give it its own pass now.
    const late = takeWaiting();
    return late ? reconcile(late) : undefined;
  });
  return running;
};
