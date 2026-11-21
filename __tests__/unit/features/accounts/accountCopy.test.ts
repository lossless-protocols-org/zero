/** How the account screens read what is typed and show a direction. */
import {CHECK_LABEL, parseSignedAmount, signedAmount} from '../../../../src/features/accounts/accountCopy';

it('reads a signed amount as people type it, and nothing else', () => {
  expect(parseSignedAmount('-1200.50')).toBe(-1200.5);
  // W5: a comma is the decimal mark, never grouping ('1200,50' used to become 120050).
  expect(parseSignedAmount('1200,50')).toBe(1200.5);
  expect(parseSignedAmount('-0,5')).toBe(-0.5);
  expect(parseSignedAmount('1,200.50')).toBeNaN();
  expect(parseSignedAmount(' 1200 ')).toBe(1200);
  expect(parseSignedAmount('−300')).toBe(-300);
  expect(parseSignedAmount('12abc')).toBeNaN();
  expect(parseSignedAmount('')).toBeNaN();
  expect(parseSignedAmount('1.2.3')).toBeNaN();
});

it('shows the direction of a change', () => {
  const format = (n: number) => `₹${n}`;
  expect(signedAmount(format, 2400)).toBe('+₹2400');
  expect(signedAmount(format, -300)).toBe('−₹300');
  expect(signedAmount(format, 0)).toBe('₹0');
});

it('names checking a balance by what the account is', () => {
  expect(CHECK_LABEL.card).toBe(CHECK_LABEL.loan);
  expect(CHECK_LABEL.spend).not.toBe(CHECK_LABEL.save);
});
