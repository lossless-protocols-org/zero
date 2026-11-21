import {z} from 'zod';

/**
 * The shapes that cross a boundary in src/pro, each checked where it enters:
 * what the native billing module reports (JSON over the bridge), and the one
 * thing src/pro stores (the last decided entitlement, in MMKV). Anything that
 * does not match is treated as "the store did not answer", never as "the
 * store said no" (law L3, handbook/blueprint/ZERO_3.0_ENTITLEMENT.md).
 */

/**
 * What the store says about one product the user has or had.
 * - active: owned (a subscription that is paid up, or a one-time purchase). Google Play
 *   reports a trial and a grace period as active too: its client cannot tell them apart.
 * - trial, grace: the App Store's free trial and billing grace period.
 * - onHold: a subscription whose payment failed and whose grace has run out.
 * - pending: paid for but not cleared yet (UPI, cash, Ask to Buy). Not owned yet.
 * - expired, revoked: over, or taken back by a refund.
 */
const storeStatusSchema = z.enum(['active', 'trial', 'grace', 'onHold', 'pending', 'expired', 'revoked']);
export type StoreStatus = z.infer<typeof storeStatusSchema>;

const storeRecordSchema = z.object({
  productId: z.string(),
  status: storeStatusSchema,
  /** When the paid period ends. The App Store says; Google Play's client does not (null). */
  expiresAtMs: z.number().finite().nullable(),
  /** Whether the subscription will renew, where the store says (null where it does not). */
  willRenew: z.boolean().nullable(),
  /**
   * The store vouches for this record: its signature check passed and its facts agree. A record
   * without it is unreadable: it grants nothing and ends nothing (a native side also marks so a
   * product whose facts contradict each other, rather than guess).
   */
  verified: z.boolean(),
});
export type StoreRecord = z.infer<typeof storeRecordSchema>;

const storeAnswerSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('known'), entitlements: z.array(storeRecordSchema)}),
  z.object({kind: z.literal('unknown'), reason: z.string()}),
]);
/** The store's answer: everything it knows, or the fact that it could not say. */
export type StoreAnswer = z.infer<typeof storeAnswerSchema>;

const entitlementStateSchema = z.enum([
  'none',
  'pending',
  'trial',
  'subscribed',
  'grace',
  'onHold',
  'expired',
  'revoked',
  'lifetime',
]);
export type EntitlementState = z.infer<typeof entitlementStateSchema>;

const entitlementSchema = z.object({
  state: entitlementStateSchema,
  /** The product the state comes from, or the one that ended; null when there never was one. */
  productId: z.string().nullable(),
  /** When the current paid period ends, as last verified (App Store subscriptions only). */
  expiresAtMs: z.number().finite().nullable(),
  /** False once renewal is off, so Settings can say when Pro ends (App Store only). */
  willRenew: z.boolean().nullable(),
  /** A lifetime owner whose subscription is still renewing: the store keeps charging until they cancel. */
  alsoSubscribed: z.boolean(),
  /** When Pro last ended on this phone; null while Pro is on or was never on. One notice per value. */
  endedAtMs: z.number().finite().nullable(),
});
/** What zero has decided about who is paying. Derived from store answers; a cache, never an authority. */
export type Entitlement = z.infer<typeof entitlementSchema>;

const storeProductSchema = z.object({
  id: z.string(),
  /** The price as the store formats it for this buyer, tax included where the law says so. Shown as is. */
  displayPrice: z.string(),
  currencyCode: z.string(),
  /** How often it renews; null for a one-time purchase. */
  period: z.enum(['month']).nullable(),
  /** Days of free trial this buyer is eligible for; null when none. */
  trialDays: z.number().int().positive().nullable(),
  /** Google Play's token for the offer to buy, handed back to `purchase`; null on the App Store. */
  offerToken: z.string().nullable(),
});
/** A product as the store offers it to this buyer. */
export type StoreProduct = z.infer<typeof storeProductSchema>;

const purchaseOutcomeSchema = z.enum(['purchased', 'pending', 'cancelled', 'alreadyOwned', 'unavailable', 'failed']);
/** How a purchase attempt ended. `pending` is paid-but-not-cleared: Pro stays off until the store confirms. */
export type PurchaseOutcome = z.infer<typeof purchaseOutcomeSchema>;

const originalInstallSchema = z.object({
  /** True when the store signed the value (App Store, iOS 16+). */
  signed: z.boolean(),
  /** The build number this store account first downloaded, or null where the store does not say. */
  build: z.number().int().nonnegative().nullable(),
});
export type OriginalInstall = z.infer<typeof originalInstallSchema>;

const fromJson = <T>(schema: z.ZodType<T>, json: string | null | undefined): T | undefined => {
  if (typeof json !== 'string') {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return undefined;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

/** The answer in `json`, or "unknown" when it is not one: a garbled reply never reads as "nothing owned". */
export const parseStoreAnswer = (json: string | null | undefined): StoreAnswer =>
  fromJson(storeAnswerSchema, json) ?? {kind: 'unknown', reason: 'malformed'};

/** The products in `json`; none when it is not a product list (the sheet then offers nothing to buy). */
export const parseStoreProducts = (json: string | null | undefined): StoreProduct[] =>
  fromJson(z.array(storeProductSchema), json) ?? [];

/** The outcome named by `value`; `failed` for anything else. */
export const parsePurchaseOutcome = (value: string | null | undefined): PurchaseOutcome => {
  const parsed = purchaseOutcomeSchema.safeParse(value);
  return parsed.success ? parsed.data : 'failed';
};

export const UNSIGNED_INSTALL: OriginalInstall = {signed: false, build: null};

export const parseOriginalInstall = (json: string | null | undefined): OriginalInstall =>
  fromJson(originalInstallSchema, json) ?? UNSIGNED_INSTALL;

/** The stored entitlement in `json`, or undefined when there is none or it does not read as one. */
export const parseEntitlement = (json: string | null | undefined): Entitlement | undefined =>
  fromJson(entitlementSchema, json);
