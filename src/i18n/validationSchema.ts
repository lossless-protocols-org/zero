import {z} from 'zod';
import i18n from './index';
import {formatNumber, getCurrencyDecimals} from '../utils/numberUtils';

/**
 * Validation messages use zod's function form (`error: () => ...`) so that
 * `i18n.t` runs at VALIDATION time. Passing the string directly evaluates it
 * at module load and freezes every message in whichever language happened to
 * be active on first import — they would never follow a language change.
 */

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

export const nameSchema = z
  .string()
  .refine(value => NAME_PATTERN.test(value), {
    error: () => i18n.t('validation.nameLettersOnly'),
  })
  .refine(value => value.length >= 3, {
    error: () => i18n.t('validation.nameMinLength'),
  })
  .refine(value => value.length <= 50, {
    error: () => i18n.t('validation.nameMaxLength'),
  });

export const expenseSchema = z
  .string()
  .min(1, {error: () => i18n.t('validation.expenseMinLength')})
  .max(25, {error: () => i18n.t('validation.expenseMaxLength')});

export const expenseDescriptionSchema = z
  .string()
  .min(0, {error: () => i18n.t('validation.descriptionMinLength')})
  .max(50, {error: () => i18n.t('validation.descriptionMaxLength')});

/**
 * Amount limits follow the currency, not a flat number.
 *
 * The old cap was 1,000,000 for everyone — fine in dollars, but a month's rent
 * in COP, VND, IDR or KRW is in the millions, and a car does not fit at all
 * (bug sheet: JaimeM, COP). The cap is now 10^(9+decimals) major units, which
 * stays far inside double precision: 1e11 × 100 minor units = 1e13 < 2^53.
 * Decimals are limited to what the currency actually has (0 for JPY/KRW/VND/
 * COP, 3 for KWD/BHD, 2 otherwise), so "¥12.5" cannot be stored.
 */
interface AmountLimits {
  /** Smallest positive amount: one minor unit. */
  min: number;
  max: number;
  decimals: number;
}

export const getAmountLimits = (currencyCode?: string): AmountLimits => {
  const decimals = getCurrencyDecimals(currencyCode);
  return {decimals, min: Math.pow(10, -decimals), max: Math.pow(10, 9 + decimals)};
};

const hasAtMostDecimals = (value: number, decimals: number): boolean => {
  const factor = Math.pow(10, decimals);
  const scaled = value * factor;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
};

export const createAmountSchema = (currencyCode?: string) => {
  const {min, max, decimals} = getAmountLimits(currencyCode);
  return z
    .number()
    .refine(value => Number.isFinite(value), {
      error: () => i18n.t('validation.amountMin', {min: formatNumber(min, {maximumFractionDigits: decimals})}),
    })
    .refine(value => value >= min, {
      error: () => i18n.t('validation.amountMin', {min: formatNumber(min, {maximumFractionDigits: decimals})}),
    })
    .refine(value => value <= max, {
      error: () => i18n.t('validation.amountMax', {max: formatNumber(max, {maximumFractionDigits: 0})}),
    })
    .refine(value => hasAtMostDecimals(value, decimals), {
      error: () => i18n.t('validation.amountDecimals', {count: decimals, code: (currencyCode ?? '').toUpperCase()}),
    });
};

/** Currency-agnostic default (2 decimals). Screens should prefer createAmountSchema(code). @internal test */
export const expenseAmountSchema = createAmountSchema();

export const categorySchema = z
  .string()
  .refine(value => CATEGORY_PATTERN.test(value), {
    error: () => i18n.t('validation.categoryLettersOnly'),
  })
  .refine(value => value.length >= 1, {
    error: () => i18n.t('validation.categoryMinLength'),
  })
  .refine(value => value.length <= CATEGORY_NAME_MAX, {
    error: () => i18n.t('validation.categoryMaxLength', {max: CATEGORY_NAME_MAX}),
  });
