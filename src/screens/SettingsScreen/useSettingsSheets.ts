import {useCallback} from 'react';
import type {ThemeMode} from '../../context/ThemeContext';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import i18n, {applyLocaleOverride} from '../../i18n';
import {useBudgetScopes} from '../../hooks/useBudgetScopes';
import {usePreference} from '../../hooks/usePreference';
import {weekStartPreference} from '../../utils/weekStart';
import {logRejection} from '../../utils/errorLog';
import type useSettings from './useSettings';

type Settings = ReturnType<typeof useSettings>;

/** Opens the sheets and dialogs the Settings rows lead to. */
export const useSettingsSheets = (settings: Settings) => {
  const {t} = useTranslation();
  const {
    currencySymbol,
    currencyCode,
    currencyName,
    budgetMonthLabel,
    handleBudgetSave,
    handleBudgetRemove,
    handleCurrencyUpdate,
    handleThemeSelection,
    handleNameUpdate,
    selectedTheme,
    userName,
    showAlert,
  } = settings;
  const budgetScopes = useBudgetScopes(settings.yearMonth);
  const weekStart = usePreference(weekStartPreference);

  const openBudgetSheet = useCallback(() => {
    void SheetManager.show('budget-sheet', {
      payload: {
        currencySymbol,
        currencyCode,
        monthLabel: budgetMonthLabel,
        scopes: budgetScopes,
        onSave: (amount: number, everyMonth: boolean, categoryId?: string) =>
          logRejection(handleBudgetSave(amount, everyMonth, categoryId)),
        onRemove: (isRecurring: boolean, categoryId?: string) =>
          logRejection(handleBudgetRemove(isRecurring, categoryId)),
      },
    });
  }, [currencySymbol, currencyCode, budgetMonthLabel, budgetScopes, handleBudgetSave, handleBudgetRemove]);

  const openCurrencySheet = useCallback(() => {
    void SheetManager.show('currency-picker-sheet', {
      payload: {
        selectedCurrency: {code: '', name: currencyName, symbol: currencySymbol},
        onSelect: (currency: {code: string; name: string; symbol: string}) => {
          logRejection(handleCurrencyUpdate(currency));
        },
      },
    });
  }, [currencyName, currencySymbol, handleCurrencyUpdate]);

  // Protocol R4: disclose the irreducible residue in plain language, in-app,
  // rather than only on the website.
  const openNoiseFloor = useCallback(() => {
    logRejection(
      showAlert({
        type: 'info',
        message: t('settings.whatLeavesDeviceBody'),
        // Structured rather than "\n• ..." inside the message: the message is
        // centre-aligned, so bullets written into it wrapped to ragged widths
        // with no left edge and no spacing. Four points, each one something the
        // user can actually act on.
        bullets: [
          {icon: 'shopping-bag', text: t('settings.whatLeavesDeviceStore')},
          {icon: 'share-2', text: t('settings.whatLeavesDeviceExports')},
          {icon: 'hard-drive', text: t('settings.whatLeavesDeviceBackup')},
          {icon: 'eye-off', text: t('settings.whatLeavesDeviceAccess')},
        ],
      }),
    );
  }, [showAlert, t]);

  const openWeekStartPicker = useCallback(() => {
    void SheetManager.show('week-start-picker-sheet', {
      payload: {
        current: weekStart,
        onSelect: (day: 'sunday' | 'monday') => weekStartPreference.set(day),
      },
    });
  }, [weekStart]);

  const openThemePicker = useCallback(() => {
    void SheetManager.show('theme-picker-sheet', {
      payload: {
        currentTheme: selectedTheme,
        onSelect: (theme: ThemeMode) => {
          logRejection(handleThemeSelection(theme));
        },
      },
    });
  }, [selectedTheme, handleThemeSelection]);

  const openNameSheet = () => {
    void SheetManager.show('change-name-sheet', {
      payload: {
        currentName: userName,
        onUpdate: (newName: string) => {
          logRejection(handleNameUpdate(newName));
        },
      },
    });
  };

  const openLanguagePicker = () => {
    void SheetManager.show('language-picker-sheet', {
      payload: {
        currentLanguage: i18n.language,
        onSelect: (lang: string) => {
          applyLocaleOverride(lang === 'en' ? null : lang);
        },
      },
    });
  };

  return {
    weekStart,
    openBudgetSheet,
    openCurrencySheet,
    openNoiseFloor,
    openWeekStartPicker,
    openThemePicker,
    openNameSheet,
    openLanguagePicker,
  };
};
