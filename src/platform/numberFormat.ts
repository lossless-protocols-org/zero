import {getFormatLocale} from './locale';
import {getCurrencyDecimals, getEffectiveLocaleForCurrency} from './currencyLocale';
import {appendErrorLog} from './errorLog';

const numberFormatCache = new Map<string, Intl.NumberFormat>();

/** The options this app formats with; `useGrouping` is narrowed to boolean so `true` and `'true'` cannot share a key. */
export type FormatterOptions = Pick<
  Intl.NumberFormatOptions,
  | 'style'
  | 'currency'
  | 'currencyDisplay'
  | 'notation'
  | 'compactDisplay'
  | 'minimumFractionDigits'
  | 'maximumFractionDigits'
> & {useGrouping?: boolean};

/**
 * Cached Intl.NumberFormat per locale + options. The key is concatenated
 * rather than JSON.stringify'd: this runs twice per list row (S5, v2.7.1).
 * The formatter is built from exactly the fields in the key, so an argument
 * carrying an extra option (possible through a wider typed variable) can never
 * get a formatter that disagrees with its key.
 */
export const getNumberFormatter = (locale: string, options: FormatterOptions): Intl.NumberFormat => {
  const {
    style,
    currency,
    currencyDisplay,
    notation,
    compactDisplay,
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  } = options;
  const cacheKey = `${locale}|${style}|${currency}|${currencyDisplay}|${notation}|${compactDisplay}|${minimumFractionDigits}|${maximumFractionDigits}|${useGrouping}`;
  let formatter = numberFormatCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style,
      currency,
      currencyDisplay,
      notation,
      compactDisplay,
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
    });
    numberFormatCache.set(cacheKey, formatter);
  }
  return formatter;
};

/**
 * A whole percent (42 → "42%", "%42" in Turkish, "٤٢٪" in Arabic) in the
 * user's locale; `${pct}%` put the sign on the English side everywhere (M32).
 */
const rejectedPercentLocales = new Set<string>();

export const formatPercent = (percent: number, locale: string = getFormatLocale()): string => {
  const options: FormatterOptions = {style: 'percent', maximumFractionDigits: 0};
  try {
    return getNumberFormatter(locale, options).format(percent / 100);
  } catch (error) {
    // Same fallback as formatNumber; logged once per rejected locale, not per row.
    if (!rejectedPercentLocales.has(locale)) {
      rejectedPercentLocales.add(locale);
      appendErrorLog(error, false);
    }
    return getNumberFormatter('en-US', options).format(percent / 100);
  }
};

/**
 * Formats a plain number with locale-aware grouping.
 * Uses device locale by default (respects user's OS number format preference).
 */
export const formatNumber = (
  amount: number,
  options: {
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  } = {},
): string => {
  const {
    locale = getFormatLocale(),
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    useGrouping = true,
  } = options;

  try {
    const formatter = getNumberFormatter(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
    });
    return formatter.format(amount);
  } catch {
    return amount.toLocaleString();
  }
};

/**
 * Formats an amount with locale-aware grouping and currency-specific decimals.
 * Does NOT include symbol — use formatAmountWithSymbol for full currency display.
 */
export const formatCurrency = (amount: number, currencyCode?: string, locale?: string): string => {
  const effectiveLocale = locale ?? getEffectiveLocaleForCurrency(currencyCode);
  const maxDecimals = getCurrencyDecimals(currencyCode);

  if (!Number.isFinite(amount)) return '0';

  const isWholeNumber = Number.isInteger(amount);
  const minDecimals = maxDecimals === 3 ? 3 : isWholeNumber ? 0 : Math.min(2, maxDecimals);

  try {
    const formatter = getNumberFormatter(effectiveLocale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
      useGrouping: true,
    });
    return formatter.format(amount);
  } catch {
    if (isWholeNumber) {
      return amount.toString().replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return amount.toFixed(maxDecimals).replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
};

const symbolPlacementCache = new Map<string, boolean>();

/**
 * Whether a currency's symbol goes AFTER the amount for the active locale
 * (e.g. "1 234 kr" for sv-SE/SEK, "1.234 \u20ac" for de-DE/EUR) rather than
 * before it ("$1,234").
 *
 * Used by amount INPUTS so the symbol sits on the same side the formatted
 * display strings put it. Every probe is wrapped: any Intl gap falls back to
 * prefix — exactly today's behaviour, so this can never regress a device.
 */
export const isCurrencySymbolSuffix = (currencyCode?: string, locale?: string): boolean => {
  if (!currencyCode) {
    return false;
  }
  const effectiveLocale = locale ?? getEffectiveLocaleForCurrency(currencyCode);
  const cacheKey = `${effectiveLocale}|${currencyCode}`;
  const cached = symbolPlacementCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let suffix = false;
  try {
    // Preferred: read the part order directly.
    const parts = new Intl.NumberFormat(effectiveLocale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1);
    const currencyIndex = parts.findIndex(part => part.type === 'currency');
    const integerIndex = parts.findIndex(part => part.type === 'integer');
    suffix = currencyIndex > integerIndex && integerIndex !== -1;
  } catch {
    try {
      // Fallback: a formatted sample that STARTS with a digit puts the
      // symbol at the end.
      const sample = new Intl.NumberFormat(effectiveLocale, {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'symbol',
      }).format(1);
      suffix = /^\d/.test(sample);
    } catch {
      suffix = false;
    }
  }

  symbolPlacementCache.set(cacheKey, suffix);
  return suffix;
};

/**
 * Formats a full currency string with correct symbol placement per locale.
 * Handles prefix ($ before) vs suffix (₽ after) automatically.
 *
 * Examples:
 *   en-US + USD → "$124,000"
 *   ru-RU + RUB → "124 000 ₽"
 *   hu-HU + HUF → "124 000 Ft"
 *   en-IN + INR → "₹1,24,000"
 *   de-DE + EUR → "124.000 €"
 */
export const formatAmountWithSymbol = (amount: number, currencyCode: string, locale?: string): string => {
  const effectiveLocale = locale ?? getEffectiveLocaleForCurrency(currencyCode);

  if (!Number.isFinite(amount)) return '0';

  const maxDecimals = getCurrencyDecimals(currencyCode);
  const isWholeNumber = Number.isInteger(amount);
  const minDecimals = maxDecimals === 3 ? 3 : isWholeNumber ? 0 : Math.min(2, maxDecimals);

  try {
    const formatter = getNumberFormatter(effectiveLocale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    });
    return formatter.format(amount);
  } catch {
    // Fallback: narrowSymbol not supported for this currency, try symbol
    try {
      const fallbackFormatter = getNumberFormatter(effectiveLocale, {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'symbol',
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
      });
      return fallbackFormatter.format(amount);
    } catch {
      return `${currencyCode} ${formatCurrency(amount, currencyCode, effectiveLocale)}`;
    }
  }
};
