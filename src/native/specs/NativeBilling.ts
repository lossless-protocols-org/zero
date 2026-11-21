import type {CodegenTypes, TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * The store's purchases (3.0): Google Play Billing on Android (the `play`
 * flavour only), StoreKit 2 on iOS. The module reports what the store says
 * and decides nothing; what the facts mean is src/pro/entitlement.ts. Values
 * cross as JSON text, checked on arrival by src/pro/schema.ts, so both
 * platforms answer in one shape (contracts/billing-scenarios.json).
 *
 * Null where there is no store: the `foss` flavour, jest, and every build
 * until the native side lands (plan P4 and P5). src/pro/billing.ts is the
 * only importer.
 */
/** @internal codegen — RN codegen reads this to generate NativeBillingSpec. */
export interface Spec extends TurboModule {
  /** Whether purchases can be made on this device right now. */
  isAvailable(): Promise<boolean>;
  /** The products as offered to this buyer: a JSON array (schema.ts `StoreProduct`). */
  getProducts(ids: Array<string>): Promise<string>;
  /** Starts a purchase; resolves with how it ended (`PurchaseOutcome`). `offerToken` is '' when there is none. */
  purchase(productId: string, offerToken: string): Promise<string>;
  /** Everything the store knows this account owns: JSON (`StoreAnswer`). Read from the store's own cache. */
  getEntitlements(): Promise<string>;
  /** Asks the store to sync purchases first (may show its sign-in), then answers as getEntitlements. */
  restore(): Promise<string>;
  /** Opens the store's page for managing or cancelling the subscription. */
  openManageSubscriptions(): Promise<void>;
  /** The build this store account first downloaded, where the store signs it: JSON (`OriginalInstall`). */
  getOriginalInstall(): Promise<string>;
  /**
   * Fires when the store reports a change outside a purchase call: a payment cleared, a refund, a
   * renewal, a subscription's status (renewal switched off, a failed payment, an expiry).
   */
  readonly onEntitlementsChanged: CodegenTypes.EventEmitter<void>;
}

export default TurboModuleRegistry.get<Spec>('NativeBilling');
