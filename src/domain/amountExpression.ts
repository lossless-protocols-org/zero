/**
 * The calculator in amount fields (2.8, Settings → "Calculator in amount
 * fields", off by default). The field holds a short sum such as "120+45×2";
 * the form only ever sees its result, so every rule that applies to an amount
 * (minimum, maximum, the currency's decimals) applies to the result.
 *
 * Pure and small on purpose: four operators, × and ÷ before + and −, no
 * parentheses, no `eval`. Operands are plain digits with "." as the decimal
 * point (the keyboard's comma is turned into one as it is typed, exactly as in
 * a plain amount field); grouping separators are never accepted.
 */

export type AmountOperator = '+' | '−' | '×' | '÷';

/** The operator keys, in the order the calculator row shows them. */
export const AMOUNT_OPERATORS: readonly AmountOperator[] = ['+', '−', '×', '÷'];

type AmountExpressionResult =
  | {kind: 'empty'}
  /** `isSum`: the text had an operator, so the field should show `value` once committed. */
  | {kind: 'value'; value: number; isSum: boolean}
  | {kind: 'error'; reason: 'divideByZero' | 'negative' | 'tooLarge'};

/** What a hardware keyboard or a paste may type for each operator. */
const ALIASES: Readonly<Record<string, AmountOperator>> = {
  '+': '+',
  '-': '−',
  '−': '−',
  '–': '−',
  '*': '×',
  x: '×',
  X: '×',
  '×': '×',
  '/': '÷',
  '÷': '÷',
};

const isOperator = (c: string): c is AmountOperator => c === '+' || c === '−' || c === '×' || c === '÷';

/**
 * Cleans what was typed into a calculator field: the decimal comma becomes a
 * dot, operator look-alikes become the four operators, anything else is
 * dropped. A sum never starts with an operator, two operators in a row keep
 * the last (a changed mind, not an error), each number keeps one point and at
 * most `maxDecimals` decimals, and a currency without decimals has no point.
 */
export const normalizeAmountExpression = (text: string, maxDecimals: number): string => {
  let out = '';
  let point = false;
  let decimals = 0;
  for (const raw of text.replace(/,/g, '.')) {
    const op = ALIASES[raw];
    if (op) {
      if (out === '') {
        continue;
      }
      const last = out[out.length - 1] ?? '';
      if (isOperator(last)) {
        out = out.slice(0, -1);
      } else if (last === '.') {
        out = out.slice(0, -1); // "12.+" is "12+"
      }
      out += op;
      point = false;
      decimals = 0;
    } else if (raw === '.') {
      if (maxDecimals === 0 || point) {
        continue;
      }
      const last = out[out.length - 1];
      out += last === undefined || isOperator(last) ? '0.' : '.';
      point = true;
    } else if (raw >= '0' && raw <= '9') {
      if (point) {
        if (decimals >= maxDecimals) {
          continue;
        }
        decimals += 1;
      }
      out += raw;
    }
  }
  return out;
};

/** Appends an operator key's sign (the calculator row), following normalizeAmountExpression's rules. */
export const appendAmountOperator = (text: string, op: AmountOperator, maxDecimals: number): string =>
  normalizeAmountExpression(text + op, maxDecimals);

/** True when the text is a sum rather than a single amount. */
export const isAmountSum = (text: string): boolean => [...text].some(isOperator);

/** Above any currency's cap (validationSchema: at most 1e11 major units); a sum this large is not an amount. */
const TOO_LARGE = 1e15;

/**
 * Rounds half away from zero to `decimals` places without binary drift
 * (1.005 → 1.01). The decimal shift is done on the shortest exact decimal
 * form from `toExponential()`, so very small or very large values (whose
 * `String()` is already in exponent form, "1e-7") shift correctly too.
 */
const roundTo = (value: number, decimals: number): number => {
  const sign = value < 0 ? -1 : 1;
  const [mantissa = '0', exponent = '0'] = Math.abs(value).toExponential().split('e');
  const shifted = Number(`${mantissa}e${Number(exponent) + decimals}`);
  return (sign * Math.round(shifted)) / 10 ** decimals;
};

/**
 * The value of a calculator field's text, rounded to the currency's
 * `decimals`. A trailing operator is ignored ("120+" reads 120) so the live
 * result never flickers to an error mid-typing. Division by zero and a result
 * below zero are errors; anything that is not a sum of numbers is empty.
 */
export const evaluateAmountExpression = (text: string, decimals: number): AmountExpressionResult => {
  const clean = normalizeAmountExpression(text, Math.max(decimals, 0));
  const body = clean.replace(/[+−×÷]$/, '');
  if (body === '') {
    return {kind: 'empty'};
  }
  const numbers: number[] = [];
  const operators: AmountOperator[] = [];
  let current = '';
  for (const c of body) {
    if (isOperator(c)) {
      numbers.push(Number(current));
      operators.push(c);
      current = '';
    } else {
      current += c;
    }
  }
  numbers.push(Number(current));
  if (numbers.some(n => Number.isNaN(n))) {
    return {kind: 'empty'};
  }
  if (numbers.some(n => !Number.isFinite(n))) {
    return {kind: 'error', reason: 'tooLarge'}; // a number longer than a double holds
  }

  // × and ÷ first, left to right, into a list of terms joined by + and −.
  const terms: number[] = [numbers[0] ?? 0];
  const joins: AmountOperator[] = [];
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];
    const n = numbers[i + 1] ?? 0;
    if (op === '×' || op === '÷') {
      if (op === '÷' && n === 0) {
        return {kind: 'error', reason: 'divideByZero'};
      }
      const last = terms.length - 1;
      terms[last] = op === '×' ? (terms[last] ?? 0) * n : (terms[last] ?? 0) / n;
    } else if (op) {
      joins.push(op);
      terms.push(n);
    }
  }
  let total = terms[0] ?? 0;
  for (let i = 0; i < joins.length; i++) {
    total = joins[i] === '+' ? total + (terms[i + 1] ?? 0) : total - (terms[i + 1] ?? 0);
  }

  // A product of long numbers can overflow to Infinity; nothing past TOO_LARGE is an amount.
  if (!Number.isFinite(total) || Math.abs(total) >= TOO_LARGE) {
    return {kind: 'error', reason: 'tooLarge'};
  }
  const value = roundTo(total, decimals);
  if (value < 0) {
    return {kind: 'error', reason: 'negative'};
  }
  return {kind: 'value', value: value === 0 ? 0 : value, isSum: operators.length > 0};
};

/** A result as a plain amount field holds it: "210", "12.5" (never "12.50" or an exponent). */
export const amountToFieldText = (value: number, decimals: number): string => {
  const fixed = value.toFixed(Math.max(decimals, 0));
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
};
