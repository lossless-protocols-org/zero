import {useTranslation} from 'react-i18next';
import {
  autoBackupLastAtPreference,
  autoBackupOnPreference,
  autoBackupStatusPreference,
} from '../../platform/backupPreferences';
import {formatDisplayDate} from '../../platform/dateFormat';
import {usePreference} from './usePreference';

/**
 * The automatic backup in one line, for its Settings row (3.0, plan P10):
 * off, waiting for the first backup, needing attention, or when the last one
 * was made. The row is Pro's (`<ProSlot feature="cloudBackup">`).
 */
export const useAutoBackupSummary = (): {text: string; problem: boolean} => {
  const {t} = useTranslation();
  const on = usePreference(autoBackupOnPreference);
  const lastAt = usePreference(autoBackupLastAtPreference);
  const status = usePreference(autoBackupStatusPreference);
  if (!on) {
    return {text: t('settings.autoBackupOff'), problem: false};
  }
  if (status === 'folderLost' || status === 'noKey' || status === 'failed') {
    return {text: t('settings.autoBackupProblem'), problem: true};
  }
  return lastAt > 0
    ? {text: t('settings.autoBackupLast', {when: formatDisplayDate(lastAt, 'dateTime')}), problem: false}
    : {text: t('settings.autoBackupWaiting'), problem: false};
};
