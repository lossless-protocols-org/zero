import {useCallback} from 'react';
import {useAppSelector} from '../redux/hooks';
import {selectCurrencyCode, selectCurrencySymbol} from '../redux/slice/currencyDataSlice';
import {formatAmountWithSymbol, formatCurrency} from '../utils/numberUtils';

/**
 * Hook that returns a locale-aware currency formatting function.
 * Handles symbol placement, grouping, and decimal precision automatically.
 *
 * Usage:
 *   const formatAmount = useFormatAmount();
 *   <Text>{formatAmount(12400)}</Text>
 *   // en-US + USD → "$12,400"
 *   // ru-RU + RUB → "12 400 ₽"
 *   // en-IN + INR → "₹12,400"
 */
const useFormatAmount = () => {
  const currencyCode = useAppSelector(selectCurrencyCode);
  const currencySymbol = useAppSelector(selectCurrencySymbol);

  const formatAmount = useCallback(
    (amount: number): string => {
      if (currencyCode) {
        return formatAmountWithSymbol(amount, currencyCode);
      }
      // Legacy rows have a symbol but no code — placement is undecidable
      // without a code, so keep the historical prefix.
      return `${currencySymbol}${formatCurrency(amount)}`;
    },
    [currencyCode, currencySymbol],
  );

  return formatAmount;
};

export default useFormatAmount;
