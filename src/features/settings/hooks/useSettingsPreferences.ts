import {useCallback} from 'react';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  selectCurrencyCode,
  selectCurrencyId,
  selectCurrencyName,
  selectCurrencySymbol,
  setCurrencyData,
} from '../../../store/slices/currencyDataSlice';
import {updateCurrencyById} from '../../../data/services/currencyService';
import {useTheme, type ThemeMode} from '../../../ui/context/ThemeContext';
import {usePreference} from '../../../ui/hooks/usePreference';
import {useReportFailure} from '../../../ui/hooks/useReportFailure';
import type {MmkvPreference} from '../../../platform/mmkvPreference';
import {weekStartPreference, type WeekStartDay} from '../../../platform/weekStart';
import {widgetAmountsPreference} from '../../../platform/widgetPreferences';
import {swipeActionsPreference} from '../../../platform/swipeActions';
import {calculatorPreference} from '../../../platform/calculatorPreference';

/**
 * Settings' Personalisation and Preferences sections: each setting's value
 * and the one way to change it. Every write that fails is logged to
 * Diagnostics and said out loud (B5); they share one helper instead of a
 * copy of the same try/report block per toggle (audit 2026-11-08 §5).
 */
export const useSettingsPreferences = () => {
  const dispatch = useAppDispatch();
  const reportSaveFailure = useReportFailure('settings.saveFailed');
  const {themeMode, setThemeMode} = useTheme();
  const currencyId = useAppSelector(selectCurrencyId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const currencyName = useAppSelector(selectCurrencyName);
  const currencySymbol = useAppSelector(selectCurrencySymbol);

  const save = useCallback(
    <T>(preference: Pick<MmkvPreference<T>, 'set'>, value: T): void => {
      try {
        preference.set(value);
      } catch (error) {
        void reportSaveFailure(error);
      }
    },
    [reportSaveFailure],
  );

  const selectTheme = useCallback(
    async (theme: ThemeMode) => {
      try {
        await setThemeMode(theme);
      } catch (error) {
        await reportSaveFailure(error);
      }
    },
    [setThemeMode, reportSaveFailure],
  );

  const updateCurrency = useCallback(
    async (currency: {code: string; name: string; symbol: string}) => {
      if (!currencyId) {
        return;
      }
      try {
        await updateCurrencyById(currencyId, {name: currency.name, code: currency.code, symbol: currency.symbol});
        dispatch(
          setCurrencyData({
            currencyId,
            currencyName: currency.name,
            currencySymbol: currency.symbol,
            currencyCode: currency.code,
          }),
        );
      } catch (error) {
        await reportSaveFailure(error);
      }
    },
    [currencyId, dispatch, reportSaveFailure],
  );

  return {
    theme: {mode: themeMode, select: selectTheme},
    currency: {code: currencyCode, name: currencyName, symbol: currencySymbol, update: updateCurrency},
    weekStart: {
      day: usePreference(weekStartPreference),
      select: (day: WeekStartDay) => save(weekStartPreference, day),
    },
    swipeActions: {
      enabled: usePreference(swipeActionsPreference),
      set: (enabled: boolean) => save(swipeActionsPreference, enabled),
    },
    calculator: {
      enabled: usePreference(calculatorPreference),
      set: (enabled: boolean) => save(calculatorPreference, enabled),
    },
    // The widget publisher subscribes to this preference and rewrites the snapshot.
    widgetAmounts: {
      shown: usePreference(widgetAmountsPreference),
      set: (shown: boolean) => save(widgetAmountsPreference, shown),
    },
  };
};
