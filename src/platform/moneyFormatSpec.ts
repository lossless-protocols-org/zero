import {getNumberFormatter} from './numberFormat';
import {getCurrencyDecimals, getEffectiveLocaleForCurrency} from './currencyLocale';

/**
 * How formatAmountWithSymbol writes money in this currency and locale, as
 * plain rules a native side can apply without Intl (2.8: the iOS widget redoes
 * its figures after an entry made from Siri, Shortcuts or a control, before
 * zero has run). Read once from Intl's own parts, so it cannot disagree.
 */
export interface MoneyFormatSpec {
  /** Text before the digits ("₹", "US$ ") and after them (" €", " kr"). */
  prefix: string;
  suffix: string;
  /** Group and decimal separators. */
  group: string;
  decimal: string;
  /** Digits per group, from the right: [3] (1,234,567) or [3, 2] (12,34,567). */
  grouping: number[];
  /** The currency's own decimals (0 yen, 2 rupee, 3 dinar). */
  maxDecimals: number;
  /** The locale's ten digits, 0 to 9 ("0123456789", or "٠١٢٣٤٥٦٧٨٩" in Arabic). */
  digits: string;
}

export const moneyFormatSpec = (currencyCode: string, locale?: string): MoneyFormatSpec => {
  const effectiveLocale = locale ?? getEffectiveLocaleForCurrency(currencyCode);
  const maxDecimals = getCurrencyDecimals(currencyCode);
  const options = {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: maxDecimals,
    maximumFractionDigits: maxDecimals,
  } as const;
  let formatter: Intl.NumberFormat;
  try {
    formatter = getNumberFormatter(effectiveLocale, {...options, currencyDisplay: 'narrowSymbol'});
  } catch {
    formatter = getNumberFormatter(effectiveLocale, {...options, currencyDisplay: 'symbol'});
  }
  // 1234567890 without grouping writes each digit once: 1…9, then 0.
  const ten = Array.from(new Intl.NumberFormat(effectiveLocale, {useGrouping: false}).format(1_234_567_890));
  const digits = ten.length === 10 ? `${ten[9]}${ten.slice(0, 9).join('')}` : '0123456789';
  // Read the rules off one formatted sample (iOS Hermes has no formatToParts):
  // digits in runs, separators between them, everything else around them.
  const sample = Array.from(formatter.format(1_234_567.891));
  const isDigit = (c: string): boolean => digits.includes(c) || (c >= '0' && c <= '9');
  const first = sample.findIndex(isDigit);
  const last = sample.length - 1 - [...sample].reverse().findIndex(isDigit);
  const runs: string[] = [];
  const separators: string[] = [];
  let run = '';
  let gap = '';
  for (const c of sample.slice(first, last + 1)) {
    if (isDigit(c)) {
      if (gap) {
        separators.push(gap);
        gap = '';
      }
      run += c;
    } else {
      if (run) {
        runs.push(run);
        run = '';
      }
      gap += c;
    }
  }
  runs.push(run);
  // With decimals the last run is the fraction and the last separator the decimal point.
  const integerRuns = maxDecimals > 0 ? runs.slice(0, -1) : runs;
  const groupSeparators = maxDecimals > 0 ? separators.slice(0, -1) : separators;
  const sizes =
    integerRuns.length > 1
      ? integerRuns
          .slice(1)
          .map(r => r.length)
          .reverse()
      : [0];
  return {
    prefix: sample.slice(0, first).join(''),
    suffix: sample.slice(last + 1).join(''),
    group: groupSeparators[0] ?? '',
    decimal: maxDecimals > 0 ? (separators[separators.length - 1] ?? '.') : '.',
    // [3, 3] → [3]; [3, 2] stays: the first size, then the repeating one.
    grouping: sizes.length > 1 && sizes[1] === sizes[0] ? [sizes[0] ?? 3] : sizes.slice(0, 2),
    maxDecimals,
    digits,
  };
};

/**
 * Applies a MoneyFormatSpec to an amount ≥ 0 exactly as
 * formatAmountWithSymbol would: whole amounts without decimals, others with
 * the currency's (at most 2, or all 3 for three-decimal currencies). The iOS
 * widget's Swift MoneyFormat mirrors this function line by line.
 * @internal test — the Swift twin is the production caller.
 */
export const formatWithMoneySpec = (spec: MoneyFormatSpec, amount: number): string => {
  const digits = spec.maxDecimals === 3 ? 3 : Number.isInteger(amount) ? 0 : Math.min(2, spec.maxDecimals);
  const [whole = '0', fraction = ''] = Math.abs(amount).toFixed(digits).split('.');
  const groups: string[] = [];
  let rest = whole;
  let size = spec.grouping[0] ?? 0;
  while (size > 0 && rest.length > size) {
    groups.unshift(rest.slice(-size));
    rest = rest.slice(0, -size);
    size = spec.grouping[1] ?? size;
  }
  groups.unshift(rest);
  const latin = groups.join(spec.group) + (digits > 0 ? spec.decimal + fraction : '');
  const glyphs = Array.from(spec.digits);
  const number = Array.from(latin, c => (c >= '0' && c <= '9' ? (glyphs[Number(c)] ?? c) : c)).join('');
  return spec.prefix + number + spec.suffix;
};
