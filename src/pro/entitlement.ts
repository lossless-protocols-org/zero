import {productKind} from './products';
import type {Entitlement, EntitlementState, StoreAnswer, StoreRecord, StoreStatus} from './schema';

/**
 * The one decision about who is paying (handbook/blueprint/ZERO_3.0_ENTITLEMENT.md
 * §3, laws L2 and L3). `reduce` is pure and total: for every store answer and
 * every earlier decision it returns exactly one entitlement, and it never
 * throws. Nothing else in the app decides this, and nothing here touches the
 * user's data.
 */

/**
 * How long a renewing App Store subscription stays on after its last verified
 * period ends while the store reports nothing. A phone that is offline at
 * renewal only sees what was cached, so a paying subscriber would otherwise
 * be switched off mid-trip. Provisional until the airplane-mode test (plan,
 * spike S3). Google Play gives no end date, so this never applies there.
 * @internal Read outside this file only by its tests.
 */
export const IOS_OFFLINE_ALLOWANCE_DAYS = 7;
const DAY_MS = 86_400_000;

/** Nobody has paid and nobody ever did. */
export const NO_ENTITLEMENT: Entitlement = {
  state: 'none',
  productId: null,
  expiresAtMs: null,
  willRenew: null,
  alsoSubscribed: false,
  endedAtMs: null,
};

const PRO_STATES: readonly EntitlementState[] = ['trial', 'subscribed', 'grace', 'lifetime'];

/**
 * Whether a state turns Pro on. `pending` does not: the money has not arrived.
 * Screens ask through hooks from plan P6.
 */
export const isPro = (state: EntitlementState): boolean => PRO_STATES.includes(state);

const SUBSCRIPTION_STATE: Readonly<Record<StoreStatus, EntitlementState>> = {
  active: 'subscribed',
  trial: 'trial',
  grace: 'grace',
  onHold: 'onHold',
  pending: 'pending',
  expired: 'expired',
  revoked: 'revoked',
};

/** A one-time purchase is owned, still clearing, or taken back; no other status applies to it. */
const LIFETIME_STATE: Readonly<Partial<Record<StoreStatus, EntitlementState>>> = {
  active: 'lifetime',
  pending: 'pending',
  revoked: 'revoked',
};

/**
 * When the store reports several things, the one that decides: what grants most, first. Among
 * what does not grant, a payment still clearing comes first: it is what the user is waiting on,
 * and it is shown whatever product was on before, so the same answer always reads the same.
 */
const ORDER: readonly EntitlementState[] = [
  'lifetime',
  'subscribed',
  'trial',
  'grace',
  'pending',
  'onHold',
  'revoked',
  'expired',
];

interface Candidate {
  state: EntitlementState;
  record: StoreRecord;
}

/** What one store record would make the entitlement, or nothing for a record that does not count. */
const candidateOf = (record: StoreRecord): Candidate[] => {
  if (!record.verified) {
    return [];
  }
  const kind = productKind(record.productId);
  const state = kind === 'lifetime' ? LIFETIME_STATE[record.status] : kind ? SUBSCRIPTION_STATE[record.status] : null;
  return state ? [{state, record}] : [];
};

const fromRecord = ({state, record}: Candidate, last: Entitlement, alsoSubscribed: boolean): Entitlement => {
  const periodic = state === 'trial' || state === 'subscribed' || state === 'grace';
  return {
    state,
    productId: record.productId,
    expiresAtMs: periodic ? record.expiresAtMs : null,
    willRenew: periodic ? record.willRenew : null,
    alsoSubscribed: state === 'lifetime' && alsoSubscribed,
    endedAtMs: last.endedAtMs,
  };
};

/**
 * A renewing subscription whose verified period has ended, less than the allowance ago, stays
 * on. Only once the period has ended: before that the store's cache still holds the purchase,
 * so a store that reports nothing means it was refunded or belongs to another store account.
 */
const keptByAllowance = (last: Entitlement, nowMs: number, allowanceMs: number): boolean =>
  last.state !== 'lifetime' &&
  last.expiresAtMs !== null &&
  last.willRenew !== false &&
  nowMs >= last.expiresAtMs &&
  nowMs < last.expiresAtMs + allowanceMs;

/** The entitlement when the store answered and nothing it reported grants, clears or ends anything. */
const whenNothingIsReported = (last: Entitlement, expired: StoreRecord | undefined): Entitlement => {
  const ended = (state: EntitlementState): Entitlement => ({
    ...NO_ENTITLEMENT,
    state,
    productId: last.productId,
    endedAtMs: last.endedAtMs,
  });
  if (last.state === 'lifetime') {
    // A one-time purchase never lapses: it is gone because it was refunded or revoked.
    return ended('revoked');
  }
  if (isPro(last.state) || last.state === 'onHold') {
    return ended('expired');
  }
  if (last.state === 'expired' || last.state === 'revoked') {
    return last;
  }
  // 'none', or a payment that never cleared: back to what it was before.
  if (last.endedAtMs !== null) {
    return ended('expired');
  }
  // Never had Pro on this phone. The store may still say a subscription ran out elsewhere.
  return expired ? {...NO_ENTITLEMENT, state: 'expired', productId: expired.productId} : NO_ENTITLEMENT;
};

/** Records the moment Pro ends, once, and clears it when Pro is on again. */
const withEnding = (last: Entitlement, next: Entitlement, nowMs: number): Entitlement => {
  if (isPro(next.state)) {
    return next.endedAtMs === null ? next : {...next, endedAtMs: null};
  }
  return isPro(last.state) ? {...next, endedAtMs: nowMs} : next;
};

/**
 * The entitlement after a store answer.
 *
 * - "unknown" (any error, no store, offline with nothing cached, a garbled
 *   reply) changes nothing: zero downgrades only on a positive answer (L3).
 * - A verified lifetime purchase beats everything. `alsoSubscribed` then says
 *   a subscription is still renewing, which only the user can cancel.
 * - `pending` never grants. A refund (`revoked`) and a failed payment out of
 *   grace (`onHold`) end Pro at once.
 * - When the store reports nothing that grants, a renewing App Store
 *   subscription stays on for the offline allowance past its verified end;
 *   one the store says ran out with renewal off ends at once.
 * - A record the store could not verify never grants and never ends Pro.
 */
export const reduce = (
  answer: StoreAnswer,
  last: Entitlement,
  nowMs: number,
  allowanceMs: number = IOS_OFFLINE_ALLOWANCE_DAYS * DAY_MS,
): Entitlement => {
  if (answer.kind === 'unknown') {
    return last;
  }
  const candidates = answer.entitlements
    .flatMap(candidateOf)
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state));
  const [best] = candidates;

  if (best && isPro(best.state)) {
    const stillRenewing = candidates.some(
      ({state, record}) =>
        productKind(record.productId) === 'subscription' && isPro(state) && record.willRenew !== false,
    );
    return withEnding(last, fromRecord(best, last, stillRenewing), nowMs);
  }

  // Nothing grants.
  const proBefore = isPro(last.state);
  // The store saying so on purpose, about the very product that was on: a refund, a payment
  // that failed past its grace, or a period that ran out with renewal switched off (the user
  // cancelled; a phone that was merely offline at renewal still reads "will renew"). An old
  // refund of some other product ends nothing.
  const endedOnPurpose = candidates.some(
    ({state, record}) =>
      record.productId === last.productId &&
      (state === 'revoked' || state === 'onHold' || (state === 'expired' && record.willRenew === false)),
  );
  // A record the store could not verify is an unreadable reply, not a "no": it grants nothing
  // (it was dropped above) and it takes nothing away.
  const unreadable = answer.entitlements.some(record => !record.verified && productKind(record.productId) !== null);
  if (proBefore && !endedOnPurpose && (unreadable || keptByAllowance(last, nowMs, allowanceMs))) {
    // Unchanged (the same object) unless a stored value carried an end moment while Pro was on.
    return withEnding(last, last, nowMs);
  }
  // What to show now: a payment still clearing, or what the store says about the product that
  // was on (or, once it has ended, the product that ended: an old refund of something else
  // must not rename the ending on the next refresh). Someone who never had Pro on this phone
  // is shown whatever the store reports.
  const hadPro = proBefore || last.endedAtMs !== null;
  const shown = candidates.find(
    ({state, record}) => state !== 'expired' && (state === 'pending' || !hadPro || record.productId === last.productId),
  );
  const next = shown
    ? fromRecord(shown, last, false)
    : whenNothingIsReported(last, candidates.find(({state}) => state === 'expired')?.record);
  return withEnding(last, next, nowMs);
};
