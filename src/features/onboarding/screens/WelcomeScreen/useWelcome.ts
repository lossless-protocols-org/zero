import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {countAllRecords, deleteAllData, type RecordCounts} from '../../../../data/services/deleteService';
import {navigate} from '../../../../platform/navigationUtils';
import {useDialog} from '../../../../ui/context/DialogContext';
import {isOnboardedPreference} from '../../../../platform/onboarding';
import {appendErrorLog} from '../../../../platform/errorLog';

type ShowDialog = ReturnType<typeof useDialog>['showDialog'];

/** 'delete' for an empty or seeded-only device; otherwise only after an explicit yes. */
const askAboutExistingRecords = async (
  counts: RecordCounts,
  showDialog: ShowDialog,
  t: TFunction,
): Promise<'keep' | 'delete' | 'cancel'> => {
  const confirmDelete = async (message: string) =>
    (await showDialog({type: 'warning', message, okLabel: t('common.delete'), cancelLabel: t('common.cancel')}))
      ? 'delete'
      : 'cancel';

  // Seeded categories and the currency row are not something the user entered.
  const entered = counts.expenses + counts.refunds + counts.incomes + counts.debts + counts.debtors + counts.budgets;
  if (entered === 0) {
    return 'delete';
  }
  if (counts.users > 0) {
    const hasTransactions = counts.expenses > 0;
    const keep = await showDialog({
      type: 'info',
      message: hasTransactions
        ? t('welcome.existingDataPrompt', {count: counts.expenses})
        : t('welcome.existingRecordsPrompt'),
      okLabel: t('welcome.keepData'),
      cancelLabel: t('welcome.startFresh'),
    });
    if (keep) {
      return 'keep';
    }
    return confirmDelete(
      hasTransactions
        ? t('welcome.deleteExistingConfirm', {count: counts.expenses})
        : t('welcome.deleteRecordsConfirm'),
    );
  }
  // No user row: Zero cannot show these records, so keeping is not on offer,
  // but they are never deleted without an explicit yes.
  return confirmDelete(t('welcome.deleteOrphanedConfirm'));
};

export const useWelcome = () => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const {showDialog, showAlert} = useDialog();
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const handleAlreadyUser = useCallback(() => {
    navigate('ExistingUserScreen');
  }, []);

  /**
   * "Get Started" used to wipe the database with no confirmation, on the
   * assumption that a device showing this screen is empty. It is not, when the
   * onboarding flag in MMKV is lost while SQLite still holds everything (a
   * cleared-storage edge, a restore, a bug). One tap then destroyed months of
   * records with nothing on screen to say so (B1).
   *
   * Now: if transactions exist, offer to keep them (straight to Home) and only
   * delete after an explicit second confirmation whose safe default — the
   * backdrop, the back button — is "do nothing". Records that cannot be kept
   * (no user row) are confirmed the same way.
   */
  const handleNewUser = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setIsBusy(true);
    try {
      let counts;
      try {
        counts = await countAllRecords();
      } catch (error) {
        // If we cannot even count, do not guess that the device is empty.
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('welcome.deleteFailed')});
        return;
      }

      const choice = await askAboutExistingRecords(counts, showDialog, t);
      if (choice === 'keep') {
        isOnboardedPreference.set(true);
        return;
      }
      if (choice === 'cancel') {
        return;
      }

      if (counts.total > 0) {
        try {
          await deleteAllData();
        } catch (error) {
          appendErrorLog(error, false);
          await showAlert({type: 'error', message: t('welcome.deleteFailed')});
          return;
        }
      }
      navigate('PersonalizeScreen');
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }, [showAlert, showDialog, t]);

  return {
    colors,
    isBusy,
    handleAlreadyUser,
    handleNewUser,
  };
};
