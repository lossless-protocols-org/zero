import {isPro} from './entitlement';
import {getEntitlement, subscribeEntitlement} from './entitlementStore';

/**
 * Whether Pro is applied to what is on screen (3.0, entitlement design §3,
 * "when a change is applied"). It follows the entitlement with one
 * difference: an upgrade applies at once, a downgrade waits for a safe point.
 *
 * Safe means no Pro screen is open. With one open, the downgrade is applied
 * when the user leaves it, so nobody is thrown out of a form they are
 * filling in; a save they have confirmed completes anyway, because the data
 * layer never asks who is paying. A cold start is always safe: the first
 * value is simply the stored entitlement.
 *
 * Navigation (`ProStack`), `<ProSlot>` and `useProFeature` all read this one
 * value, so they cannot disagree about whether Pro screens exist.
 */
let applied: boolean | undefined;
let proScreenOpen = false;
let following = false;
const listeners = new Set<() => void>();

const settle = (): void => {
  const wanted = isPro(getEntitlement().state);
  // Turning on never waits. Turning off waits while a Pro screen is open.
  const next = wanted || (proScreenOpen && applied === true);
  if (next !== applied) {
    applied = next;
    listeners.forEach(listener => listener());
  }
};

const follow = (): void => {
  if (!following) {
    following = true;
    applied = isPro(getEntitlement().state);
    subscribeEntitlement(settle);
  }
};

/** Whether Pro is on for what is drawn now. */
export const getAppliedPro = (): boolean => {
  follow();
  return applied === true;
};

export const subscribeAppliedPro = (listener: () => void): (() => void) => {
  follow();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Told by navigation whether the screen in front is a Pro screen. Leaving one applies a waiting downgrade. */
export const setProScreenOpen = (open: boolean): void => {
  follow();
  proScreenOpen = open;
  settle();
};
