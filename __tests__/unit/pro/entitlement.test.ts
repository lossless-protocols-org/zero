/**
 * The entitlement decision (3.0 laws L2 and L3,
 * handbook/blueprint/ZERO_3.0_ENTITLEMENT.md §3): one pure function, an
 * answer for every input, and a downgrade only when the store positively
 * says so. The tables pin what each store fact means; the properties run the
 * function over generated answers and earlier decisions it was never shown.
 */
import fc from 'fast-check';
import {IOS_OFFLINE_ALLOWANCE_DAYS, NO_ENTITLEMENT, isPro, reduce} from '../../../src/pro/entitlement';
import {
  parseEntitlement,
  type Entitlement,
  type EntitlementState,
  type StoreAnswer,
  type StoreRecord,
  type StoreStatus,
} from '../../../src/pro/schema';

const DAY = 86_400_000;
const NOW = Date.UTC(2027, 3, 10, 12);
const ALLOWANCE = IOS_OFFLINE_ALLOWANCE_DAYS * DAY;

const PLAY_SUB = 'zero_pro';
const APPLE_SUB = 'zero_pro_monthly';
const LIFETIME = 'zero_pro_lifetime';
const THANKS = 'zero_pro_lifetime_thanks';

const STATES: EntitlementState[] = [
  'none',
  'pending',
  'trial',
  'subscribed',
  'grace',
  'onHold',
  'expired',
  'revoked',
  'lifetime',
];
const STATUSES: StoreStatus[] = ['active', 'trial', 'grace', 'onHold', 'pending', 'expired', 'revoked'];

const record = (productId: string, status: StoreStatus, more: Partial<StoreRecord> = {}): StoreRecord => ({
  productId,
  status,
  expiresAtMs: null,
  willRenew: null,
  verified: true,
  ...more,
});
const known = (...entitlements: StoreRecord[]): StoreAnswer => ({kind: 'known', entitlements});
const NOTHING = known();
const was = (state: EntitlementState, more: Partial<Entitlement> = {}): Entitlement => ({
  ...NO_ENTITLEMENT,
  state,
  productId: state === 'none' ? null : state === 'lifetime' ? LIFETIME : PLAY_SUB,
  ...more,
});

describe('which states turn Pro on', () => {
  it('trial, subscribed, grace and lifetime do; nothing else does', () => {
    expect(STATES.filter(isPro)).toEqual(['trial', 'subscribed', 'grace', 'lifetime']);
  });
});

describe('when the store cannot say', () => {
  it.each(['unavailable', 'network', 'disconnected', 'noStore', 'malformed', 'timeout', ''])(
    'changes nothing for any earlier decision (reason "%s")',
    reason => {
      for (const state of STATES) {
        const last = was(state, {expiresAtMs: NOW - 90 * DAY, willRenew: false, endedAtMs: NOW - DAY});
        // The very same object: nothing to store, nothing to reconcile.
        expect(reduce({kind: 'unknown', reason}, last, NOW)).toBe(last);
      }
    },
  );
});

describe('what one store record means, on a phone that never had Pro', () => {
  it.each<[StoreStatus, EntitlementState]>([
    ['active', 'subscribed'],
    ['trial', 'trial'],
    ['grace', 'grace'],
    ['onHold', 'onHold'],
    ['pending', 'pending'],
    ['expired', 'expired'],
    ['revoked', 'revoked'],
  ])('a subscription the store calls %s is %s', (status, state) => {
    for (const productId of [PLAY_SUB, APPLE_SUB]) {
      expect(reduce(known(record(productId, status)), NO_ENTITLEMENT, NOW)).toMatchObject({state, productId});
    }
  });

  it.each<[StoreStatus, EntitlementState]>([
    ['active', 'lifetime'],
    ['pending', 'pending'],
    ['revoked', 'revoked'],
    // Statuses a one-time purchase cannot have count for nothing.
    ['trial', 'none'],
    ['grace', 'none'],
    ['onHold', 'none'],
    ['expired', 'none'],
  ])('a one-time purchase the store calls %s is %s', (status, state) => {
    for (const productId of [LIFETIME, THANKS]) {
      expect(reduce(known(record(productId, status)), NO_ENTITLEMENT, NOW).state).toBe(state);
    }
  });

  it('keeps the end date and the renewal flag of a running subscription, and of nothing else', () => {
    const facts = {expiresAtMs: NOW + 20 * DAY, willRenew: false};
    for (const status of ['active', 'trial', 'grace'] as const) {
      expect(reduce(known(record(APPLE_SUB, status, facts)), NO_ENTITLEMENT, NOW)).toMatchObject(facts);
    }
    for (const status of ['onHold', 'pending', 'revoked'] as const) {
      expect(reduce(known(record(APPLE_SUB, status, facts)), NO_ENTITLEMENT, NOW)).toMatchObject({
        expiresAtMs: null,
        willRenew: null,
      });
    }
    expect(reduce(known(record(LIFETIME, 'active', facts)), NO_ENTITLEMENT, NOW)).toMatchObject({
      expiresAtMs: null,
      willRenew: null,
    });
  });

  it('keeps Pro when all the store has is a record it could not verify: unreadable is not "no"', () => {
    const unverified = known(record(LIFETIME, 'active', {verified: false}));
    const owned = was('lifetime');
    expect(reduce(unverified, owned, NOW)).toBe(owned);
    const subscribed = was('subscribed');
    expect(reduce(known(record(PLAY_SUB, 'active', {verified: false})), subscribed, NOW)).toBe(subscribed);
    // A verified refund of the product that was on still ends it.
    const refunded = known(record(LIFETIME, 'active', {verified: false}), record(LIFETIME, 'revoked'));
    expect(reduce(refunded, owned, NOW)).toMatchObject({state: 'revoked', endedAtMs: NOW});
  });

  it('ignores a record the store did not verify, and a product zero does not sell', () => {
    expect(reduce(known(record(LIFETIME, 'active', {verified: false})), NO_ENTITLEMENT, NOW)).toBe(NO_ENTITLEMENT);
    expect(reduce(known(record('zero_pro_gold', 'active')), NO_ENTITLEMENT, NOW)).toBe(NO_ENTITLEMENT);
    expect(reduce(known(record('toString', 'active')), NO_ENTITLEMENT, NOW)).toBe(NO_ENTITLEMENT);
  });
});

describe('a payment that has not cleared', () => {
  it('never turns Pro on, whatever product it is for', () => {
    for (const productId of [PLAY_SUB, APPLE_SUB, LIFETIME, THANKS]) {
      const next = reduce(known(record(productId, 'pending')), NO_ENTITLEMENT, NOW);
      expect(next.state).toBe('pending');
      expect(isPro(next.state)).toBe(false);
    }
  });

  it('turns Pro on by itself when the store confirms it', () => {
    const pending = reduce(known(record(LIFETIME, 'pending')), NO_ENTITLEMENT, NOW);
    expect(reduce(known(record(LIFETIME, 'active')), pending, NOW + DAY).state).toBe('lifetime');
  });

  it('goes back to nothing when it is declined, or to "ended" for someone who had Pro before', () => {
    expect(reduce(NOTHING, was('pending'), NOW)).toBe(NO_ENTITLEMENT);
    expect(reduce(NOTHING, was('pending', {endedAtMs: NOW - 30 * DAY}), NOW)).toMatchObject({
      state: 'expired',
      endedAtMs: NOW - 30 * DAY,
    });
  });

  it('is shown ahead of a failed payment, and reads the same on every refresh', () => {
    const both = known(record(PLAY_SUB, 'onHold'), record(PLAY_SUB, 'pending'));
    const first = reduce(both, NO_ENTITLEMENT, NOW);
    expect(first.state).toBe('pending');
    expect(reduce(both, first, NOW + DAY)).toEqual(first);
    // Also for someone whose earlier purchase of another product was refunded.
    const refunded = was('revoked', {productId: LIFETIME, endedAtMs: NOW - 30 * DAY});
    const again = reduce(both, refunded, NOW);
    expect(again).toMatchObject({state: 'pending', productId: PLAY_SUB, endedAtMs: NOW - 30 * DAY});
    expect(reduce(both, again, NOW + DAY)).toEqual(again);
  });

  it('does not take Pro away from a subscriber who is buying lifetime', () => {
    const subscribed = reduce(known(record(PLAY_SUB, 'active')), NO_ENTITLEMENT, NOW);
    const both = known(record(PLAY_SUB, 'active'), record(LIFETIME, 'pending'));
    expect(reduce(both, subscribed, NOW).state).toBe('subscribed');
  });
});

describe('lifetime', () => {
  it('beats every subscription state', () => {
    for (const status of STATUSES) {
      const answer = known(record(APPLE_SUB, status), record(LIFETIME, 'active'));
      expect(reduce(answer, NO_ENTITLEMENT, NOW)).toMatchObject({state: 'lifetime', productId: LIFETIME});
    }
  });

  it('says so when a subscription is still renewing, because only the user can cancel it', () => {
    const renewing = (status: StoreStatus, willRenew: boolean | null) =>
      reduce(known(record(LIFETIME, 'active'), record(PLAY_SUB, status, {willRenew})), NO_ENTITLEMENT, NOW)
        .alsoSubscribed;
    expect(renewing('active', true)).toBe(true);
    expect(renewing('active', null)).toBe(true); // Google Play does not always say; assume it renews
    expect(renewing('trial', true)).toBe(true);
    expect(renewing('grace', true)).toBe(true);
    expect(renewing('active', false)).toBe(false); // already cancelled
    expect(renewing('onHold', true)).toBe(false);
    expect(renewing('expired', null)).toBe(false);
    expect(reduce(known(record(LIFETIME, 'active')), NO_ENTITLEMENT, NOW).alsoSubscribed).toBe(false);
  });

  it('is never ended by the offline allowance or by time: only the store taking it back ends it', () => {
    const owned = was('lifetime');
    expect(reduce(known(record(LIFETIME, 'active')), owned, NOW + 5000 * DAY).state).toBe('lifetime');
    expect(reduce(NOTHING, owned, NOW)).toMatchObject({state: 'revoked', productId: LIFETIME, endedAtMs: NOW});
    expect(reduce(known(record(LIFETIME, 'revoked')), owned, NOW)).toMatchObject({state: 'revoked', endedAtMs: NOW});
  });
});

describe('when the store answers and reports nothing', () => {
  it.each<[EntitlementState, EntitlementState]>([
    ['none', 'none'],
    ['pending', 'none'],
    ['trial', 'expired'],
    ['subscribed', 'expired'],
    ['grace', 'expired'],
    ['onHold', 'expired'],
    ['expired', 'expired'],
    ['revoked', 'revoked'],
    ['lifetime', 'revoked'],
  ])('%s becomes %s (no end date known, as on Google Play)', (before, after) => {
    expect(reduce(NOTHING, was(before), NOW).state).toBe(after);
  });

  it('says a lapsed subscription ended, not that it was refunded, when the store also lists an old refund', () => {
    const oldRefund = known(record(THANKS, 'revoked'));
    const next = reduce(oldRefund, was('subscribed'), NOW);
    expect(next).toMatchObject({state: 'expired', productId: PLAY_SUB, endedAtMs: NOW});
    // And it still says so on every later refresh.
    expect(reduce(oldRefund, next, NOW + DAY)).toBe(next);
  });

  it('shows a payment that is clearing for another product once the subscription has lapsed', () => {
    const next = reduce(known(record(LIFETIME, 'pending')), was('subscribed'), NOW);
    expect(next).toMatchObject({state: 'pending', productId: LIFETIME, endedAtMs: NOW});
  });

  it('keeps naming the product that ended, so the words can say what it was', () => {
    expect(reduce(NOTHING, was('subscribed', {productId: APPLE_SUB}), NOW).productId).toBe(APPLE_SUB);
  });

  it('calls it "ended" on a phone that never had Pro, when the store says a subscription ran out', () => {
    const next = reduce(known(record(APPLE_SUB, 'expired')), NO_ENTITLEMENT, NOW);
    expect(next).toEqual({...NO_ENTITLEMENT, state: 'expired', productId: APPLE_SUB});
  });
});

describe('the moment Pro ends', () => {
  it('is recorded once, when Pro goes off', () => {
    const next = reduce(NOTHING, was('subscribed'), NOW);
    expect(next.endedAtMs).toBe(NOW);
  });

  it('stays the same while Pro stays off, so one ending shows one notice', () => {
    const onHold = reduce(known(record(PLAY_SUB, 'onHold')), was('subscribed'), NOW);
    expect(onHold).toMatchObject({state: 'onHold', endedAtMs: NOW});
    const later = reduce(NOTHING, onHold, NOW + 40 * DAY);
    expect(later).toMatchObject({state: 'expired', endedAtMs: NOW});
    expect(reduce(NOTHING, later, NOW + 80 * DAY)).toBe(later);
  });

  it('is cleared when Pro is on again, and recorded afresh the next time it ends', () => {
    const ended = reduce(NOTHING, was('subscribed'), NOW);
    const back = reduce(known(record(PLAY_SUB, 'active')), ended, NOW + DAY);
    expect(back).toMatchObject({state: 'subscribed', endedAtMs: null});
    expect(reduce(NOTHING, back, NOW + 9 * DAY).endedAtMs).toBe(NOW + 9 * DAY);
  });

  it('is not invented on a phone where Pro was never on', () => {
    for (const status of ['onHold', 'pending', 'expired', 'revoked'] as const) {
      expect(reduce(known(record(PLAY_SUB, status)), NO_ENTITLEMENT, NOW).endedAtMs).toBeNull();
    }
  });
});

describe('the offline allowance for a renewing App Store subscription', () => {
  const ENDS = NOW - DAY;
  const renewing = was('subscribed', {productId: APPLE_SUB, expiresAtMs: ENDS, willRenew: true});

  it('keeps Pro on, unchanged, while the store reports nothing and the allowance has not run out', () => {
    expect(reduce(NOTHING, renewing, NOW)).toBe(renewing);
    expect(reduce(NOTHING, renewing, ENDS + ALLOWANCE - 1)).toBe(renewing);
  });

  it('does not apply before the paid period has ended: the cache still holds the purchase then', () => {
    // Nothing reported with twenty days still paid for means a refund, or another store account.
    const midPeriod = {...renewing, expiresAtMs: NOW + 20 * DAY};
    expect(reduce(NOTHING, midPeriod, NOW)).toMatchObject({state: 'expired', endedAtMs: NOW});
    // The very moment it ends, the allowance begins.
    const endsNow = {...renewing, expiresAtMs: NOW};
    expect(reduce(NOTHING, endsNow, NOW)).toBe(endsNow);
  });

  it('ends Pro once the allowance has run out', () => {
    expect(reduce(NOTHING, renewing, ENDS + ALLOWANCE)).toMatchObject({state: 'expired', endedAtMs: ENDS + ALLOWANCE});
  });

  it('is not given when the store says the period ran out with renewal switched off', () => {
    // Cancelled in the system settings while the app was closed: the phone still holds "will renew".
    const cancelled = record(APPLE_SUB, 'expired', {expiresAtMs: ENDS, willRenew: false});
    expect(reduce(known(cancelled), renewing, NOW)).toMatchObject({state: 'expired', endedAtMs: NOW});
    // Offline at renewal, the store's cache still reads "will renew" (or cannot say): the allowance holds.
    for (const willRenew of [true, null]) {
      const lapsed = record(APPLE_SUB, 'expired', {expiresAtMs: ENDS, willRenew});
      expect(reduce(known(lapsed), renewing, NOW)).toBe(renewing);
    }
    // Another product's cancelled subscription ends nothing here.
    const other = record(PLAY_SUB, 'expired', {expiresAtMs: ENDS, willRenew: false});
    expect(reduce(known(other), renewing, NOW)).toBe(renewing);
  });

  it('also covers a cached "expired": offline, the phone cannot have heard of the renewal', () => {
    expect(reduce(known(record(APPLE_SUB, 'expired')), renewing, NOW)).toBe(renewing);
  });

  it('covers a trial and a grace period the same way', () => {
    for (const state of ['trial', 'grace'] as const) {
      const last = {...renewing, state};
      expect(reduce(NOTHING, last, NOW)).toBe(last);
    }
  });

  it('does not apply when renewal was switched off: the end was expected', () => {
    const cancelled = {...renewing, willRenew: false};
    expect(reduce(NOTHING, cancelled, NOW)).toMatchObject({state: 'expired', endedAtMs: NOW});
  });

  it('does not apply where the store gave no end date (Google Play)', () => {
    expect(reduce(NOTHING, was('subscribed', {willRenew: true}), NOW).state).toBe('expired');
  });

  it('never overrides the store saying so on purpose: a refund or a failed payment out of grace', () => {
    expect(reduce(known(record(APPLE_SUB, 'revoked')), renewing, NOW)).toMatchObject({
      state: 'revoked',
      endedAtMs: NOW,
    });
    expect(reduce(known(record(APPLE_SUB, 'onHold')), renewing, NOW)).toMatchObject({state: 'onHold', endedAtMs: NOW});
  });

  it('is not ended by an old refund of some other product', () => {
    expect(reduce(known(record(THANKS, 'revoked')), renewing, NOW)).toBe(renewing);
    expect(reduce(known(record(PLAY_SUB, 'onHold')), renewing, NOW)).toBe(renewing);
  });

  it('is not ended by an unrelated payment that is still clearing', () => {
    expect(reduce(known(record(LIFETIME, 'pending')), renewing, NOW)).toBe(renewing);
  });

  it('is as long as it is told to be', () => {
    expect(reduce(NOTHING, renewing, NOW, 0).state).toBe('expired');
    expect(reduce(NOTHING, renewing, NOW + 29 * DAY, 30 * DAY + DAY)).toBe(renewing);
  });

  it('is replaced by fresh facts the moment the store reports the renewal', () => {
    const renewed = record(APPLE_SUB, 'active', {expiresAtMs: ENDS + 30 * DAY, willRenew: true});
    expect(reduce(known(renewed), renewing, NOW)).toMatchObject({state: 'subscribed', expiresAtMs: ENDS + 30 * DAY});
  });
});

describe('for any answer and any earlier decision', () => {
  // Far more cases than the default hundred: the function is pure and quick, and the first
  // run of these properties at a hundred cases missed a flaw that some seeds found.
  beforeAll(() => {
    fc.configureGlobal({numRuns: 5000});
  });
  afterAll(() => {
    fc.resetConfigureGlobal();
  });

  const productId = fc.constantFrom(PLAY_SUB, APPLE_SUB, LIFETIME, THANKS, 'something_else', '__proto__');
  const time = fc.integer({min: 0, max: 4_102_444_800_000});
  const nullable = <T>(arbitrary: fc.Arbitrary<T>) => fc.option(arbitrary, {nil: null});
  const storeRecord: fc.Arbitrary<StoreRecord> = fc.record({
    productId,
    status: fc.constantFrom(...STATUSES),
    expiresAtMs: nullable(time),
    willRenew: nullable(fc.boolean()),
    verified: fc.boolean(),
  });
  const answer: fc.Arbitrary<StoreAnswer> = fc.oneof(
    fc.record({kind: fc.constant('known' as const), entitlements: fc.array(storeRecord, {maxLength: 5})}),
    fc.record({kind: fc.constant('unknown' as const), reason: fc.string()}),
  );
  const entitlement: fc.Arbitrary<Entitlement> = fc.record({
    state: fc.constantFrom(...STATES),
    productId: nullable(productId),
    expiresAtMs: nullable(time),
    willRenew: nullable(fc.boolean()),
    alsoSubscribed: fc.boolean(),
    endedAtMs: nullable(time),
  });
  const grants = (r: StoreRecord): boolean =>
    r.verified &&
    (([PLAY_SUB, APPLE_SUB].includes(r.productId) && ['active', 'trial', 'grace'].includes(r.status)) ||
      ([LIFETIME, THANKS].includes(r.productId) && r.status === 'active'));

  it('returns one well-formed entitlement and never throws', () => {
    fc.assert(
      fc.property(answer, entitlement, time, (a, last, now) => {
        const next = reduce(a, last, now);
        expect(parseEntitlement(JSON.stringify(next))).toEqual(next);
      }),
    );
  });

  it('gives the same decision when the same answer arrives twice', () => {
    fc.assert(
      fc.property(answer, entitlement, time, (a, last, now) => {
        const once = reduce(a, last, now);
        expect(reduce(a, once, now)).toEqual(once);
      }),
    );
  });

  it('turns Pro on only for a verified record that grants it, or keeps a Pro it already had', () => {
    fc.assert(
      fc.property(answer, entitlement, time, (a, last, now) => {
        const next = reduce(a, last, now);
        if (isPro(next.state) && !isPro(last.state)) {
          expect(a.kind === 'known' && a.entitlements.some(grants)).toBe(true);
        }
      }),
    );
  });

  it('is on whenever a verified record grants it, whatever came before', () => {
    fc.assert(
      fc.property(fc.array(storeRecord, {maxLength: 5}), entitlement, time, (records, last, now) => {
        fc.pre(records.some(grants));
        expect(isPro(reduce({kind: 'known', entitlements: records}, last, now).state)).toBe(true);
      }),
    );
  });

  it('decides the same with the products zero does not sell removed', () => {
    fc.assert(
      fc.property(fc.array(storeRecord, {maxLength: 5}), entitlement, time, (records, last, now) => {
        const sold = records.filter(r => [PLAY_SUB, APPLE_SUB, LIFETIME, THANKS].includes(r.productId));
        expect(reduce({kind: 'known', entitlements: records}, last, now)).toEqual(
          reduce({kind: 'known', entitlements: sold}, last, now),
        );
      }),
    );
  });

  it('is never switched on, and never switched off, by records the store could not verify', () => {
    const unverified = storeRecord.map(r => ({...r, verified: false}));
    fc.assert(
      fc.property(fc.array(unverified, {minLength: 1, maxLength: 5}), entitlement, time, (records, last, now) => {
        const next = reduce({kind: 'known', entitlements: records}, last, now);
        if (!isPro(last.state)) {
          expect(isPro(next.state)).toBe(false);
        } else if (records.some(r => [PLAY_SUB, APPLE_SUB, LIFETIME, THANKS].includes(r.productId))) {
          expect(next.state).toBe(last.state);
        }
      }),
    );
  });

  it('has an end moment exactly while Pro is off after having been on, and none while it is on', () => {
    fc.assert(
      fc.property(answer, entitlement, time, (a, last, now) => {
        const next = reduce(a, last, now);
        if (a.kind === 'unknown') {
          return;
        }
        if (isPro(next.state)) {
          expect(next.endedAtMs).toBeNull();
        } else if (isPro(last.state)) {
          expect(next.endedAtMs).toBe(now);
        } else {
          expect(next.endedAtMs).toBe(last.endedAtMs);
        }
      }),
    );
  });
});
