/**
 * When a change of tier reaches the screen (3.0, entitlement design §3): an
 * upgrade at once; a downgrade only when no Pro screen is open, so nobody is
 * thrown out of a form. A cold start is always safe.
 */
import {createFakeBilling, fakeRecord, type FakeBilling} from '../../harness/fakeBilling';

interface Loaded {
  gate: typeof import('../../../src/pro/proGate');
  store: typeof import('../../../src/pro/entitlementStore');
  storage: typeof import('../../../src/platform/storage');
}

const KEY = 'pro_entitlement';

/** A fresh JS runtime, with what the last one left in storage (each runtime has its own in-memory MMKV here). */
const coldStart = (stored?: string | null): Loaded => {
  let loaded: Loaded | undefined;
  jest.isolateModules(() => {
    const storage = require('../../../src/platform/storage') as Loaded['storage'];
    if (stored) {
      storage.StorageService.setItemSync(KEY, stored);
    }
    loaded = {
      storage,
      gate: require('../../../src/pro/proGate') as Loaded['gate'],
      store: require('../../../src/pro/entitlementStore') as Loaded['store'],
    };
  });
  return loaded as Loaded; // isolateModules runs synchronously
};

const LIFETIME = fakeRecord('zero_pro_lifetime');
let billing: FakeBilling;

beforeEach(() => {
  billing = createFakeBilling();
});

it('starts from the stored entitlement', async () => {
  expect(coldStart().gate.getAppliedPro()).toBe(false);
  const {store, storage} = coldStart();
  billing.owns(LIFETIME);
  await store.refreshEntitlement(billing);
  expect(coldStart(storage.StorageService.getItemSync(KEY)).gate.getAppliedPro()).toBe(true);
});

it('applies an upgrade at once, and tells whoever is listening', async () => {
  const {gate, store} = coldStart();
  const heard = jest.fn();
  gate.subscribeAppliedPro(heard);
  billing.owns(LIFETIME);
  await store.refreshEntitlement(billing);
  expect(gate.getAppliedPro()).toBe(true);
  expect(heard).toHaveBeenCalledTimes(1);
});

it('applies a downgrade at once when no Pro screen is open', async () => {
  const {gate, store} = coldStart();
  billing.owns(LIFETIME);
  await store.refreshEntitlement(billing);
  billing.owns(fakeRecord('zero_pro_lifetime', 'revoked'));
  await store.refreshEntitlement(billing);
  expect(gate.getAppliedPro()).toBe(false);
});

it('holds a downgrade while a Pro screen is open, and applies it when the user leaves', async () => {
  const {gate, store} = coldStart();
  billing.owns(LIFETIME);
  await store.refreshEntitlement(billing);
  gate.setProScreenOpen(true);
  const heard = jest.fn();
  gate.subscribeAppliedPro(heard);

  billing.owns(fakeRecord('zero_pro_lifetime', 'revoked'));
  await store.refreshEntitlement(billing);
  expect(store.getEntitlement().state).toBe('revoked');
  expect(gate.getAppliedPro()).toBe(true);
  expect(heard).not.toHaveBeenCalled();

  gate.setProScreenOpen(false);
  expect(gate.getAppliedPro()).toBe(false);
  expect(heard).toHaveBeenCalledTimes(1);
});

it('a cold start never holds: what was open died with the process', async () => {
  const {gate, store, storage} = coldStart();
  billing.owns(LIFETIME);
  await store.refreshEntitlement(billing);
  gate.setProScreenOpen(true);
  billing.owns(fakeRecord('zero_pro_lifetime', 'revoked'));
  await store.refreshEntitlement(billing);
  expect(gate.getAppliedPro()).toBe(true);
  const stored = storage.StorageService.getItemSync(KEY);
  expect(stored).toContain('revoked');
  expect(coldStart(stored).gate.getAppliedPro()).toBe(false);
});

it('a Pro screen open without Pro does not switch it on', () => {
  const {gate} = coldStart();
  gate.setProScreenOpen(true);
  expect(gate.getAppliedPro()).toBe(false);
});

it('Pro coming back while a downgrade waits cancels it', async () => {
  const {gate, store} = coldStart();
  billing.owns(LIFETIME);
  await store.refreshEntitlement(billing);
  gate.setProScreenOpen(true);
  billing.owns();
  await store.refreshEntitlement(billing);
  billing.owns(LIFETIME);
  await store.refreshEntitlement(billing);
  gate.setProScreenOpen(false);
  expect(gate.getAppliedPro()).toBe(true);
});

it('stops telling a listener that left', async () => {
  const {gate, store} = coldStart();
  const heard = jest.fn();
  gate.subscribeAppliedPro(heard)();
  billing.owns(LIFETIME);
  await store.refreshEntitlement(billing);
  expect(heard).not.toHaveBeenCalled();
});
