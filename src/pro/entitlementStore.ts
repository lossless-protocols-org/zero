import {appendErrorLog} from '../platform/errorLog';
import {createMmkvPreference} from '../platform/mmkvPreference';
import {StorageService} from '../platform/storage';
import type {Billing} from './billing';
import {NO_ENTITLEMENT, reduce} from './entitlement';
import {reconcile} from './reconcile';
import {parseEntitlement, type Entitlement, type StoreAnswer} from './schema';

/**
 * The last decided entitlement, kept so a cold start draws the right tier
 * before the store has answered (handbook/blueprint/ZERO_3.0_ENTITLEMENT.md
 * §3). It is a cache of the store's answer, not an authority: the store's own
 * purchase cache is the truth, and this is replaced by the next answer.
 *
 * In MMKV, not the Keychain: the source is public, so hiding the value
 * protects nothing, and a Keychain item would outlive a refund and a
 * reinstall. A value that does not read as an entitlement is "none".
 *
 * `refreshEntitlement` is the only writer: the stored value only ever comes
 * out of `reduce`.
 */
const stored = createMmkvPreference<Entitlement>(
  'pro_entitlement',
  {
    read: key => parseEntitlement(StorageService.getItemSync(key)),
    write: (key, value) => StorageService.setItemSync(key, JSON.stringify(value)),
  },
  NO_ENTITLEMENT,
);

const same = (a: Entitlement, b: Entitlement): boolean =>
  a.state === b.state &&
  a.productId === b.productId &&
  a.expiresAtMs === b.expiresAtMs &&
  a.willRenew === b.willRenew &&
  a.alsoSubscribed === b.alsoSubscribed &&
  a.endedAtMs === b.endedAtMs;

/** The entitlement as last decided. Screens read it through `useEntitlement` (src/ui/hooks). */
export const getEntitlement = (): Entitlement => stored.get();

/** Runs `listener` whenever a new decision is stored; returns how to stop. */
export const subscribeEntitlement = (listener: () => void): (() => void) => stored.subscribe(listener);

const ignore = (): void => {};

/** What the store last said, for Diagnostics: how many records, or why it could not say. Never the records. */
export type LastStoreAnswer = {kind: 'known'; records: number} | {kind: 'unknown'; reason: string};

let lastAnswer: LastStoreAnswer | null = null;

/**
 * The entitlement and the store answer it was last decided from (null until the store has
 * been asked in this run). For Diagnostics: with no telemetry, this is how a wrong tier is
 * told apart from a store that is not answering.
 */
export const getStoreStatus = (): {entitlement: Entitlement; lastAnswer: LastStoreAnswer | null} => ({
  entitlement: stored.get(),
  lastAnswer,
});

let queue: Promise<unknown> = Promise.resolve();

/**
 * Asks the store, decides, stores the decision if it changed, and reconciles
 * (always: effects follow what is true now, not what just changed, law L4).
 * Never rejects. The store is asked and answered one call at a time, so two
 * answers can never be applied out of order. Reconciling is outside that
 * line: a slow producer delays its caller, never the next answer from the
 * store.
 */
export const refreshEntitlement = (billing: Billing, now: () => number = Date.now): Promise<Entitlement> =>
  decide(() => billing.getEntitlements(), now);

/**
 * The same, after asking the store to restore first: the Restore purchases
 * button. On the App Store that may ask for the account password, which is
 * why it runs only on a tap; on Google Play it is the ordinary question.
 */
export const restoreEntitlement = (billing: Billing, now: () => number = Date.now): Promise<Entitlement> =>
  decide(() => billing.restore(), now);

const decide = (ask: () => Promise<StoreAnswer>, now: () => number): Promise<Entitlement> => {
  const decided = queue.then(async () => {
    try {
      const answer = await ask();
      lastAnswer =
        answer.kind === 'known'
          ? {kind: 'known', records: answer.entitlements.length}
          : {kind: 'unknown', reason: answer.reason};
      const last = stored.get();
      const next = reduce(answer, last, now());
      if (!same(last, next)) {
        stored.set(next);
      }
    } catch (error) {
      // Nothing above throws by contract; if something does, the entitlement stays as it was.
      appendErrorLog(error, false);
    }
    return stored.get();
  });
  // Whatever happens to this call, the next one still gets its turn.
  queue = decided.then(ignore, ignore);
  return decided.then(async entitlement => {
    await reconcile(entitlement);
    return entitlement;
  });
};
