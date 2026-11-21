/**
 * The product catalogue (plan §4): the identifiers created in the two store
 * consoles, and nothing else, count as zero's products.
 */
import {productKind} from '../../../src/pro/products';

it('knows the subscription of each store', () => {
  expect(productKind('zero_pro')).toBe('subscription');
  expect(productKind('zero_pro_monthly')).toBe('subscription');
});

it('knows the one-time purchase and its thank-you twin', () => {
  expect(productKind('zero_pro_lifetime')).toBe('lifetime');
  expect(productKind('zero_pro_lifetime_thanks')).toBe('lifetime');
});

it.each(['', 'zero', 'zero_pro_yearly', 'ZERO_PRO', 'constructor', 'toString', '__proto__', 'hasOwnProperty'])(
  'does not sell "%s"',
  productId => {
    expect(productKind(productId)).toBeNull();
  },
);
