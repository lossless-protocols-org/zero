/**
 * The stored entitlement (3.0 laws L3 and L4): only a decision made from a
 * store answer is ever stored, an answer the store could not give changes
 * nothing, and every refresh reconciles, changed or not. Each test loads the
 * modules afresh, as a cold start does.
 */
import {createFakeBilling, fakeRecord} from '../../harness/fakeBilling';
import {getEntitlement} from '../../../src/pro/entitlementStore';
import type {Entitlement} from '../../../src/pro/schema';

const KEY = 'pro_entitlement';
const NOW = Date.UTC(2027, 3, 10, 12);
const DAY = 86_400_000;

interface Loaded {
  store: typeof import('../../../src/pro/entitlementStore');
  reconcile: typeof import('../../../src/pro/reconcile');
  storage: typeof import('../../../src/platform/storage');
  errorLog: typeof import('../../../src/platform/errorLog');
}

/** The modules as a cold start finds them, with `stored` already on the phone when given. */
const coldStart = (stored?: string): Loaded => {
  let loaded: Loaded | undefined;
  jest.isolateModules(() => {
    // Each `require` returns the module's own type; one registry, so they share the phone's storage.
    const storage = require('../../../src/platform/storage') as Loaded['storage'];
    if (stored !== undefined) {
      storage.StorageService.setItemSync(KEY, stored);
    }
    loaded = {
      storage,
      store: require('../../../src/pro/entitlementStore') as Loaded['store'],
      reconcile: require('../../../src/pro/reconcile') as Loaded['reconcile'],
      errorLog: require('../../../src/platform/errorLog') as Loaded['errorLog'],
    };
  });
  return loaded as Loaded; // isolateModules runs synchronously
};

const storedOn = ({storage}: Loaded): Entitlement | null => {
  const json = storage.StorageService.getItemSync(KEY);
  // What the store module wrote; its own reader is tested in schema.test.ts.
  return json === null ? null : (JSON.parse(json) as Entitlement);
};

/** Records each entitlement the producers are told. */
const watchReconcile = ({reconcile}: Loaded): string[] => {
  const told: string[] = [];
  reconcile.registerProducer({
    key: 'watch',
    sync: entitlement => {
      told.push(entitlement.state);
    },
  });
  return told;
};

it('reads as "none" on a phone that never asked the store', () => {
  expect(getEntitlement()).toEqual({
    state: 'none',
    productId: null,
    expiresAtMs: null,
    willRenew: null,
    alsoSubscribed: false,
    endedAtMs: null,
  });
  expect(coldStart().store.getEntitlement().state).toBe('none');
});

it('stores the decision, and a cold start reads it back before the store has answered', async () => {
  const first = coldStart();
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro_lifetime'));
  expect((await first.store.refreshEntitlement(billing, () => NOW)).state).toBe('lifetime');
  const json = first.storage.StorageService.getItemSync(KEY);

  const next = coldStart(json ?? undefined);
  expect(next.store.getEntitlement()).toMatchObject({state: 'lifetime', productId: 'zero_pro_lifetime'});
});

it.each(['', 'not json', '{"state":"lifetime"}', '{"state":"gold"}', '[]'])(
  'reads a stored value of %p as "none" and does not crash',
  stored => {
    expect(coldStart(stored).store.getEntitlement().state).toBe('none');
  },
);

it('keeps Pro when the store cannot say, however long that lasts', async () => {
  const app = coldStart();
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro'));
  await app.store.refreshEntitlement(billing, () => NOW);
  const before = storedOn(app);

  billing.cannotSay('network');
  for (const days of [1, 30, 400]) {
    expect((await app.store.refreshEntitlement(billing, () => NOW + days * DAY)).state).toBe('subscribed');
  }
  expect(storedOn(app)).toEqual(before);
});

it('ends Pro only when the store answers without it, and records when', async () => {
  const app = coldStart();
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro'));
  await app.store.refreshEntitlement(billing, () => NOW);
  billing.owns();
  expect(await app.store.refreshEntitlement(billing, () => NOW + DAY)).toMatchObject({
    state: 'expired',
    endedAtMs: NOW + DAY,
  });
  expect(storedOn(app)).toMatchObject({state: 'expired', endedAtMs: NOW + DAY});
});

it('writes to storage only when the decision changed', async () => {
  const app = coldStart();
  const write = jest.spyOn(app.storage.StorageService, 'setItemSync');
  const billing = createFakeBilling();
  await app.store.refreshEntitlement(billing, () => NOW); // none → none
  expect(write).not.toHaveBeenCalled();
  billing.owns(fakeRecord('zero_pro_lifetime'));
  await app.store.refreshEntitlement(billing, () => NOW);
  await app.store.refreshEntitlement(billing, () => NOW + DAY);
  await app.store.refreshEntitlement(billing, () => NOW + 2 * DAY);
  expect(write.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1);
});

it('reconciles on every refresh: changed, unchanged, and when the store cannot say', async () => {
  const app = coldStart();
  const told = watchReconcile(app);
  const billing = createFakeBilling();
  await app.store.refreshEntitlement(billing, () => NOW);
  billing.owns(fakeRecord('zero_pro_lifetime'));
  await app.store.refreshEntitlement(billing, () => NOW);
  await app.store.refreshEntitlement(billing, () => NOW);
  billing.cannotSay();
  await app.store.refreshEntitlement(billing, () => NOW);
  expect(told).toEqual(['none', 'lifetime', 'lifetime', 'lifetime']);
});

/** Lets everything that can run without a held answer run. */
const settled = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
};

it('asks the store one call at a time, so a slow answer is never applied after a newer one', async () => {
  const app = coldStart();
  const told = watchReconcile(app);
  const billing = createFakeBilling();

  billing.owns(fakeRecord('zero_pro_lifetime'));
  const releaseFirst = billing.hold();
  const first = app.store.refreshEntitlement(billing, () => NOW);
  await settled(); // the first question is with the store, unanswered
  // Meanwhile the purchase is refunded and the app asks again; this answer is not held up.
  billing.owns();
  billing.hold()();
  const second = app.store.refreshEntitlement(billing, () => NOW + DAY);
  await settled();
  // The second question waits its turn: asked together, its fast "nothing owned" would be
  // applied first and the slow "lifetime" would then overwrite it.
  expect(billing.calls).toEqual(['getEntitlements']);
  expect(app.store.getEntitlement().state).toBe('none');
  releaseFirst();

  expect((await first).state).toBe('lifetime');
  expect((await second).state).toBe('revoked');
  expect(app.store.getEntitlement().state).toBe('revoked');
  expect(told).toEqual(['lifetime', 'revoked']);
});

it('does not let a slow producer hold up the next answer from the store', async () => {
  const app = coldStart();
  let finishProducer: () => void = () => {};
  const producerHeld = new Promise<void>(resolve => {
    finishProducer = resolve;
  });
  const told: string[] = [];
  app.reconcile.registerProducer({
    key: 'slow',
    sync: async entitlement => {
      told.push(entitlement.state);
      await producerHeld;
    },
  });
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro', 'pending'));
  const first = app.store.refreshEntitlement(billing, () => NOW);
  await settled();
  expect(told).toEqual(['pending']); // the producer is still busy

  billing.owns(fakeRecord('zero_pro'));
  const second = app.store.refreshEntitlement(billing, () => NOW);
  await settled();
  // The payment cleared and Pro is on, although the producer has not finished.
  expect(app.store.getEntitlement().state).toBe('subscribed');

  finishProducer();
  expect((await first).state).toBe('pending');
  expect((await second).state).toBe('subscribed');
  expect(told).toEqual(['pending', 'subscribed']);
});

it('keeps the entitlement, logs, and still reconciles if the store breaks its promise never to reject', async () => {
  const app = coldStart();
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro_lifetime'));
  await app.store.refreshEntitlement(billing, () => NOW);
  const told = watchReconcile(app);

  const broken = {...billing, getEntitlements: () => Promise.reject(new Error('bridge torn down'))};
  await expect(app.store.refreshEntitlement(broken, () => NOW + DAY)).resolves.toMatchObject({state: 'lifetime'});
  expect(app.errorLog.getErrorLog().map(entry => entry.message)).toContain('bridge torn down');
  expect(told).toEqual(['lifetime']);
  // And the queue is not stuck behind the failure.
  billing.owns();
  expect((await app.store.refreshEntitlement(billing, () => NOW + 2 * DAY)).state).toBe('revoked');
});

it('remembers what the store last said, as a count or a reason, for Diagnostics', async () => {
  const app = coldStart();
  expect(app.store.getStoreStatus()).toEqual({entitlement: app.store.getEntitlement(), lastAnswer: null});
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro_lifetime'), fakeRecord('zero_pro', 'expired'));
  await app.store.refreshEntitlement(billing, () => NOW);
  expect(app.store.getStoreStatus()).toMatchObject({
    entitlement: {state: 'lifetime'},
    lastAnswer: {kind: 'known', records: 2},
  });
  billing.cannotSay('network');
  await app.store.refreshEntitlement(billing, () => NOW);
  expect(app.store.getStoreStatus()).toMatchObject({
    entitlement: {state: 'lifetime'},
    lastAnswer: {kind: 'unknown', reason: 'network'},
  });
});

it('uses the clock when no time is given', async () => {
  const app = coldStart();
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro'));
  await app.store.refreshEntitlement(billing);
  billing.owns();
  const before = Date.now();
  const ended = (await app.store.refreshEntitlement(billing)).endedAtMs ?? 0;
  expect(ended).toBeGreaterThanOrEqual(before);
  expect(ended).toBeLessThanOrEqual(Date.now());
});

describe('restore (the Restore purchases button)', () => {
  it('asks the store to restore, not the ordinary question, and decides the same way', async () => {
    const app = coldStart();
    const billing = createFakeBilling();
    billing.owns(fakeRecord('zero_pro_lifetime'));
    // With the real clock, as the app calls it.
    const entitlement = await app.store.restoreEntitlement(billing);
    expect(billing.calls).toEqual(['restore']);
    expect(entitlement.state).toBe('lifetime');
    expect(app.store.getStoreStatus().lastAnswer).toEqual({kind: 'known', records: 1});
  });

  it('a store that cannot say changes nothing', async () => {
    const app = coldStart();
    const billing = createFakeBilling();
    billing.owns(fakeRecord('zero_pro_lifetime'));
    await app.store.refreshEntitlement(billing, () => NOW);
    billing.cannotSay('NETWORK_ERROR');
    expect((await app.store.restoreEntitlement(billing, () => NOW)).state).toBe('lifetime');
    expect(app.store.getStoreStatus().lastAnswer).toEqual({kind: 'unknown', reason: 'NETWORK_ERROR'});
  });
});

it('tells its listeners of each new decision, and not of an answer that changes nothing', async () => {
  const app = coldStart();
  const billing = createFakeBilling();
  const heard = jest.fn();
  const stop = app.store.subscribeEntitlement(heard);
  billing.owns(fakeRecord('zero_pro_lifetime'));
  await app.store.refreshEntitlement(billing, () => NOW);
  await app.store.refreshEntitlement(billing, () => NOW);
  expect(heard).toHaveBeenCalledTimes(1);
  stop();
  billing.owns();
  await app.store.refreshEntitlement(billing, () => NOW);
  expect(heard).toHaveBeenCalledTimes(1);
});
