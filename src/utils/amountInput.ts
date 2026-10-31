/**
 * Normalises what a user types into an amount field.
 *
 * Numeric keyboards follow the DEVICE locale, so in most of Europe, Latin
 * America and Indonesia the decimal key emits a COMMA. Every amount field in
 * the app then parses with `Number()`, which only understands a dot. Before
 * this existed the two inputs failed in different — and both bad — ways:
 *
 *   - AmountInput (expenses, debts) passed the comma through, so `Number()`
 *     returned NaN and Save stayed disabled with a message about the minimum
 *     amount. The user could not enter a decimal amount at all.
 *   - BudgetSheet stripped every character outside [0-9.], so `12,50` became
 *     `1250` — a silent 100x error in a budget, with nothing on screen to
 *     suggest anything had happened.
 *
 * Converting at input time rather than at parse time is deliberate: the user
 * SEES `12.50` appear as they type, so there is never a gap between what is
 * displayed and what will be stored. Nothing is silently reinterpreted.
 *
 * Grouping separators are not accepted. A field like this is typed digit by
 * digit; treating a comma as "thousands" here is what would make `12,50`
 * ambiguous, and guessing wrong means storing the wrong amount.
 */
export const normalizeAmountInput = (text: string, maxDecimals?: number): string => {
  // Any comma the keyboard produced is a decimal separator in this context.
  const withDot = text.replace(/,/g, '.');
  const digitsAndDots = withDot.replace(/[^0-9.]/g, '');

  // Zero-decimal currencies (JPY, KRW, VND, COP, …) have no fraction to type:
  // a separator is dropped as it is typed, so the user sees that it did nothing.
  if (maxDecimals === 0) {
    return digitsAndDots.replace(/\./g, '');
  }

  const firstDot = digitsAndDots.indexOf('.');
  if (firstDot === -1) {
    return digitsAndDots;
  }

  // Keep the first separator, drop any extras rather than rejecting the whole
  // edit — rejecting made the field appear frozen when a key was double-tapped.
  const head = digitsAndDots.slice(0, firstDot + 1);
  let tail = digitsAndDots.slice(firstDot + 1).replace(/\./g, '');
  if (maxDecimals !== undefined && tail.length > maxDecimals) {
    tail = tail.slice(0, maxDecimals);
  }
  return head + tail;
};
