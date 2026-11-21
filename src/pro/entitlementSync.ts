import {AppState} from 'react-native';
import {nativeBilling, type Billing} from './billing';
import {isPro} from './entitlement';
import {refreshEntitlement} from './entitlementStore';
import type {Entitlement} from './schema';

/** After the stored period ends, long enough for the store to have settled the renewal or the expiry. */
const AFTER_PERIOD_END_MS = 5000;
/** The longest delay a timer takes (a signed 32-bit count of milliseconds, about 24 days). */
const LONGEST_TIMER_MS = 2 ** 31 - 1;

let started = false;
let periodEnd: ReturnType<typeof setTimeout> | undefined;

/**
 * Keeps the entitlement in step with the store from now on: once at start,
 * each time the app returns to the foreground, and whenever the store says
 * something changed (a payment cleared, a refund, a renewal). Both stores ask
 * for exactly this; the query reads the store's own cache, so it costs no
 * network call by zero.
 *
 * And once more just after the paid period it knows of runs out: a store need
 * not announce an expiry (Xcode's test store does not), and an app left open
 * across it would otherwise keep Pro until its next return to the foreground.
 *
 * Each refresh tells the producers the entitlement (refreshEntitlement
 * reconciles, src/pro/reconcile.ts): recurring entries and reminders follow it
 * on every start and foreground.
 *
 * Once per JS runtime, however often the app's root mounts.
 */
export const startEntitlementSync = (billing: Billing = nativeBilling): void => {
  if (started) {
    return;
  }
  started = true;
  const askAgainWhenThePeriodEnds = (entitlement: Entitlement): void => {
    clearTimeout(periodEnd);
    periodEnd = undefined;
    if (!isPro(entitlement.state) || entitlement.expiresAtMs === null) {
      return;
    }
    const wait = entitlement.expiresAtMs - Date.now() + AFTER_PERIOD_END_MS;
    // Already past (the offline allowance is holding Pro on): the next foreground asks. Never a second timer.
    if (wait > 0 && wait <= LONGEST_TIMER_MS) {
      periodEnd = setTimeout(sync, wait);
    }
  };
  const sync = (): void => {
    void refreshEntitlement(billing).then(askAgainWhenThePeriodEnds);
  };
  sync();
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      sync();
    }
  });
  billing.onChange(sync);
};
