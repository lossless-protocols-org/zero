import {useState, useCallback, useRef} from 'react';
import {Keyboard} from 'react-native';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useAppSelector} from '../../../../store/hooks';
import {selectUserId} from '../../../../store/slices/userIdSlice';
import {createCurrency} from '../../../../data/services/currencyService';
import {isOnboardedPreference} from '../../../../platform/onboarding';
import currencies from '../../../../../assets/jsons/currencies.json';
import {filterCurrencies} from '../../../../domain/currencySearch';
import {useTranslation} from 'react-i18next';
import {useDialog} from '../../../../ui/context/DialogContext';
import {appendErrorLog} from '../../../../platform/errorLog';

interface CurrencySelection {
  code: string;
  symbol: string;
  name: string;
}

export const useChooseCurrency = () => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const [search, setSearch] = useState('');
  const [filteredCurrencies, setFilteredCurrencies] = useState(currencies);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencySelection | null>(null);
  const userId = useAppSelector(selectUserId);

  // Guards a double-tap on Continue, which would otherwise create two currency
  // rows before the stack swaps away from onboarding.
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCurrencySubmit = useCallback(async () => {
    if (!selectedCurrency || isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await createCurrency(selectedCurrency.code, selectedCurrency.symbol, selectedCurrency.name, userId);

      isOnboardedPreference.set(true);
    } catch (error) {
      appendErrorLog(error, false);
      // Let the user retry rather than stranding them pre-onboarding — and say so.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      await showAlert({type: 'error', message: t('onboarding.saveFailed')});
    }
  }, [selectedCurrency, userId, showAlert, t]);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    setFilteredCurrencies(filterCurrencies(currencies, text));
  }, []);

  const handleCurrencySelect = useCallback((currency: CurrencySelection) => {
    setSelectedCurrency(currency);
    // Picking a currency ends the search; closing the keyboard reveals the
    // Continue button it would otherwise cover (the grid keeps taps while the
    // keyboard is open, so this tap selects on the first try — S6, v2.7.1).
    Keyboard.dismiss();
  }, []);

  return {
    colors,
    search,
    filteredCurrencies,
    selectedCurrency,
    isSubmitting,
    handleCurrencySubmit,
    handleSearch,
    handleCurrencySelect,
  };
};
