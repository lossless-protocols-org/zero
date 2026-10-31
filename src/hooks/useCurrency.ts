import {useAppSelector} from '../redux/hooks';
import {selectCurrencyCode, selectCurrencySymbol} from '../redux/slice/currencyDataSlice';

/** The user's currency, for components that format or label amounts. */
export const useCurrency = () => ({
  code: useAppSelector(selectCurrencyCode),
  symbol: useAppSelector(selectCurrencySymbol),
});
