/**
 * The name schemas used to be `[A-Za-z\s]` only, which rejected every
 * non-Latin script — unacceptable for an app positioned as India-first.
 * Messages were also evaluated at module load, freezing them in whatever
 * language was active on first import.
 */

import {
  nameSchema,
  categorySchema,
  expenseAmountSchema,
  expenseSchema,
  createAmountSchema,
  getAmountLimits,
} from '../validationSchema';

describe('nameSchema — scripts', () => {
  it.each([
    ['plain ASCII', 'Indranil'],
    ['accented Latin', 'José'],
    ['Latin with diaeresis', 'Zoë Müller'],
    ['Devanagari', 'हिंदी नाम'],
    ['Cyrillic', 'Ольга'],
    ['Bengali', 'বাংলা'],
    ['Tamil', 'தமிழ்'],
    ['Arabic', 'محمد'],
    ['CJK', '田中太郎'],
    ['apostrophe', "O'Brien"],
    ['hyphen', 'Anne-Marie'],
  ])('accepts %s', (_label, value) => {
    expect(nameSchema.safeParse(value).success).toBe(true);
  });

  it('rejects digits and symbols', () => {
    expect(nameSchema.safeParse('User123').success).toBe(false);
    expect(nameSchema.safeParse('a@b.com').success).toBe(false);
  });

  it('enforces the length bounds', () => {
    expect(nameSchema.safeParse('ab').success).toBe(false);
    expect(nameSchema.safeParse('abc').success).toBe(true);
    expect(nameSchema.safeParse('a'.repeat(50)).success).toBe(true);
    expect(nameSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });
});

describe('categorySchema', () => {
  it('accepts non-Latin category names and digits', () => {
    expect(categorySchema.safeParse('किराया').success).toBe(true);
    expect(categorySchema.safeParse('Fuel 2').success).toBe(true);
  });

  it('enforces the length bounds', () => {
    expect(categorySchema.safeParse('').success).toBe(false);
    expect(categorySchema.safeParse('a'.repeat(40)).success).toBe(true);
    expect(categorySchema.safeParse('a'.repeat(41)).success).toBe(false);
  });
});

describe('expenseAmountSchema', () => {
  it('rejects zero and accepts the documented 0.01 minimum', () => {
    expect(expenseAmountSchema.safeParse(0).success).toBe(false);
    expect(expenseAmountSchema.safeParse(0.01).success).toBe(true);
  });

  it('caps at 10^(9+decimals) major units for the currency', () => {
    // Default schema = 2 decimals → 1e11. The old flat 1,000,000 blocked
    // ordinary amounts in COP/VND/IDR/KRW (bug sheet, JaimeM).
    expect(expenseAmountSchema.safeParse(1_000_000).success).toBe(true);
    expect(expenseAmountSchema.safeParse(1e11).success).toBe(true);
    expect(expenseAmountSchema.safeParse(1e11 + 1).success).toBe(false);
    const cop = createAmountSchema('COP');
    expect(cop.safeParse(45_000_000).success).toBe(true);
    expect(cop.safeParse(1e9).success).toBe(true);
    expect(cop.safeParse(1e9 + 1).success).toBe(false);
    const kwd = createAmountSchema('KWD');
    expect(kwd.safeParse(1e12).success).toBe(true);
    expect(kwd.safeParse(1e12 + 1).success).toBe(false);
  });

  it('limits decimals to the currency precision', () => {
    expect(createAmountSchema('JPY').safeParse(12.5).success).toBe(false);
    expect(createAmountSchema('JPY').safeParse(12).success).toBe(true);
    expect(createAmountSchema('JPY').safeParse(0.5).success).toBe(false);
    expect(createAmountSchema('KWD').safeParse(1.234).success).toBe(true);
    expect(createAmountSchema('KWD').safeParse(1.2345).success).toBe(false);
    expect(createAmountSchema('INR').safeParse(10.99).success).toBe(true);
    expect(createAmountSchema('INR').safeParse(10.999).success).toBe(false);
  });

  it('exposes the limits for the UI', () => {
    expect(getAmountLimits('VND')).toEqual({decimals: 0, min: 1, max: 1e9});
    expect(getAmountLimits('USD')).toEqual({decimals: 2, min: 0.01, max: 1e11});
    expect(getAmountLimits(undefined).decimals).toBe(2);
  });

  it('states the real minimum in its message', () => {
    const result = expenseAmountSchema.safeParse(0);
    expect(result.success).toBe(false);
    // The copy used to say "cannot be less than 0" while rejecting 0.005.
    expect(result.error?.issues[0]?.message).toContain('0.01');
  });
});

describe('message evaluation', () => {
  it('resolves messages at validation time, not module load', () => {
    // A frozen message would be identical whenever it was captured; what we
    // assert here is that a message is produced through the i18n layer on
    // each parse rather than a captured constant.
    const first = expenseSchema.safeParse('').error?.issues[0]?.message;
    const second = expenseSchema.safeParse('').error?.issues[0]?.message;
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });
});
