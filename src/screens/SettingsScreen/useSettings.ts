import {useTranslation} from 'react-i18next';
import {useUserName} from '../../hooks/useUserName';
import {
  selectCurrencyCode,
  selectCurrencyId,
  selectCurrencyName,
  selectCurrencySymbol,
  setCurrencyData,
} from '../../redux/slice/currencyDataSlice';
import {useCallback} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {getAppVersion} from '../../utils/getVersion';
import {useTheme, ThemeMode} from '../../context/ThemeContext';
import {useDialog} from '../../context/DialogContext';
import {retryMigrations} from '../../backend';
import {updateCurrencyById, deleteAllData} from '../../watermelondb/services';
import {Linking, Platform} from 'react-native';
import {isOnboardedPreference} from '../../utils/onboarding';
import {fetchBudgetsByMonth, selectCurrentBudget} from '../../redux/slice/budgetDataSlice';
import {fetchCategories} from '../../redux/slice/categoryDataSlice';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {appendErrorLog} from '../../utils/errorLog';
import {DISCORD_UPDATES_URL, GITHUB_REPO_URL} from '../../constants/links';
import useMonthNavigation from '../../hooks/useMonthNavigation';
import useBudgetActions from '../../hooks/useBudgetActions';
import {swipeActionsPreference} from '../../utils/swipeActions';
import {useReportFailure} from '../../hooks/useReportFailure';
import {usePreference} from '../../hooks/usePreference';

/**
 * Result of an export attempt.
 * - 'saved'     — the file reached somewhere the user can retrieve it.
 * - 'cancelled' — the user dismissed the iOS share sheet; nothing left the app.
 * - 'failed'    — permission denied or the write threw; an error was surfaced.
 */
export type ExportOutcome = 'saved' | 'cancelled' | 'failed';

const useSettings = () => {
  const {t} = useTranslation();
  const {userName, rename} = useUserName();
  const currencyId = useAppSelector(selectCurrencyId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const currencyName = useAppSelector(selectCurrencyName);
  const currencySymbol = useAppSelector(selectCurrencySymbol);

  const {yearMonth, selectedMonthName, selectedYear} = useMonthNavigation();
  const currentBudget = useAppSelector(state => selectCurrentBudget(state, yearMonth));
  const swipeActionsEnabled = usePreference(swipeActionsPreference);

  const {colors, themeMode, setThemeMode} = useTheme();
  const {showDialog, showAlert} = useDialog();
  const appVersion = getAppVersion();

  const dispatch = useAppDispatch();

  // Exports read the database at tap time (B8), so nothing is preloaded
  // here for them (L2).
  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchBudgetsByMonth(yearMonth));
      void dispatch(fetchCategories());
    }, [dispatch, yearMonth]),
  );

  // Every preference write below used to swallow its failure behind __DEV__
  // (production nulls console.*), so a failed save looked identical to a
  // successful one. Now it is logged to Diagnostics and said out loud (B5).
  const reportSaveFailure = useReportFailure('settings.saveFailed');

  const handleThemeSelection = useCallback(
    async (theme: ThemeMode) => {
      try {
        await setThemeMode(theme);
      } catch (error) {
        await reportSaveFailure(error);
      }
    },
    [setThemeMode, reportSaveFailure],
  );

  const handleNameUpdate = useCallback(
    async (newName: string) => {
      try {
        await rename(newName);
      } catch (error) {
        await reportSaveFailure(error);
      }
    },
    [rename, reportSaveFailure],
  );

  const handleSwipeActionsToggle = useCallback(
    (enabled: boolean) => {
      try {
        swipeActionsPreference.set(enabled);
      } catch (error) {
        void reportSaveFailure(error);
      }
    },
    [reportSaveFailure],
  );

  const handleCurrencyUpdate = useCallback(
    async (currency: {code: string; name: string; symbol: string}) => {
      if (!currencyId) return;
      try {
        await updateCurrencyById(currencyId, {
          name: currency.name,
          code: currency.code,
          symbol: currency.symbol,
        });
        const updatedCurrencyData = {
          currencyId,
          currencyName: currency.name,
          currencySymbol: currency.symbol,
          currencyCode: currency.code,
        };
        dispatch(setCurrencyData(updatedCurrencyData));
      } catch (error) {
        await reportSaveFailure(error);
      }
    },
    [currencyId, dispatch, reportSaveFailure],
  );

  // External links: a device with no browser used to fail silently.
  const openLink = useCallback(
    async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch (error) {
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('settings.linkFailed')});
      }
    },
    [showAlert, t],
  );

  const handleReportBug = useCallback(() => {
    const bugSheetURL =
      'https://docs.google.com/spreadsheets/d/187UDxJbFloEUkxxX29ZJnAI7HSdhAAdSbIcAByc8CDU/edit?usp=sharing';
    void openLink(bugSheetURL);
  }, [openLink]);

  const handleRateNow = useCallback(() => {
    const url = Platform.select({
      ios: 'https://apps.apple.com/app/zero-offline-expense-tracker/id6759560225?action=write-review',
      default: 'https://play.google.com/store/apps/details?id=com.anotherwhy.zero',
    });
    void openLink(url);
  }, [openLink]);

  const handleGithub = useCallback(() => {
    void openLink(GITHUB_REPO_URL);
  }, [openLink]);

  const handleCommunity = useCallback(() => {
    void openLink(DISCORD_UPDATES_URL);
  }, [openLink]);

  const handlePrivacyPolicy = useCallback(() => {
    const privacyPolicyURL = 'https://lossless.dev/zero/privacy';
    void openLink(privacyPolicyURL);
  }, [openLink]);

  const handleTermsAndConditions = useCallback(() => {
    const termsURL = 'https://lossless.dev/zero/terms';
    void openLink(termsURL);
  }, [openLink]);

  /**
   * Delete-everything flow, with the backup step treated as a real gate.
   *
   * This used to `await exportFn()` for its side effects only and then wipe
   * regardless: a denied Android storage permission, a failed write, or a
   * dismissed iOS share sheet all left the user believing they had a backup
   * while their data was permanently destroyed. Since there is no telemetry,
   * nobody would ever have heard about it.
   *
   * Now: asking for a backup that does not get saved ABORTS the delete. The
   * user can retry or explicitly choose Skip, which is a deliberate,
   * backup-free deletion rather than an accidental one.
   */
  const handleDeleteAllData = useCallback(
    async (exportFn?: () => Promise<ExportOutcome>) => {
      const wantsBackup = await showDialog({
        type: 'info',
        message: t('settings.deleteBackupPrompt'),
        okLabel: t('settings.export'),
        cancelLabel: t('common.skip'),
      });

      if (wantsBackup && exportFn) {
        const outcome = await exportFn();
        if (outcome !== 'saved') {
          // 'failed' has already surfaced its own error (or the storage-permission
          // dialog); 'cancelled' means the user backed out of the share sheet.
          // Either way there is no backup, so stop before the irreversible step.
          await showAlert({
            type: 'error',
            message: t('settings.deleteBackupFailed'),
          });
          return;
        }
      }

      const confirmed = await showDialog({
        type: 'warning',
        message: t('settings.deleteConfirm'),
      });
      if (!confirmed) return;

      try {
        await deleteAllData();
      } catch (error) {
        // Never leave the user on a "deleted" screen with their data intact.
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('settings.deleteFailed')});
        return;
      }
      isOnboardedPreference.set(false);
    },
    [showAlert, showDialog, t],
  );

  const handleExportResult = useCallback(
    async (success: boolean, message?: string) => {
      if (success) {
        await showAlert({
          type: 'success',
          message: t('settings.exportSuccess'),
        });
      } else {
        await showAlert({
          type: 'error',
          message: message ?? t('settings.exportError'),
        });
      }
    },
    [showAlert, t],
  );

  const handleRetryMigrations = useCallback(async (): Promise<boolean> => {
    const succeeded = await retryMigrations();
    await showAlert({
      type: succeeded ? 'success' : 'error',
      message: succeeded ? t('settings.dataWarningRetrySucceeded') : t('settings.dataWarningRetryFailed'),
    });
    return succeeded;
  }, [showAlert, t]);

  const requestStorageViaDialog = useCallback(async () => {
    const confirmed = await showDialog({
      type: 'warning',
      message: t('settings.storagePermission'),
    });
    if (confirmed) {
      // Some OEM builds have no Settings activity to open; keep the cause in Diagnostics.
      await Linking.openSettings().catch((error: unknown) => {
        appendErrorLog(error, false);
      });
    }
  }, [showDialog, t]);

  const budgetMonthLabel = `${selectedMonthName} ${selectedYear}`;
  const {handleBudgetSave, handleBudgetRemove} = useBudgetActions(yearMonth, budgetMonthLabel);

  return {
    appVersion,
    colors,
    handleThemeSelection,
    handleNameUpdate,
    handleCurrencyUpdate,
    selectedTheme: themeMode,
    userName,
    currencySymbol,
    currencyCode,
    currencyName,
    currentBudget,
    budgetMonthLabel,
    yearMonth,
    handleBudgetSave,
    handleBudgetRemove,
    swipeActionsEnabled,
    handleSwipeActionsToggle,
    handleReportBug,
    handleCommunity,
    handleRateNow,
    handleGithub,
    handlePrivacyPolicy,
    handleTermsAndConditions,
    handleDeleteAllData,
    handleExportResult,
    handleRetryMigrations,
    showAlert,
    requestStorageViaDialog,
  };
};

export default useSettings;
