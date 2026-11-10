import {i18n} from '.';
import {formatNumber} from '../platform/numberFormat';
import {getCurrencyDecimals} from '../platform/currencyLocale';

/**
 * The rules one form field's value must meet, with the message for each.
 *
 * These used to be zod schemas. zod is 525 KB of the 4.4 MB JS bundle (its
 * error messages in 40-odd languages alone are 298 KB) and was evaluated the
 * first time any form opened, the quick-add sheet included; the forms only
 * ever ran a chain of refinements. zod stays where it earns its size: a
 * backup's structure (data/backup/export/validate.ts), audit 2026-11-08 §8.5.
 *
 * Messages are functions, so `i18n.t` runs at validation time and follows a
 * language change; a string would freeze in whichever language was active
 * when this module first loaded.
 */
export interface FieldRules<T> {
  /** Every rule the value breaks, in order; [] when it is valid. */
  issues: (value: T) => Array<{message: string}>;
  isValid: (value: T) => boolean;
}

type Rule<T> = readonly [holds: (value: T) => boolean, message: () => string];

const rules = <T>(...list: ReadonlyArray<Rule<T>>): FieldRules<T> => ({
  issues: value => list.filter(([holds]) => !holds(value)).map(([, message]) => ({message: message()})),
  isValid: value => list.every(([holds]) => holds(value)),
});

/**
 * Person/category names accept any script: letters (\p{L}) and combining
 * marks (\p{M}) plus spaces, apostrophes and hyphens. The previous
 * `[A-Za-z\s]` rejected José, हिंदी, Ольga and every non-Latin name — an
 * unacceptable restriction for an app positioned as India-first.
 */
const NAME_PATTERN = /^[\p{L}\p{M}\s'-]+$/u;
const CATEGORY_PATTERN = /^[\p{L}\p{M}\p{N}\s'-]+$/u;

/** Was 18; raised for users whose category names are phrases (App Store, MohemadFaizan). */
const CATEGORY_NAME_MAX = 40;

export const nameSchema = rules<string>(
  [value => NAME_PATTERN.test(value), () => i18n.t('validation.nameLettersOnly')],
  [value => value.length >= 3, () => i18n.t('validation.nameMinLength')],
  [value => value.length <= 50, () => i18n.t('validation.nameMaxLength')],
);

export const expenseSchema = rules<string>(
  [value => value.length >= 1, () => i18n.t('validation.expenseMinLength')],
  [value => value.length <= 25, () => i18n.t('validation.expenseMaxLength')],
);

export const expenseDescriptionSchema = rules<string>([
  value => value.length <= 50,
  () => i18n.t('validation.descriptionMaxLength'),
]);

/**
 * Amount limits follow the currency, not a flat number.
 *
 * The old cap was 1,000,000 for everyone — fine in dollars, but a month's rent
 * in COP, VND, IDR or KRW is in the millions, and a car does not fit at all
 * (bug sheet: JaimeM, COP). The cap is 10^(9+decimals) major units, never
 * more than 10^11 (MAX_MAJOR_UNITS): money is added as integers of 10⁻⁴
 * (numberUtils MONEY_SCALE), so one amount is at most 10^15 units and a sum
 * stays exact up to 2^53 ≈ 9×10^15 units, about 900 billion major units.
 * Without the ceiling a three-decimal currency (KWD, BHD, OMR) allowed 10^12,
 * i.e. 10^16 units, past 2^53 (audit 2026-11-08 §3.6).
 * Decimals are limited to what the currency actually has (0 for JPY/KRW/VND/
 * COP, 3 for KWD/BHD, 2 otherwise), so "¥12.5" cannot be stored.
 */
interface AmountLimits {
  /** Smallest positive amount: one minor unit. */
  min: number;
  max: number;
  decimals: number;
}

const MAX_MAJOR_UNITS = 1e11;

export const getAmountLimits = (currencyCode?: string): AmountLimits => {
  const decimals = getCurrencyDecimals(currencyCode);
  return {decimals, min: Math.pow(10, -decimals), max: Math.min(Math.pow(10, 9 + decimals), MAX_MAJOR_UNITS)};
};

const hasAtMostDecimals = (value: number, decimals: number): boolean => {
  const factor = Math.pow(10, decimals);
  const scaled = value * factor;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
};

/**
 * A value that is not a finite number (an empty field, "abc", NaN, Infinity)
 * breaks only the first rule: one message, the minimum, rather than four.
 */
export const createAmountSchema = (currencyCode?: string): FieldRules<number> => {
  const {min, max, decimals} = getAmountLimits(currencyCode);
  const belowMin = () => i18n.t('validation.amountMin', {min: formatNumber(min, {maximumFractionDigits: decimals})});
  const finite = rules<number>([value => Number.isFinite(value) && value >= min, belowMin]);
  const bounds = rules<number>(
    [value => value <= max, () => i18n.t('validation.amountMax', {max: formatNumber(max, {maximumFractionDigits: 0})})],
    [
      value => hasAtMostDecimals(value, decimals),
      () => i18n.t('validation.amountDecimals', {count: decimals, code: (currencyCode ?? '').toUpperCase()}),
    ],
  );
  return {
    issues: value => (finite.isValid(value) ? bounds.issues(value) : finite.issues(value)),
    isValid: value => finite.isValid(value) && bounds.isValid(value),
  };
};

/** Currency-agnostic default (2 decimals). Screens should prefer createAmountSchema(code). @internal test */
export const expenseAmountSchema = createAmountSchema();

export const categorySchema = rules<string>(
  [value => CATEGORY_PATTERN.test(value), () => i18n.t('validation.categoryLettersOnly')],
  [value => value.length >= 1, () => i18n.t('validation.categoryMinLength')],
  [value => value.length <= CATEGORY_NAME_MAX, () => i18n.t('validation.categoryMaxLength', {max: CATEGORY_NAME_MAX})],
);
