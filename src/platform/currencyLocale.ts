import {getFormatLocale, getDeviceLocaleInfo} from './locale';

/**
 * Which locale writes a currency, and how many decimals it has: the rules
 * every money formatter (numberFormat, moneyFormatSpec) starts from.
 */

const LAKH_CURRENCIES = new Set(['INR', 'BDT', 'NPR', 'PKR', 'LKR']);

const LAKH_COUNTRY_CODES = new Set(['IN', 'BD', 'NP', 'PK', 'LK']);

// The lakh/crore grouping lives in the numbering system of South Asian
// LANGUAGES, not only their countries — "hi-US" still groups as 1,24,000.
const LAKH_LANGUAGE_CODES = new Set([
  'hi',
  'bn',
  'ta',
  'te',
  'mr',
  'pa',
  'gu',
  'kn',
  'ml',
  'or',
  'as',
  'ne',
  'si',
  'ur',
]);

/**
 * Returns the correct locale for currency formatting.
 * Prevents Indian lakh/crore grouping from leaking into non-South-Asian currencies.
 *
 * Both the language and the region are read from the SAME locale tag —
 * previously the language came from the (override-aware) format locale while
 * the country came from the device, so an override like `en-US` on an Indian
 * device, or `hi-IN` on a US device, produced the wrong grouping.
 */
export const getEffectiveLocaleForCurrency = (currencyCode?: string): string => {
  const formatLocale = getFormatLocale();
  if (!currencyCode) return formatLocale;

  const [languageSubtag, regionSubtag] = formatLocale.split('-');
  // Fall back to the device region only when the tag carries no region.
  const region = regionSubtag || getDeviceLocaleInfo().countryCode;

  const isLakhLocale =
    LAKH_COUNTRY_CODES.has(region?.toUpperCase() ?? '') || LAKH_LANGUAGE_CODES.has(languageSubtag?.toLowerCase() ?? '');
  const isLakhCurrency = LAKH_CURRENCIES.has(currencyCode.toUpperCase());

  if (isLakhLocale && !isLakhCurrency) {
    return 'en-US';
  }

  return formatLocale;
};

const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  IDR: 0,
  CLP: 0,
  COP: 0,
  HUF: 0,
  ISK: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BIF: 0,
  DJF: 0,
  GNF: 0,
  KMF: 0,
  MGA: 0,
  PKR: 0,
  IRR: 0,
  IQD: 0,
  LBP: 0,
  MMK: 0,
  SOS: 0,
  SYP: 0,
  TZS: 0,
  UZS: 0,
  YER: 0,
  ZMW: 0,
  ZWG: 0,
  AFN: 0,
  ALL: 0,
  AMD: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  LYD: 3,
  JOD: 3,
};

/** The currency's own decimals (ISO 4217): 0 for yen, 2 for most, 3 for dinar. */
export const getCurrencyDecimals = (currencyCode?: string): number => {
  if (!currencyCode) return 2;
  return CURRENCY_DECIMALS[currencyCode.toUpperCase()] ?? 2;
};
