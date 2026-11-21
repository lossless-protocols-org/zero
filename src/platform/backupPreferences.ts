import {booleanValue, createMmkvPreference, oneOf, wholeNumber} from './mmkvPreference';

/**
 * The automatic backup's settings and its last result (3.0, plan P10). The
 * folder and the key are native (src/data/backup/vault.ts); these say whether
 * zero writes, how much it keeps, and how the last attempt went.
 */

/** Whether zero writes backups by itself. Set when the folder and passphrase are in place. */
export const autoBackupOnPreference = createMmkvPreference<boolean>('auto_backup_on', booleanValue, false);

export const KEEP_DAYS_CHOICES = ['7', '14', '30'] as const;
export type KeepDays = (typeof KEEP_DAYS_CHOICES)[number];
/** How many days of backups the folder keeps (owner decision 2026-11-11: 14 by default, the user picks). */
export const autoBackupKeepPreference = createMmkvPreference<KeepDays>(
  'backup_keep_days',
  oneOf(KEEP_DAYS_CHOICES),
  '14',
);

/** When the last backup was written (ms since 1970), or 0 for never. */
export const autoBackupLastAtPreference = createMmkvPreference<number>('auto_backup_last_at', wholeNumber, 0);

const BACKUP_STATUSES = ['none', 'ok', 'folderLost', 'noKey', 'failed'] as const;
export type BackupStatus = (typeof BACKUP_STATUSES)[number];
/** How the last attempt went: shown in Settings until the next attempt. */
export const autoBackupStatusPreference = createMmkvPreference<BackupStatus>(
  'auto_backup_status',
  oneOf(BACKUP_STATUSES),
  'none',
);

/**
 * Whether the data changed since the last backup. Kept on disk, so a change
 * made just before zero was killed is still backed up on the next open.
 * Starts true: the first backup is never skipped.
 */
export const autoBackupDirtyPreference = createMmkvPreference<boolean>('auto_backup_dirty', booleanValue, true);
