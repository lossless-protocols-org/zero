import useThemeColors from '../../hooks/useThemeColors';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Linking} from 'react-native';
import {requestStoragePermission} from '../../utils/dataUtils';
import {isValidExportKey} from '../../backend/export/key';
import {useDialog} from '../../context/DialogContext';
import {pick, types, isErrorWithCode, errorCodes} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import {getAllUsers, importAllData} from '../../watermelondb/services';
import {fetchCategories} from '../../redux/slice/categoryDataSlice';
import {fetchDebtors} from '../../redux/slice/debtorDataSlice';
import {fetchUserData} from '../../redux/slice/userIdSlice';
import {fetchCurrency} from '../../redux/slice/currencyDataSlice';
import {refetchExpenses} from '../../redux/slice/expenseDataSlice';
import {fetchAllDebts} from '../../redux/slice/debtDataSlice';
import {isOnboardedPreference} from '../../utils/onboarding';
import {useAppDispatch} from '../../redux/hooks';
import {refreshYearsCache} from '../../watermelondb/services/availableYearsCache';
import {upgradeExportData} from '../../backend/export/upgrader';
import {isEnvelopeTooNew, type ExportData} from '../../backend/export/format';
import {appendErrorLog, logRejection} from '../../utils/errorLog';
import {formatDate} from '../../utils/dateUtils';
import {validateExportEnvelope} from '../../backend/export/validate';
import {MAX_IMPORT_BYTES, loadBackupFile} from '../../backend/import/loadBackupFile';

type ImportedData = ExportData;

type EntityStatus = 'pending' | 'syncing' | 'done' | 'error';

interface SyncStatus {
  user: EntityStatus;
  categories: EntityStatus;
  debtors: EntityStatus;
  currencies: EntityStatus;
  expenses: EntityStatus;
  debts: EntityStatus;
  budgets: EntityStatus;
}

interface SyncStats {
  categories: number;
  expenses: number;
  debtors: number;
  debts: number;
  budgets: number;
  autoCreated: number;
}

const allStatuses = (status: EntityStatus): SyncStatus => ({
  user: status,
  categories: status,
  debtors: status,
  currencies: status,
  expenses: status,
  debts: status,
  budgets: status,
});

// `as const` keeps the values literal so t() type-checks the keys; one entry per LoadedBackup reason.
const IMPORT_FAILURE_MESSAGE_KEY = {
  invalidPath: 'existingUser.invalidFilePath',
  tooLarge: 'existingUser.fileTooLarge',
  invalidJson: 'existingUser.invalidJson',
  unreadable: 'existingUser.fileUnreadable',
} as const;

const EMPTY_STATS: SyncStats = {
  categories: 0,
  expenses: 0,
  debtors: 0,
  debts: 0,
  budgets: 0,
  autoCreated: 0,
};

const useExistingUser = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const {showDialog} = useDialog();
  const {t} = useTranslation();

  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState(t('existingUser.uploadFile'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncComplete, setIsSyncComplete] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(allStatuses('pending'));
  const [syncStats, setSyncStats] = useState<SyncStats>(EMPTY_STATS);

  const refreshStores = async () => {
    // fetchUserData must resolve FIRST: the entity thunks read userId from
    // redux state and would otherwise query with the stale/empty id.
    await dispatch(fetchUserData());
    void dispatch(fetchCategories());
    void dispatch(fetchDebtors());
    void dispatch(fetchCurrency());
    // Home opens on the current month; load just that, not the whole table.
    await refetchExpenses(dispatch, {targetMonth: formatDate(new Date(), 'YYYY-MM')});
    void dispatch(fetchAllDebts());
    // Budgets are month-scoped; Home/Reports refetch them on focus.
  };

  const importData = async () => {
    try {
      setIsSyncing(false);
      setIsSyncComplete(false);
      setSyncError(null);
      setSyncStatus(allStatuses('pending'));
      setSyncStats(EMPTY_STATS);

      const storagePermissionGranted = await requestStoragePermission();

      if (!storagePermissionGranted) {
        const confirmed = await showDialog({
          type: 'warning',
          message: t('existingUser.storagePermissionRequired'),
        });
        if (confirmed) {
          logRejection(Linking.openSettings());
        }
        return;
      }

      let result;
      try {
        result = await pick({
          type: [types.allFiles],
          allowMultiSelection: false,
        });
      } catch (pickError) {
        if (isErrorWithCode(pickError) && pickError.code === errorCodes.OPERATION_CANCELED) {
          return;
        }
        throw pickError;
      }

      const {0: res} = result;
      const loaded = await loadBackupFile({uri: res.uri, name: res.name, size: res.size, error: res.error}, path =>
        RNFS.readFile(path, 'utf8'),
      );
      if (!loaded.ok) {
        if (loaded.reason === 'unreadable') {
          // The cause's text can quote the file's display name (iOS); appendErrorLog scrubs it (M8).
          appendErrorLog(loaded.cause, false);
        } else if (loaded.reason === 'invalidPath') {
          appendErrorLog(new Error('import: the picker returned an undecodable uri'), false);
        }
        setUploadMessage(
          t(IMPORT_FAILURE_MESSAGE_KEY[loaded.reason], {
            maxMb: MAX_IMPORT_BYTES / (1024 * 1024),
            sizeMb:
              loaded.reason === 'tooLarge' && loaded.sizeBytes !== undefined
                ? Math.round(loaded.sizeBytes / (1024 * 1024))
                : 0,
          }),
        );
        return;
      }

      const validation = validateExportEnvelope(loaded.json);
      if (!validation.success || !validation.data) {
        setUploadMessage(validation.error ?? t('existingUser.invalidExport'));
        return;
      }

      const envelope = validation.data;
      if (!isValidExportKey(envelope.key)) {
        setUploadMessage(t('existingUser.invalidKey'));
        return;
      }
      // A file from a newer app can carry data this build cannot restore;
      // importing it anyway would drop that data silently (B8).
      if (isEnvelopeTooNew(envelope.version)) {
        setUploadMessage(t('existingUser.newerVersion'));
        return;
      }

      const data: ImportedData = upgradeExportData(envelope);

      // The file is valid — only NOW may existing data be touched, and only
      // with consent. The wipe itself happens inside importAllData's single
      // transaction, so cancelling here (or a failure later) loses nothing.
      const existingUsers = await getAllUsers();
      if (existingUsers.length > 0) {
        const confirmed = await showDialog({
          type: 'warning',
          message: t('existingUser.replaceDataWarning'),
        });
        if (!confirmed) {
          return;
        }
      }

      setFileName(res.name ?? 'data.json');
      setUploadMessage(t('existingUser.syncingData'));
      setIsSyncing(true);

      // Each row turns "syncing" as its group is prepared, and every row turns
      // "done" only once the single batch has committed (L3): a 20k restore
      // shows progress instead of a frozen list.
      const {userId, stats} = await importAllData(data, phase => {
        if (phase === 'committed') {
          setSyncStatus(allStatuses('done'));
          return;
        }
        if (phase === 'writing') {
          // One native call writes everything; nothing can repaint until it returns.
          setUploadMessage(t('existingUser.writingData'));
          return;
        }
        setSyncStatus(prev => ({...prev, [phase]: 'syncing'}));
      });

      // Refetch failures must not mark a committed import as failed, and a
      // failing year-cache rebuild must not block the store refresh (or Home
      // would open on the user the import just replaced). Both run; each
      // failure goes to Diagnostics.
      const refreshes = await Promise.allSettled([
        // The year cache is keyed by user id and the import minted a new one;
        // rebuild it so the month picker reflects the restored data.
        refreshYearsCache(userId),
        refreshStores(),
      ]);
      for (const outcome of refreshes) {
        if (outcome.status === 'rejected') {
          appendErrorLog(outcome.reason, false);
        }
      }

      setSyncStats({
        categories: stats.categories,
        expenses: stats.expenses,
        debtors: stats.debtors,
        debts: stats.debts,
        budgets: stats.budgets,
        autoCreated: stats.autoCreatedCategories + stats.autoCreatedDebtors,
      });
      setIsSyncing(false);
      setIsSyncComplete(true);
      setUploadMessage(t('existingUser.allDataSynced'));
    } catch (error) {
      // The on-screen message already says it failed; the log keeps the cause
      // so Diagnostics can show it (nothing else records import failures).
      appendErrorLog(error, false);
      setIsSyncing(false);
      setSyncStatus(allStatuses('error'));
      setSyncError(t('existingUser.syncFailed'));
      setUploadMessage(t('existingUser.syncError'));
    }
  };

  const reUpload = async () => {
    // No pre-wipe: importData validates the new file and swaps data
    // atomically, so a cancelled picker or bad file can't lose anything.
    setFileName(null);
    setIsSyncComplete(false);
    setSyncError(null);
    setSyncStats(EMPTY_STATS);
    await importData();
  };

  const handleContinue = async () => {
    isOnboardedPreference.set(true);
  };

  return {
    colors,
    importData,
    fileName,
    uploadMessage,
    reUpload,
    handleContinue,
    isSyncing,
    isSyncComplete,
    syncError,
    syncStatus,
    syncStats,
  };
};

export default useExistingUser;
