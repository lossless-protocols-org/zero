import {useCallback, useEffect, useRef, useState} from 'react';
import {normalizeAmountInput} from '../../domain/amountInput';
import {
  amountToFieldText,
  appendAmountOperator,
  evaluateAmountExpression,
  isAmountSum,
  normalizeAmountExpression,
  type AmountOperator,
} from '../../domain/amountExpression';

/**
 * The amount field's text and what it reports to the form (AmountInput).
 *
 * Calculator off: the field shows `value`; typing is normalised (a comma
 * keyboard's decimal becomes a dot, extra decimals are dropped) and reported.
 *
 * Calculator on: the field shows the SUM the user types ("120+35"); the form
 * only ever receives its RESULT ("155"), or '' while it is not one, so every
 * form validates and saves an amount exactly as before. "=" or leaving the
 * field replaces the sum with its result. A `value` the form sets itself (a
 * reset, an edit loaded from the database) replaces the sum.
 */
export const useAmountCalculator = ({
  value,
  onChangeText,
  decimals,
  enabled,
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** The currency's own precision: a yen has no decimals, a dinar has three. */
  decimals: number;
  enabled: boolean;
}) => {
  const [sum, setSum] = useState(value);
  // The last result this field reported, to tell a value the form set itself from our own echo.
  const reported = useRef(value);
  useEffect(() => {
    if (value !== reported.current) {
      reported.current = value;
      setSum(value);
    }
  }, [value]);

  const report = useCallback(
    (next: string) => {
      reported.current = next;
      onChangeText(next);
    },
    [onChangeText],
  );

  /** Shows `text` and reports its result: the amount itself, or '' while it is not one. */
  const showSum = useCallback(
    (text: string) => {
      setSum(text);
      if (!isAmountSum(text)) {
        report(text);
        return;
      }
      const result = evaluateAmountExpression(text, decimals);
      report(result.kind === 'value' ? amountToFieldText(result.value, decimals) : '');
    },
    [decimals, report],
  );

  /** "=" and leaving the field: the sum becomes its result. */
  const settle = useCallback(() => {
    if (!enabled || !isAmountSum(sum)) {
      return;
    }
    const result = evaluateAmountExpression(sum, decimals);
    if (result.kind === 'value') {
      showSum(amountToFieldText(result.value, decimals));
    }
  }, [enabled, sum, decimals, showSum]);

  const type = useCallback(
    (text: string) =>
      enabled ? showSum(normalizeAmountExpression(text, decimals)) : onChangeText(normalizeAmountInput(text, decimals)),
    [enabled, showSum, onChangeText, decimals],
  );

  const press = useCallback(
    (key: AmountOperator | '=') => (key === '=' ? settle() : showSum(appendAmountOperator(sum, key, decimals))),
    [settle, showSum, sum, decimals],
  );

  return {
    /** What the field shows. */
    text: enabled ? sum : value,
    type,
    press,
    settle,
    /** The sum's outcome while one is typed (a value or why there is none), else null. */
    result: enabled && isAmountSum(sum) ? evaluateAmountExpression(sum, decimals) : null,
  };
};
