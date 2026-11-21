import type {Billing} from '../../src/pro/billing';
import type {OriginalInstall, PurchaseOutcome, StoreAnswer, StoreProduct, StoreRecord} from '../../src/pro/schema';

/**
 * A store for tests, with the surface of src/pro/billing.ts (docs/NATIVE.md:
 * every native module that reaches outside the app has a JavaScript fake).
 * A test says what the store holds and what it does next; everything above
 * the gateway then runs for real.
 */
export interface FakeBilling extends Billing {
  /** From now on the store answers with exactly these records. */
  owns: (...records: StoreRecord[]) => void;
  /** From now on the store cannot say (offline, disconnected, missing). */
  cannotSay: (reason?: string) => void;
  /** The store reports a change on its own: a payment cleared, a refund, a renewal. */
  announce: () => void;
  /** How the next purchase ends. `purchased` and `pending` also put the product in the store's answer. */
  nextPurchase: (outcome: PurchaseOutcome) => void;
  /** Every answer is held back until the returned function is called (a slow store). */
  hold: () => () => void;
  products: StoreProduct[];
  originalInstall: OriginalInstall;
  /** The calls made so far, in order. */
  calls: string[];
}

export const fakeRecord = (
  productId: string,
  status: StoreRecord['status'] = 'active',
  more: Partial<StoreRecord> = {},
): StoreRecord => ({productId, status, expiresAtMs: null, willRenew: null, verified: true, ...more});

export const createFakeBilling = (): FakeBilling => {
  let answer: StoreAnswer = {kind: 'known', entitlements: []};
  let outcome: PurchaseOutcome = 'purchased';
  let gate: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  const calls: string[] = [];

  const answered = async (call: string): Promise<StoreAnswer> => {
    calls.push(call);
    // What the store held when it was asked, delivered when it gets round to answering.
    const snapshot = answer;
    await gate;
    return snapshot;
  };

  const fake: FakeBilling = {
    isAvailable: async () => true,
    getProducts: async ids => {
      calls.push(`getProducts ${ids.join(',')}`);
      return fake.products.filter(product => ids.includes(product.id));
    },
    purchase: async productId => {
      calls.push(`purchase ${productId}`);
      const ended = outcome;
      outcome = 'purchased';
      if (ended === 'purchased' || ended === 'pending') {
        const held = answer.kind === 'known' ? answer.entitlements.filter(r => r.productId !== productId) : [];
        fake.owns(...held, fakeRecord(productId, ended === 'pending' ? 'pending' : 'active'));
      }
      return ended;
    },
    getEntitlements: () => answered('getEntitlements'),
    restore: () => answered('restore'),
    openManageSubscriptions: async () => {
      calls.push('openManageSubscriptions');
      return true;
    },
    getOriginalInstall: async () => fake.originalInstall,
    onChange: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    owns: (...records) => {
      answer = {kind: 'known', entitlements: records};
    },
    cannotSay: (reason = 'unavailable') => {
      answer = {kind: 'unknown', reason};
    },
    announce: () => {
      listeners.forEach(listener => listener());
    },
    nextPurchase: ended => {
      outcome = ended;
    },
    hold: () => {
      let release: () => void = () => {};
      gate = new Promise<void>(resolve => {
        release = resolve;
      });
      return release;
    },
    products: [],
    originalInstall: {signed: false, build: null},
    calls,
  };
  return fake;
};
