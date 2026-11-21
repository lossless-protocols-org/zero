/** What the upgrade sheet offers, from what the store returned (3.0). Prices are the store's text, never computed. */
import type {StoreProduct} from '../../../src/pro/schema';
import {trialEndsAt, upgradeOffer, UPGRADE_PRODUCT_IDS} from '../../../src/pro/upgradeOffer';
import {productKind} from '../../../src/pro/products';

const NOW = Date.UTC(2026, 10, 10, 12);
const DAY = 86_400_000;
const product = (id: string, more: Partial<StoreProduct> = {}): StoreProduct => ({
  id,
  displayPrice: '₹1',
  currencyCode: 'INR',
  period: null,
  trialDays: null,
  offerToken: null,
  ...more,
});
const monthly = product('zero_pro', {displayPrice: '₹99.00', period: 'month', trialDays: 14, offerToken: 'trial'});
const lifetime = product('zero_pro_lifetime', {displayPrice: '₹1,199.00'});
const thanks = product('zero_pro_lifetime_thanks', {displayPrice: '₹499.00'});

it('asks the store for every product zero sells, on either store', () => {
  expect(UPGRADE_PRODUCT_IDS.map(productKind)).toEqual(['subscription', 'subscription', 'lifetime', 'lifetime']);
});

it('offers the monthly plan and the usual lifetime price', () => {
  const offer = upgradeOffer([lifetime, monthly, thanks], false);
  expect(offer.monthly).toBe(monthly);
  expect(offer.lifetime).toBe(lifetime);
  expect(offer.usualLifetimePrice).toBeNull();
});

it('finds the monthly plan under either store’s id', () => {
  const apple = product('zero_pro_monthly', {period: 'month'});
  expect(upgradeOffer([apple], false).monthly).toBe(apple);
});

it('an eligible install is offered the thank-you price, with the usual one named', () => {
  const offer = upgradeOffer([monthly, lifetime, thanks], true);
  expect(offer.lifetime).toBe(thanks);
  expect(offer.usualLifetimePrice).toBe('₹1,199.00');
});

it('an eligible install still gets the usual price when the store returns no thank-you product', () => {
  const offer = upgradeOffer([monthly, lifetime], true);
  expect(offer.lifetime).toBe(lifetime);
  expect(offer.usualLifetimePrice).toBeNull();
});

it('says when the first charge falls, from the moment it is asked, only for a buyer who gets the trial', () => {
  expect(trialEndsAt(monthly, NOW)).toBe(NOW + 14 * DAY);
  // Asked again a day later (a sheet left open overnight): a day later.
  expect(trialEndsAt(monthly, NOW + DAY)).toBe(NOW + 15 * DAY);
  expect(trialEndsAt({...monthly, trialDays: null}, NOW)).toBeNull();
  expect(trialEndsAt(null, NOW)).toBeNull();
});

it('puts lifetime first in India and the Philippines, monthly first elsewhere', () => {
  expect(upgradeOffer([monthly, lifetime], false).lifetimeFirst).toBe(true);
  const peso = {currencyCode: 'PHP'};
  expect(
    upgradeOffer(
      [
        {...monthly, ...peso},
        {...lifetime, ...peso},
      ],
      false,
    ).lifetimeFirst,
  ).toBe(true);
  const dollar = {currencyCode: 'USD'};
  expect(
    upgradeOffer(
      [
        {...monthly, ...dollar},
        {...lifetime, ...dollar},
      ],
      false,
    ).lifetimeFirst,
  ).toBe(false);
});

it('offers nothing when the store returned nothing, or only things zero does not sell', () => {
  for (const products of [[], [product('zero_pro_gold')]]) {
    expect(upgradeOffer(products, true)).toEqual({
      monthly: null,
      lifetime: null,
      usualLifetimePrice: null,
      lifetimeFirst: false,
    });
  }
});
