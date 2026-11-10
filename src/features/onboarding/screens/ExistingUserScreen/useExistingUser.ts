import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Linking} from 'react-native';
import {requestStoragePermission} from '../../../../platform/storagePermission';
import {isValidExportKey} from '../../../../data/backup/export/key';
import {useDialog} from '../../../../ui/context/DialogContext';
import {pick, types, isErrorWithCode, errorCodes} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import {getAllUsers} from '../../../../data/services/userService';
import {importAllData} from '../../../../data/services/importService';
import {bootstrapSession} from '../../../../store/bootstrapSession';
import {isOnboardedPreference} from '../../../../platform/onboarding';
import {useAppDispatch} from '../../../../store/hooks';
import {refreshYearsCache} from '../../../../data/services/availableYearsCache';
import {upgradeExportData} from '../../../../data/backup/export/upgrader';
import {isEnvelopeTooNew, type ExportData} from '../../../../data/backup/export/format';
import {appendErrorLog, logRejection} from '../../../../platform/errorLog';
import {validateExportEnvelope} from '../../../../data/backup/export/validate';
import {MAX_IMPORT_BYTES, loadBackupFile} from '../../../../data/backup/import/loadBackupFile';
import {wipeUserStorage} from '../../../../platform/storageInventory';
import {resetSession} from '../../../../store/rootReducer';

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
  incomes: EntityStatus;
}

interface SyncStats {
  categories: number;
  expenses: number;
  debtors: number;
  debts: number;
  budgets: number;
  incomes: number;
  autoCreated: number;
  /** Extra income categories folded into one (Free has one), and the one kept. */
  mergedIncome: number;
  incomeCategoryKept: string | null;
}

const allStatuses = (status: EntityStatus): SyncStatus => ({
  user: status,
  categories: status,
  debtors: status,
  currencies: status,
  expenses: status,
  debts: status,
  budgets: status,
  incomes: status,
});

// `as const` keeps the values literal so t() type-checks the keys; one entry per LoadedBackup reason.
const IMPORT_FAILURE_MESSAGE_KEY = {
  invalidPath: 'existingUser.invalidFilePath',
  tooLarge: 'existingUser.fileTooLarge',
  invalidJson: 'existingUser.invalidJson',
  unreadable: 'existingUser.fileUnreadable',
} as const;

/**
 * The line under the upload button, kept as a key and rendered with t() on
 * every render: a translated string in state stayed in the language it was
 * first shown in (audit 2026-11-08 §3.13).
 */
type UploadMessageKey =
  | 'existingUser.uploadFile'
  | (typeof IMPORT_FAILURE_MESSAGE_KEY)[keyof typeof IMPORT_FAILURE_MESSAGE_KEY]
  | 'existingUser.invalidExport'
  | 'existingUser.invalidKey'
  | 'existingUser.newerVersion'
  | 'existingUser.syncingData'
  | 'existingUser.writingData'
  | 'existingUser.allDataSynced'
  | 'existingUser.syncError';

interface UploadMessage {
  key: UploadMessageKey;
  params?: {maxMb: number; sizeMb: number};
}

const EMPTY_STATS: SyncStats = {
  categories: 0,
  expenses: 0,
  debtors: 0,
  debts: 0,
  budgets: 0,
  incomes: 0,
  autoCreated: 0,
  mergedIncome: 0,
  incomeCategoryKept: null,
};

export const useExistingUser = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const {showDialog} = useDialog();
  const {t} = useTranslation();

  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<UploadMessage>({key: 'existingUser.uploadFile'});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncComplete, setIsSyncComplete] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(allStatuses('pending'));
  const [syncStats, setSyncStats] = useState<SyncStats>(EMPTY_STATS);

  // The restored user's session, as the app shell starts any session; each
  // screen then loads its own month and lists on focus.
  const refreshStores = async () => {
    await dispatch(bootstrapSession());
  };

  const importData = async () => {
    try {
      setIsSyncing(false);
      setIsSyncComplete(false);
      setSyncFailed(false);
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
        setUploadMessage({
          key: IMPORT_FAILURE_MESSAGE_KEY[loaded.reason],
          params: {
            maxMb: MAX_IMPORT_BYTES / (1024 * 1024),
            sizeMb:
              loaded.reason === 'tooLarge' && loaded.sizeBytes !== undefined
                ? Math.round(loaded.sizeBytes / (1024 * 1024))
                : 0,
          },
        });
        return;
      }

      const validation = validateExportEnvelope(loaded.json);
      if (!validation.success || !validation.data) {
        // The validator's text names the field ("expenses[3].amount must be a
        // number") in English: Diagnostics keeps it, the screen says it in the
        // user's language (audit §3.13). It holds paths and rules, never values.
        appendErrorLog(new Error(`import: ${validation.error ?? 'invalid export'}`), false);
        setUploadMessage({key: 'existingUser.invalidExport'});
        return;
      }

      const envelope = validation.data;
      if (!isValidExportKey(envelope.key)) {
        setUploadMessage({key: 'existingUser.invalidKey'});
        return;
      }
      // A file from a newer app can carry data this build cannot restore;
      // importing it anyway would drop that data silently (B8).
      if (isEnvelopeTooNew(envelope.version)) {
        setUploadMessage({key: 'existingUser.newerVersion'});
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
      setUploadMessage({key: 'existingUser.syncingData'});
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
          setUploadMessage({key: 'existingUser.writingData'});
          return;
        }
        setSyncStatus(prev => ({...prev, [phase]: 'syncing'}));
      });

      // The restored data replaced everything: what was derived from the old
      // data goes before the stores load the new (audit §3.10).
      try {
        wipeUserStorage();
      } catch (error) {
        appendErrorLog(error, false);
      }
      dispatch(resetSession());

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
        incomes: stats.incomes,
        autoCreated: stats.autoCreatedCategories + stats.autoCreatedDebtors,
        mergedIncome: stats.mergedIncomeCategories,
        incomeCategoryKept: stats.incomeCategoryKept,
      });
      setIsSyncing(false);
      setIsSyncComplete(true);
      setUploadMessage({key: 'existingUser.allDataSynced'});
    } catch (error) {
      // The on-screen message already says it failed; the log keeps the cause
      // so Diagnostics can show it (nothing else records import failures).
      appendErrorLog(error, false);
      setIsSyncing(false);
      setSyncStatus(allStatuses('error'));
      setSyncFailed(true);
      setUploadMessage({key: 'existingUser.syncError'});
    }
  };

  const reUpload = async () => {
    // No pre-wipe: importData validates the new file and swaps data
    // atomically, so a cancelled picker or bad file can't lose anything.
    setFileName(null);
    setIsSyncComplete(false);
    setSyncFailed(false);
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
    uploadMessage: t(uploadMessage.key, uploadMessage.params),
    reUpload,
    handleContinue,
    isSyncing,
    isSyncComplete,
    syncError: syncFailed ? t('existingUser.syncFailed') : null,
    syncStatus,
    syncStats,
  };
};
