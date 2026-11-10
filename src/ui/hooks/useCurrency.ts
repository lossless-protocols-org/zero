import {useMemo} from 'react';
import {useAppSelector} from '../../store/hooks';
import {selectCurrencyCode, selectCurrencySymbol} from '../../store/slices/currencyDataSlice';

/**
 * The user's currency, for components that format or label amounts. One
 * object until the currency changes, so a caller can depend on it.
 */
export const useCurrency = () => {
  const code = useAppSelector(selectCurrencyCode);
  const symbol = useAppSelector(selectCurrencySymbol);
  return useMemo(() => ({code, symbol}), [code, symbol]);
};
