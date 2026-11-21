/**
 * What zero sells (handbook/blueprint/ZERO_3.0_PLAN.md §4). The identifiers
 * are permanent: a store never lets one be reused or renamed once created.
 * A subscription and a one-time purchase are told apart here and nowhere
 * else; a product the stores report that is not listed counts for nothing.
 */
export type ProductKind = 'subscription' | 'lifetime';

const KIND_BY_PRODUCT: Readonly<Record<string, ProductKind>> = {
  // Google Play: one subscription (base plan `monthly`, offer `trial14`).
  zero_pro: 'subscription',
  // App Store: the monthly subscription of the group "zero Pro".
  zero_pro_monthly: 'subscription',
  // Both stores: the one-time purchase, and its half-price twin for people here before 3.0.
  zero_pro_lifetime: 'lifetime',
  zero_pro_lifetime_thanks: 'lifetime',
};

/** What a store product is, or null for one zero does not sell. */
export const productKind = (productId: string): ProductKind | null => {
  // An own key only: 'toString' and '__proto__' are not products.
  const kind = Object.hasOwn(KIND_BY_PRODUCT, productId) ? KIND_BY_PRODUCT[productId] : undefined;
  return kind ?? null;
};
