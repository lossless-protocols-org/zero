import {productKind} from './products';
import type {StoreProduct} from './schema';

/** Every product zero sells, on either store: the store answers with the ones it has. */
export const UPGRADE_PRODUCT_IDS = [
  'zero_pro',
  'zero_pro_monthly',
  'zero_pro_lifetime',
  'zero_pro_lifetime_thanks',
] as const;

const LIFETIME = 'zero_pro_lifetime';
const THANKS = 'zero_pro_lifetime_thanks';
/** Where the one-time price is the one most people choose, so it is shown first (owner decision, prices §2). */
const LIFETIME_FIRST_CURRENCIES = ['INR', 'PHP'];

/** What the upgrade sheet offers this buyer, from what the store returned. */
export interface UpgradeOffer {
  monthly: StoreProduct | null;
  lifetime: StoreProduct | null;
  /** The usual lifetime price, when `lifetime` is the thank-you product and the store returned both. */
  usualLifetimePrice: string | null;
  lifetimeFirst: boolean;
}

const DAY_MS = 86_400_000;

/**
 * The day the first charge falls if the trial starts now, or null when this
 * buyer gets no trial. Worked out when the sheet is drawn, not when it was
 * loaded: a sheet left open overnight must not print yesterday's date.
 */
export const trialEndsAt = (monthly: StoreProduct | null, nowMs: number): number | null =>
  monthly?.trialDays ? nowMs + monthly.trialDays * DAY_MS : null;

/**
 * Chooses what to show. The thank-you product replaces the usual lifetime one
 * only for an eligible install, and only when the store actually returned it.
 * Prices are the store's own text and are never computed here.
 */
export const upgradeOffer = (products: readonly StoreProduct[], thanksEligible: boolean): UpgradeOffer => {
  const monthly = products.find(product => productKind(product.id) === 'subscription') ?? null;
  const usual = products.find(product => product.id === LIFETIME) ?? null;
  const thanks = thanksEligible ? (products.find(product => product.id === THANKS) ?? null) : null;
  const lifetime = thanks ?? usual;
  const currency = (lifetime ?? monthly)?.currencyCode ?? '';
  return {
    monthly,
    lifetime,
    usualLifetimePrice: thanks && usual ? usual.displayPrice : null,
    lifetimeFirst: LIFETIME_FIRST_CURRENCIES.includes(currency),
  };
};
