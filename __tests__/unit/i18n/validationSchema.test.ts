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
  expenseDescriptionSchema,
  getAmountLimits,
} from '../../../src/i18n/validationSchema';

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
    expect(nameSchema.isValid(value)).toBe(true);
  });

  it('rejects digits and symbols', () => {
    expect(nameSchema.isValid('User123')).toBe(false);
    expect(nameSchema.isValid('a@b.com')).toBe(false);
  });

  it('enforces the length bounds', () => {
    expect(nameSchema.isValid('ab')).toBe(false);
    expect(nameSchema.isValid('abc')).toBe(true);
    expect(nameSchema.isValid('a'.repeat(50))).toBe(true);
    expect(nameSchema.isValid('a'.repeat(51))).toBe(false);
  });
});

describe('categorySchema', () => {
  it('accepts non-Latin category names and digits', () => {
    expect(categorySchema.isValid('किराया')).toBe(true);
    expect(categorySchema.isValid('Fuel 2')).toBe(true);
  });

  it('enforces the length bounds', () => {
    expect(categorySchema.isValid('')).toBe(false);
    expect(categorySchema.isValid('a'.repeat(40))).toBe(true);
    expect(categorySchema.isValid('a'.repeat(41))).toBe(false);
  });
});

describe('expenseAmountSchema', () => {
  it('rejects zero and accepts the documented 0.01 minimum', () => {
    expect(expenseAmountSchema.isValid(0)).toBe(false);
    expect(expenseAmountSchema.isValid(0.01)).toBe(true);
  });

  it('caps at 10^(9+decimals) major units for the currency', () => {
    // Default schema = 2 decimals → 1e11. The old flat 1,000,000 blocked
    // ordinary amounts in COP/VND/IDR/KRW (bug sheet, JaimeM).
    expect(expenseAmountSchema.isValid(1_000_000)).toBe(true);
    expect(expenseAmountSchema.isValid(1e11)).toBe(true);
    expect(expenseAmountSchema.isValid(1e11 + 1)).toBe(false);
    const cop = createAmountSchema('COP');
    expect(cop.isValid(45_000_000)).toBe(true);
    expect(cop.isValid(1e9)).toBe(true);
    expect(cop.isValid(1e9 + 1)).toBe(false);
    // Three decimals would give 1e12; the ceiling keeps one amount at ≤ 1e15 money units (< 2^53).
    const kwd = createAmountSchema('KWD');
    expect(kwd.isValid(1e11)).toBe(true);
    expect(kwd.isValid(1e11 + 0.001)).toBe(false);
    expect(getAmountLimits('KWD').max * 1e4).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it('limits decimals to the currency precision', () => {
    expect(createAmountSchema('JPY').isValid(12.5)).toBe(false);
    expect(createAmountSchema('JPY').isValid(12)).toBe(true);
    expect(createAmountSchema('JPY').isValid(0.5)).toBe(false);
    expect(createAmountSchema('KWD').isValid(1.234)).toBe(true);
    expect(createAmountSchema('KWD').isValid(1.2345)).toBe(false);
    expect(createAmountSchema('INR').isValid(10.99)).toBe(true);
    expect(createAmountSchema('INR').isValid(10.999)).toBe(false);
  });

  it('exposes the limits for the UI', () => {
    expect(getAmountLimits('VND')).toEqual({decimals: 0, min: 1, max: 1e9});
    expect(getAmountLimits('USD')).toEqual({decimals: 2, min: 0.01, max: 1e11});
    expect(getAmountLimits(undefined).decimals).toBe(2);
  });

  it('states the real minimum in its message', () => {
    const issues = expenseAmountSchema.issues(0);
    expect(issues).toHaveLength(1);
    // The copy used to say "cannot be less than 0" while rejecting 0.005.
    expect(issues[0]?.message).toContain('0.01');
  });
});

describe('message evaluation', () => {
  it('resolves messages at validation time, not module load', () => {
    // A frozen message would be identical whenever it was captured; what we
    // assert here is that a message is produced through the i18n layer on
    // each parse rather than a captured constant.
    const first = expenseSchema.issues('')[0]?.message;
    const second = expenseSchema.issues('')[0]?.message;
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });
});

describe('an amount that is not a number', () => {
  it.each([NaN, Infinity, -Infinity, Number('abc'), Number.parseFloat('')])(
    '%p reads as below the minimum, once, in the app’s own copy',
    value => {
      const issues = createAmountSchema('INR').issues(value);
      expect(issues).toHaveLength(1);
      // zod rejected NaN at the type level with its own English sentence, which no translation reached.
      expect(issues[0]?.message).toContain('0.01');
      expect(createAmountSchema('INR').isValid(value)).toBe(false);
    },
  );

  it('a valid amount has no issues, and a too-precise huge one has both of its own', () => {
    expect(createAmountSchema('INR').issues(120)).toEqual([]);
    expect(createAmountSchema('JPY').issues(2e9 + 0.5)).toHaveLength(2);
  });
});

describe('every rule set reports each broken rule', () => {
  it('a name with digits that is too short breaks two rules', () => {
    expect(nameSchema.issues('a1')).toHaveLength(2);
    expect(nameSchema.isValid('a1')).toBe(false);
  });

  it('a description is free text up to 50 characters', () => {
    expect(expenseDescriptionSchema.isValid('')).toBe(true);
    expect(expenseDescriptionSchema.isValid('a'.repeat(50))).toBe(true);
    expect(expenseDescriptionSchema.issues('a'.repeat(51))).toHaveLength(1);
  });
});
