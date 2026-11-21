import NativeBilling, {type Spec} from '../native/specs/NativeBilling';
import {appendErrorLog} from '../platform/errorLog';
import {
  UNSIGNED_INSTALL,
  parseOriginalInstall,
  parsePurchaseOutcome,
  parseStoreAnswer,
  parseStoreProducts,
  type OriginalInstall,
  type PurchaseOutcome,
  type StoreAnswer,
  type StoreProduct,
} from './schema';

/**
 * The store, as the rest of the app sees it (3.0). The only module that talks
 * to the native billing module (rule `native-gateway`); everything above it
 * takes a `Billing`, so every rule is tested against a fake with this surface
 * (__tests__/harness/fakeBilling.ts).
 *
 * No call here throws or rejects. A store that is missing, fails or answers
 * with something unreadable is "the store did not say", which the entitlement
 * treats as no change: an error can never switch Pro off (law L3).
 */
export interface Billing {
  isAvailable: () => Promise<boolean>;
  getProducts: (ids: readonly string[]) => Promise<StoreProduct[]>;
  purchase: (productId: string, offerToken?: string | null) => Promise<PurchaseOutcome>;
  getEntitlements: () => Promise<StoreAnswer>;
  restore: () => Promise<StoreAnswer>;
  /** Resolves to whether the store's page was opened. */
  openManageSubscriptions: () => Promise<boolean>;
  getOriginalInstall: () => Promise<OriginalInstall>;
  /** `listener` runs when the store reports a change; returns how to stop listening. */
  onChange: (listener: () => void) => () => void;
}

/** A build with no store module (the foss flavour, jest): not "nothing owned", but "nobody to ask". */
const NO_STORE: StoreAnswer = {kind: 'unknown', reason: 'noStore'};

/**
 * A `Billing` over the native module, or over nothing when there is none.
 * `report` receives each failure, as not fatal; it is the error log in the app.
 * @internal The app uses `nativeBilling` below; tests build one over a stub module.
 */
export const createBilling = (
  native: Spec | null | undefined,
  report: (error: unknown, fatal: boolean) => void,
): Billing => {
  // A store that is down fails the same way on every foreground; the log keeps 20 entries.
  const reported = new Set<string>();
  const failed = (call: string, error: unknown): void => {
    const message = `billing.${call}: ${error instanceof Error ? error.message : String(error)}`;
    if (!reported.has(message)) {
      reported.add(message);
      report(new Error(message), false);
    }
  };
  const answer = async (call: 'getEntitlements' | 'restore'): Promise<StoreAnswer> => {
    if (!native) {
      return NO_STORE;
    }
    try {
      return parseStoreAnswer(await native[call]());
    } catch (error) {
      failed(call, error);
      return {kind: 'unknown', reason: 'error'};
    }
  };

  return {
    isAvailable: async () => {
      try {
        return (await native?.isAvailable()) === true;
      } catch (error) {
        failed('isAvailable', error);
        return false;
      }
    },
    getProducts: async ids => {
      try {
        return native ? parseStoreProducts(await native.getProducts([...ids])) : [];
      } catch (error) {
        failed('getProducts', error);
        return [];
      }
    },
    purchase: async (productId, offerToken) => {
      if (!native) {
        return 'unavailable';
      }
      try {
        return parsePurchaseOutcome(await native.purchase(productId, offerToken ?? ''));
      } catch (error) {
        failed('purchase', error);
        return 'failed';
      }
    },
    getEntitlements: () => answer('getEntitlements'),
    restore: () => answer('restore'),
    openManageSubscriptions: async () => {
      if (!native) {
        return false;
      }
      try {
        await native.openManageSubscriptions();
        return true;
      } catch (error) {
        failed('openManageSubscriptions', error);
        return false;
      }
    },
    getOriginalInstall: async () => {
      try {
        return native ? parseOriginalInstall(await native.getOriginalInstall()) : UNSIGNED_INSTALL;
      } catch (error) {
        failed('getOriginalInstall', error);
        return UNSIGNED_INSTALL;
      }
    },
    onChange: listener => {
      if (!native) {
        return () => {};
      }
      try {
        const subscription = native.onEntitlementsChanged(listener);
        return () => {
          try {
            subscription.remove();
          } catch (error) {
            failed('onChange', error);
          }
        };
      } catch (error) {
        failed('onChange', error);
        return () => {};
      }
    },
  };
};

/** The store of this build. */
export const nativeBilling: Billing = createBilling(NativeBilling, appendErrorLog);
