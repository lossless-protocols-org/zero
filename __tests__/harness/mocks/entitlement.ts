import {NO_ENTITLEMENT} from '../../../src/pro/entitlement';
import type {LastStoreAnswer} from '../../../src/pro/entitlementStore';
import type {Entitlement} from '../../../src/pro/schema';

/**
 * The entitlement store for suites about what a tier looks like on screen:
 * a test says what the entitlement is, and everything that reads it (the
 * hooks, the gate, the Settings rows, the sheets) runs for real. How the
 * entitlement is decided from store answers has its own suites
 * (__tests__/unit/pro), against the real store.
 *
 *   jest.mock('<…>/src/pro/entitlementStore', () => require('<…>/harness/mocks/entitlement').entitlementStoreMock());
 */
let current: Entitlement = NO_ENTITLEMENT;
let lastAnswer: LastStoreAnswer | null = null;
let afterAsking: {entitlement: Entitlement; lastAnswer: LastStoreAnswer} | null = null;
const listeners = new Set<() => void>();
const asked: string[] = [];

/** The entitlement from now on; everything listening is told. */
export const setEntitlement = (entitlement: Partial<Entitlement> = {}): void => {
  current = {...NO_ENTITLEMENT, ...entitlement};
  listeners.forEach(listener => listener());
};

/** What the next refresh or restore leads to: the entitlement, and whether the store answered. */
export const nextStoreAnswer = (entitlement: Partial<Entitlement>, answer: LastStoreAnswer): void => {
  afterAsking = {entitlement: {...NO_ENTITLEMENT, ...entitlement}, lastAnswer: answer};
};

/** "refresh" or "restore", once per call made to the store through the mock. */
export const storeAsked = (): string[] => asked;

/** Back to "never had Pro". Listeners stay: the gate subscribes once per test file, as it does once per app run. */
export const resetEntitlement = (): void => {
  asked.length = 0;
  lastAnswer = null;
  afterAsking = null;
  setEntitlement();
};

const ask = (how: string) => async (): Promise<Entitlement> => {
  asked.push(how);
  if (afterAsking) {
    lastAnswer = afterAsking.lastAnswer;
    const {entitlement} = afterAsking;
    afterAsking = null;
    setEntitlement(entitlement);
  }
  return current;
};

export const entitlementStoreMock = () => ({
  getEntitlement: () => current,
  subscribeEntitlement: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getStoreStatus: () => ({entitlement: current, lastAnswer}),
  refreshEntitlement: ask('refresh'),
  restoreEntitlement: ask('restore'),
});
