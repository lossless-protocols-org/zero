import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  backupFolder,
  chooseBackupFolder,
  forgetBackupSetup,
  setBackupPassphrase,
  type FolderState,
} from '../../../data/backup/vault';
import {
  autoBackupDirtyPreference,
  autoBackupKeepPreference,
  autoBackupLastAtPreference,
  autoBackupOnPreference,
  autoBackupStatusPreference,
  type KeepDays,
} from '../../../platform/backupPreferences';
import {appendErrorLog} from '../../../platform/errorLog';
import {goBack} from '../../../platform/navigationUtils';
import {backUpNow} from '../../../pro/autoBackup';
import {useDialog} from '../../../ui/context/DialogContext';
import {usePreference} from '../../../ui/hooks/usePreference';
import {useFreshWhileFocused} from '../../../ui/hooks/useFreshWhileFocused';

const NO_TABLES = [] as const;

/** What the screen is waiting for, one thing at a time. */
type Busy = 'none' | 'folder' | 'setup' | 'backup' | 'passphrase' | 'off';

/**
 * The automatic backup's screen state and actions (3.0, plan P10). Setup is
 * two steps, a folder then a passphrase, and ends with a first backup, so the
 * user sees one in the folder at once. Every native step can fail; a failure
 * changes nothing and says so.
 */
export const useAutoBackup = () => {
  const {t} = useTranslation();
  const {showAlert, showDialog} = useDialog();
  const on = usePreference(autoBackupOnPreference);
  const keep = usePreference(autoBackupKeepPreference);
  const lastAt = usePreference(autoBackupLastAtPreference);
  const status = usePreference(autoBackupStatusPreference);
  const [folder, setFolder] = useState<FolderState>({state: 'none'});
  const [busy, setBusy] = useState<Busy>('none');
  // Read by `step` before it awaits anything: two taps in one frame both see the state from before either.
  const busyNow = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setFolder(await backupFolder());
    } catch (error) {
      appendErrorLog(error, false);
    }
  }, []);

  // The folder can change outside zero (deleted in Files, access taken back): read it on every
  // visit. It is not in the database, so no table's write reads it again.
  useFreshWhileFocused(
    useCallback(() => {
      void refresh();
    }, [refresh]),
    NO_TABLES,
  );

  /** Runs one action at a time; a failure is logged and said, and leaves things as they were. */
  const step = async (what: Busy, action: () => Promise<void>): Promise<void> => {
    if (busyNow.current) {
      return;
    }
    busyNow.current = true;
    setBusy(what);
    try {
      await action();
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('autoBackup.failedSetup')});
    } finally {
      busyNow.current = false;
      setBusy('none');
    }
  };

  const chooseFolder = () =>
    step('folder', async () => {
      const outcome = await chooseBackupFolder();
      if (outcome === 'notOnDevice') {
        await showAlert({type: 'info', message: t('autoBackup.notOnDevice')});
      }
      await refresh();
      // A new folder while on: the next backup goes there now, not on the next leave.
      if (outcome === 'chosen' && autoBackupOnPreference.get()) {
        await backUpNow(true);
        await refresh();
      }
    });

  const turnOn = (passphrase: string) =>
    step('setup', async () => {
      await setBackupPassphrase(passphrase);
      autoBackupOnPreference.set(true);
      autoBackupStatusPreference.set('none');
      autoBackupDirtyPreference.set(true);
      await backUpNow(true);
      await refresh();
    });

  const backUp = () =>
    step('backup', async () => {
      await backUpNow();
      await refresh();
    });

  const changePassphrase = (passphrase: string) =>
    step('passphrase', async () => {
      await setBackupPassphrase(passphrase);
      // Today's file is written again under the new passphrase at once (not by a run that began before).
      await backUpNow(true);
      goBack();
    });

  const turnOff = async () => {
    if (!(await showDialog({type: 'warning', message: t('autoBackup.turnOffConfirm')}))) {
      return;
    }
    await step('off', async () => {
      autoBackupOnPreference.set(false);
      autoBackupStatusPreference.set('none');
      autoBackupLastAtPreference.set(0);
      await forgetBackupSetup();
      await refresh();
    });
  };

  return {
    on,
    keep,
    setKeep: (value: KeepDays) => autoBackupKeepPreference.set(value),
    lastAt,
    status,
    folder,
    busy,
    chooseFolder,
    turnOn,
    backUp,
    changePassphrase,
    turnOff,
  };
};
