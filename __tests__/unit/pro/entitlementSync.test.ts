/**
 * When the app asks the store (3.0 law L4): at start, on every return to the
 * foreground, and when the store itself reports a change. Never on the way to
 * the background, and only one set of listeners however often the root mounts.
 */
import {AppState, type AppStateStatus} from 'react-native';
import {createFakeBilling, fakeRecord} from '../../harness/fakeBilling';

interface Loaded {
  sync: typeof import('../../../src/pro/entitlementSync');
  store: typeof import('../../../src/pro/entitlementStore');
  reconcile: typeof import('../../../src/pro/reconcile');
}

const coldStart = (): Loaded => {
  let loaded: Loaded | undefined;
  jest.isolateModules(() => {
    // Each `require` returns the module's own type.
    loaded = {
      sync: require('../../../src/pro/entitlementSync') as Loaded['sync'],
      store: require('../../../src/pro/entitlementStore') as Loaded['store'],
      reconcile: require('../../../src/pro/reconcile') as Loaded['reconcile'],
    };
  });
  return loaded as Loaded; // isolateModules runs synchronously
};

/** Lets the refresh that a listener started run to its end. */
const settled = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
};

let appStateHandlers: Array<(state: AppStateStatus) => void> = [];

beforeEach(() => {
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    // The 'change' handler receives the new state.
    appStateHandlers.push(handler as (state: AppStateStatus) => void);
    return {remove: () => {}};
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const appBecomes = (state: AppStateStatus): void => appStateHandlers.forEach(handler => handler(state));

it('asks the store at start', async () => {
  const {sync, store} = coldStart();
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro_lifetime'));
  sync.startEntitlementSync(billing);
  await settled();
  expect(billing.calls).toEqual(['getEntitlements']);
  expect(store.getEntitlement().state).toBe('lifetime');
});

it('asks again each time the app returns to the foreground, and not on the way out', async () => {
  const {sync, store} = coldStart();
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro'));
  sync.startEntitlementSync(billing);
  await settled();

  billing.owns(); // cancelled and run out while the app was away
  appBecomes('inactive');
  appBecomes('background');
  await settled();
  expect(billing.calls).toHaveLength(1);
  expect(store.getEntitlement().state).toBe('subscribed');

  appBecomes('active');
  await settled();
  expect(billing.calls).toHaveLength(2);
  expect(store.getEntitlement().state).toBe('expired');
});

it('asks again when the store reports a change by itself, such as a payment that cleared', async () => {
  const {sync, store} = coldStart();
  const billing = createFakeBilling();
  billing.owns(fakeRecord('zero_pro_lifetime', 'pending'));
  sync.startEntitlementSync(billing);
  await settled();
  expect(store.getEntitlement().state).toBe('pending');

  billing.owns(fakeRecord('zero_pro_lifetime'));
  billing.announce();
  await settled();
  expect(store.getEntitlement().state).toBe('lifetime');
});

describe('when the paid period it knows of runs out while the app stays open', () => {
  const NOW = Date.UTC(2027, 3, 10, 12);
  const HOUR = 3_600_000;

  beforeEach(() => {
    jest.useFakeTimers({doNotFake: ['nextTick', 'queueMicrotask']});
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('asks the store again just after the period ends, with no foreground and no announcement', async () => {
    const {sync, store} = coldStart();
    const billing = createFakeBilling();
    billing.owns(fakeRecord('zero_pro_monthly', 'trial', {expiresAtMs: NOW + HOUR, willRenew: false}));
    sync.startEntitlementSync(billing);
    await settled();
    expect(store.getEntitlement().state).toBe('trial');

    billing.owns(fakeRecord('zero_pro_monthly', 'expired', {expiresAtMs: NOW + HOUR, willRenew: false}));
    jest.advanceTimersByTime(HOUR - 1);
    await settled();
    expect(billing.calls).toHaveLength(1);
    jest.advanceTimersByTime(5001);
    await settled();
    expect(billing.calls).toHaveLength(2);
    expect(store.getEntitlement().state).toBe('expired');
    // Pro is off: nothing more is scheduled.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps one timer, set from the newest answer', async () => {
    const {sync} = coldStart();
    const billing = createFakeBilling();
    billing.owns(fakeRecord('zero_pro_monthly', 'active', {expiresAtMs: NOW + HOUR, willRenew: true}));
    sync.startEntitlementSync(billing);
    await settled();
    // Renewed: the period now ends later.
    billing.owns(fakeRecord('zero_pro_monthly', 'active', {expiresAtMs: NOW + 3 * HOUR, willRenew: true}));
    billing.announce();
    await settled();
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(HOUR + 5001);
    await settled();
    expect(billing.calls).toHaveLength(2);
    jest.advanceTimersByTime(2 * HOUR);
    await settled();
    expect(billing.calls).toHaveLength(3);
  });

  it('sets no timer for a purchase with no end, a period already over, or one too far off for a timer', async () => {
    for (const record of [
      fakeRecord('zero_pro_lifetime'),
      fakeRecord('zero_pro'), // Google Play does not say when the period ends
      fakeRecord('zero_pro_monthly', 'grace', {expiresAtMs: NOW - HOUR, willRenew: true}),
      fakeRecord('zero_pro_monthly', 'active', {expiresAtMs: NOW + 40 * 24 * HOUR, willRenew: true}),
    ]) {
      const {sync, store} = coldStart();
      const billing = createFakeBilling();
      billing.owns(record);
      sync.startEntitlementSync(billing);
      await settled();
      expect(store.getEntitlement().state).not.toBe('none');
      expect(jest.getTimerCount()).toBe(0);
    }
  });
});

it('starts once, however often it is called', async () => {
  const {sync} = coldStart();
  const billing = createFakeBilling();
  sync.startEntitlementSync(billing);
  sync.startEntitlementSync(billing);
  sync.startEntitlementSync(billing);
  await settled();
  expect(billing.calls).toEqual(['getEntitlements']);
  expect(appStateHandlers).toHaveLength(1);
  billing.announce();
  await settled();
  expect(billing.calls).toHaveLength(2);
});

it("uses this build's own store when none is given, which today has none and so changes nothing", async () => {
  const {sync, store, reconcile} = coldStart();
  const told: string[] = [];
  reconcile.registerProducer({
    key: 'watch',
    sync: entitlement => {
      told.push(entitlement.state);
    },
  });
  sync.startEntitlementSync();
  await settled();
  // It did run: the producers were told, and what they were told is "none".
  expect(told).toEqual(['none']);
  expect(store.getEntitlement().state).toBe('none');
});
