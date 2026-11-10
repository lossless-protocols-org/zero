import type {ThemeMode} from '../../../../ui/context/ThemeContext';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {i18n, applyLocaleOverride} from '../../../../i18n';
import {useDialog} from '../../../../ui/context/DialogContext';
import {useBudgetScopes} from '../../../../ui/hooks/useBudgetScopes';
import {useRenameSheet} from '../../../../ui/hooks/useUserName';
import {logRejection} from '../../../../platform/errorLog';
import type {useSettings} from './useSettings';

type Settings = ReturnType<typeof useSettings>;

/**
 * Opens the sheets and dialogs the Settings rows lead to. Openers run on a
 * tap, so they are plain functions over the current values.
 */
export const useSettingsSheets = ({preferences, budget}: Pick<Settings, 'preferences' | 'budget'>) => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const budgetScopes = useBudgetScopes(budget.yearMonth);
  const {currency, theme, weekStart} = preferences;

  const openBudgetSheet = () => {
    void SheetManager.show('budget-sheet', {
      payload: {
        currencySymbol: currency.symbol,
        currencyCode: currency.code,
        monthLabel: budget.monthLabel,
        scopes: budgetScopes,
        onSave: (amount: number, everyMonth: boolean, categoryId?: string) =>
          logRejection(budget.save(amount, everyMonth, categoryId)),
        onRemove: (isRecurring: boolean, categoryId?: string) => logRejection(budget.remove(isRecurring, categoryId)),
      },
    });
  };

  const openCurrencySheet = () => {
    void SheetManager.show('currency-picker-sheet', {
      payload: {
        selectedCurrency: {code: '', name: currency.name, symbol: currency.symbol},
        onSelect: (picked: {code: string; name: string; symbol: string}) => {
          logRejection(currency.update(picked));
        },
      },
    });
  };

  // Protocol R4: disclose the irreducible residue in plain language, in-app,
  // rather than only on the website.
  const openNoiseFloor = () => {
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
  };

  /** The one Pro surface 2.8 has: says what stays free and what 3.0 brings. No price, no button. */
  const openProInfo = () => {
    logRejection(showAlert({type: 'info', message: t('settings.zeroProBody')}));
  };

  const openWeekStartPicker = () => {
    void SheetManager.show('week-start-picker-sheet', {
      payload: {current: weekStart.day, onSelect: weekStart.select},
    });
  };

  const openThemePicker = () => {
    void SheetManager.show('theme-picker-sheet', {
      payload: {
        currentTheme: theme.mode,
        onSelect: (mode: ThemeMode) => {
          logRejection(theme.select(mode));
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
    openBudgetSheet,
    openCurrencySheet,
    openNoiseFloor,
    openProInfo,
    openWeekStartPicker,
    openThemePicker,
    // The same rename flow as the Home header's avatar (useUserName).
    openNameSheet: useRenameSheet(),
    openLanguagePicker,
  };
};
