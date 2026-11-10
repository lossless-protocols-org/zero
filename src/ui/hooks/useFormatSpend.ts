import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {useFormatAmount} from './useFormatAmount';

/**
 * Formats a period's net spending (2.8). Refunds can outweigh a day's or a
 * category's spending; that reads as money back ("₹62 back"), never as a
 * minus sign. `isBack` lets the caller colour it.
 */
export const useFormatSpend = () => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  return useCallback(
    (spent: number): {text: string; isBack: boolean} =>
      spent < 0
        ? {text: t('refund.back', {amount: formatAmount(-spent)}), isBack: true}
        : {text: formatAmount(spent), isBack: false},
    [t, formatAmount],
  );
};
