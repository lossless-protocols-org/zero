/**
 * The store gateway (3.0, docs/NATIVE.md): no call throws or rejects, and a
 * store that is missing, failing or unreadable is "did not say", so an error
 * can never read as "owns nothing" (law L3).
 */
import type {Spec} from '../../../src/native/specs/NativeBilling';
import {createBilling, nativeBilling} from '../../../src/pro/billing';
import {UNSIGNED_INSTALL} from '../../../src/pro/schema';

const KNOWN = {
  kind: 'known',
  entitlements: [{productId: 'zero_pro', status: 'active', expiresAtMs: null, willRenew: true, verified: true}],
};

/** A native module that answers as told. Only what a test names is real; the rest rejects. */
const nativeModule = (answers: Partial<Spec>): Spec => {
  const refuse = (name: string) => () => Promise.reject(new Error(`${name} was not expected`));
  return {
    getConstants: () => ({}),
    isAvailable: refuse('isAvailable'),
    getProducts: refuse('getProducts'),
    purchase: refuse('purchase'),
    getEntitlements: refuse('getEntitlements'),
    restore: refuse('restore'),
    openManageSubscriptions: refuse('openManageSubscriptions'),
    getOriginalInstall: refuse('getOriginalInstall'),
    onEntitlementsChanged: () => {
      throw new Error('onEntitlementsChanged was not expected');
    },
    ...answers,
  };
};

describe('a build with no store module', () => {
  const reports: unknown[] = [];
  const billing = createBilling(null, error => reports.push(error));

  it('cannot say what is owned, which is not the same as owning nothing', async () => {
    expect(await billing.getEntitlements()).toEqual({kind: 'unknown', reason: 'noStore'});
    expect(await billing.restore()).toEqual({kind: 'unknown', reason: 'noStore'});
  });

  it('offers nothing, sells nothing and opens nothing', async () => {
    expect(await billing.isAvailable()).toBe(false);
    expect(await billing.getProducts(['zero_pro'])).toEqual([]);
    expect(await billing.purchase('zero_pro')).toBe('unavailable');
    expect(await billing.openManageSubscriptions()).toBe(false);
    expect(await billing.getOriginalInstall()).toEqual(UNSIGNED_INSTALL);
    expect(() => billing.onChange(() => {})()).not.toThrow();
  });

  it('reports no error for it: a missing store is expected', () => {
    expect(reports).toEqual([]);
  });

  it('is what this build has until the native modules land', async () => {
    expect(await nativeBilling.getEntitlements()).toEqual({kind: 'unknown', reason: 'noStore'});
  });
});

describe('a store that answers', () => {
  it('passes on what it owns, offers and decided', async () => {
    const products = [
      {id: 'zero_pro', displayPrice: '₱99.00', currencyCode: 'PHP', period: 'month', trialDays: 14, offerToken: 't1'},
    ];
    const purchase = jest.fn(async () => 'pending');
    const getProducts = jest.fn(async () => JSON.stringify(products));
    const billing = createBilling(
      nativeModule({
        isAvailable: async () => true,
        getProducts,
        purchase,
        getEntitlements: async () => JSON.stringify(KNOWN),
        restore: async () => JSON.stringify({kind: 'known', entitlements: []}),
        openManageSubscriptions: async () => undefined,
        getOriginalInstall: async () => '{"signed":true,"build":24}',
      }),
      () => {},
    );
    expect(await billing.isAvailable()).toBe(true);
    expect(await billing.getProducts(['zero_pro'])).toEqual(products);
    expect(getProducts).toHaveBeenCalledWith(['zero_pro']);
    expect(await billing.purchase('zero_pro', 't1')).toBe('pending');
    expect(purchase).toHaveBeenLastCalledWith('zero_pro', 't1');
    // No offer token is sent as '': the bridge has no null for a string.
    await billing.purchase('zero_pro_lifetime');
    expect(purchase).toHaveBeenLastCalledWith('zero_pro_lifetime', '');
    await billing.purchase('zero_pro_lifetime', null);
    expect(purchase).toHaveBeenLastCalledWith('zero_pro_lifetime', '');
    expect(await billing.getEntitlements()).toEqual(KNOWN);
    expect(await billing.restore()).toEqual({kind: 'known', entitlements: []});
    expect(await billing.openManageSubscriptions()).toBe(true);
    expect(await billing.getOriginalInstall()).toEqual({signed: true, build: 24});
  });

  it('tells a listener when the store reports a change, until it stops listening', () => {
    const remove = jest.fn();
    let fire: () => void = () => {};
    const billing = createBilling(
      nativeModule({
        onEntitlementsChanged: handler => {
          fire = () => {
            void handler();
          };
          return {remove};
        },
      }),
      () => {},
    );
    const listener = jest.fn();
    const stop = billing.onChange(listener);
    fire();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('a store that fails', () => {
  it('does not throw when it cannot stop listening, and reports it', () => {
    const reports: string[] = [];
    const billing = createBilling(
      nativeModule({
        onEntitlementsChanged: () => ({
          remove: () => {
            throw new Error('emitter already gone');
          },
        }),
      }),
      error => reports.push(error instanceof Error ? error.message : ''),
    );
    expect(() => billing.onChange(() => {})()).not.toThrow();
    expect(reports).toEqual(['billing.onChange: emitter already gone']);
  });

  it('never rejects: every call falls back to "did not say", "nothing on offer" or "failed"', async () => {
    const reports: string[] = [];
    const billing = createBilling(nativeModule({}), error => reports.push(error instanceof Error ? error.message : ''));
    expect(await billing.isAvailable()).toBe(false);
    expect(await billing.getProducts(['zero_pro'])).toEqual([]);
    expect(await billing.purchase('zero_pro')).toBe('failed');
    expect(await billing.getEntitlements()).toEqual({kind: 'unknown', reason: 'error'});
    expect(await billing.restore()).toEqual({kind: 'unknown', reason: 'error'});
    expect(await billing.openManageSubscriptions()).toBe(false);
    expect(await billing.getOriginalInstall()).toEqual(UNSIGNED_INSTALL);
    expect(() => billing.onChange(() => {})()).not.toThrow();
    expect(reports).toEqual([
      'billing.isAvailable: isAvailable was not expected',
      'billing.getProducts: getProducts was not expected',
      'billing.purchase: purchase was not expected',
      'billing.getEntitlements: getEntitlements was not expected',
      'billing.restore: restore was not expected',
      'billing.openManageSubscriptions: openManageSubscriptions was not expected',
      'billing.getOriginalInstall: getOriginalInstall was not expected',
      'billing.onChange: onEntitlementsChanged was not expected',
    ]);
  });

  it('reports the same failure once, however often the app comes to the foreground', async () => {
    const reports: unknown[] = [];
    let cause: unknown = new Error('service disconnected');
    const billing = createBilling(nativeModule({getEntitlements: () => Promise.reject(cause)}), error =>
      reports.push(error),
    );
    await billing.getEntitlements();
    await billing.getEntitlements();
    await billing.getEntitlements();
    expect(reports).toHaveLength(1);
    // A different failure is news; one that is not an Error is still described.
    cause = 'billing unavailable';
    await billing.getEntitlements();
    expect(reports.map(error => (error instanceof Error ? error.message : ''))).toEqual([
      'billing.getEntitlements: service disconnected',
      'billing.getEntitlements: billing unavailable',
    ]);
  });

  it('treats an unreadable answer as "did not say", and an unreadable outcome as failed', async () => {
    const billing = createBilling(
      nativeModule({
        getEntitlements: async () => '{"kind":"known"}',
        getProducts: async () => 'null',
        purchase: async () => 'ok',
        getOriginalInstall: async () => '',
      }),
      () => {},
    );
    expect(await billing.getEntitlements()).toEqual({kind: 'unknown', reason: 'malformed'});
    expect(await billing.getProducts([])).toEqual([]);
    expect(await billing.purchase('zero_pro')).toBe('failed');
    expect(await billing.getOriginalInstall()).toEqual(UNSIGNED_INSTALL);
  });
});
