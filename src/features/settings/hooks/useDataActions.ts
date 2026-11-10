import {useCallback} from 'react';
import {Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch} from '../../../store/hooks';
import {resetSession} from '../../../store/rootReducer';
import {useDialog} from '../../../ui/context/DialogContext';
import {retryMigrations} from '../../../data/startup';
import {deleteAllData} from '../../../data/services/deleteService';
import type {ExportOutcome} from '../../../data/backup/export/exportFiles';
import {isOnboardedPreference} from '../../../platform/onboarding';
import {wipeUserStorage} from '../../../platform/storageInventory';
import {appendErrorLog} from '../../../platform/errorLog';

/**
 * Settings' Data section: export results, delete everything, retry a failed
 * data migration, and the storage permission an export may need.
 */
export const useDataActions = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {showDialog, showAlert} = useDialog();

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
      // The data is gone; what was derived from it goes too (audit §3.10).
      // The flag first, so the onboarding stack replaces the screens that
      // would otherwise re-read the emptied store in the same render.
      try {
        wipeUserStorage();
      } catch (error) {
        appendErrorLog(error, false);
      }
      isOnboardedPreference.set(false);
      dispatch(resetSession());
    },
    [dispatch, showAlert, showDialog, t],
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

  return {
    deleteAllData: handleDeleteAllData,
    onExportResult: handleExportResult,
    retryMigrations: handleRetryMigrations,
    requestStorageViaDialog,
  };
};
