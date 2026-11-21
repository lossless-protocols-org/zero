import {AppState} from 'react-native';
import {getAllData} from '../data/services/getService';
import {buildBackupJson} from '../data/backup/export/exportFiles';
import {holdBackground, releaseBackground, writeEncryptedBackup} from '../data/backup/vault';
import {observeTables, type WatchedTable} from '../data/services/tableChanges';
import {todayIsoDay} from '../domain/dates';
import {afterInteractions} from '../platform/afterInteractions';
import {appendErrorLog, logRejection} from '../platform/errorLog';
import {
  autoBackupDirtyPreference,
  autoBackupKeepPreference,
  autoBackupLastAtPreference,
  autoBackupOnPreference,
  autoBackupStatusPreference,
} from '../platform/backupPreferences';
import {isPro} from './entitlement';
import {getEntitlement} from './entitlementStore';
import {registerProducer} from './reconcile';
import type {Entitlement} from './schema';

/**
 * The automatic backup (3.0, plan P10; Pro key `cloudBackup`). It decides
 * when a backup is written; the file and the folder are the vault's
 * (src/data/backup/vault.ts).
 *
 * zero's data changes only while zero runs: entries, recurring entries, the
 * widget's quick adds and a restore are all written by the app. So a backup
 * written as the user leaves, whenever something changed, holds everything,
 * and no background job is needed (no WorkManager, no BGTask, no library):
 *
 * - **On leaving** (AppState 'background'), if the data changed since the last
 *   backup. iOS is asked for time to finish (`holdBackground`).
 * - **On opening**, if the data changed and the last backup is a day old: the
 *   case of a change made just before zero was killed. Run when the UI has
 *   settled, through the producer, so it follows the entitlement (law L4).
 * - **On "Back up now"**, and right after setup or a new folder or passphrase.
 *
 * Without Pro nothing is written: each trigger asks the entitlement as it
 * stands at that moment. Nothing was scheduled, so nothing needs cancelling.
 */

/** Every table a backup holds: a write to any of them makes the next backup due. */
const BACKED_UP_TABLES: readonly WatchedTable[] = [
  'expenses',
  'refunds',
  'incomes',
  'categories',
  'budgets',
  'currencies',
  'debts',
  'debtors',
  'users',
  'accounts',
  'transfers',
  'checkpoints',
  'recurring_rules',
];

const DAY_MS = 86_400_000;

export type BackupRunResult = 'written' | 'skipped' | 'folderLost' | 'noKey' | 'failed';

let running: Promise<BackupRunResult> | null = null;
/** Counts changes, so a change made while a backup is being written keeps the next one due. */
let changes = 0;

const run = async (): Promise<BackupRunResult> => {
  const changesAtStart = changes;
  const token = await holdBackground().catch(() => 0);
  try {
    const built = await buildBackupJson(getAllData);
    if (!built.ok) {
      // No user: nothing to back up (onboarding is not finished). Anything else is a failure to show.
      if (built.reason === 'noUser') {
        return 'skipped';
      }
      autoBackupStatusPreference.set('failed');
      return 'failed';
    }
    const result = await writeEncryptedBackup(built.json, todayIsoDay(), Number(autoBackupKeepPreference.get()));
    if (result.ok) {
      autoBackupLastAtPreference.set(Date.now());
      autoBackupStatusPreference.set('ok');
      if (changes === changesAtStart) {
        autoBackupDirtyPreference.set(false);
      }
      return 'written';
    }
    if (result.reason === 'unavailable') {
      return 'skipped';
    }
    // A lost folder or key is said in Settings; only an unexplained failure goes to Diagnostics.
    if (result.reason === 'failed') {
      appendErrorLog(result.cause ?? new Error('backup: the write failed'), false);
    }
    autoBackupStatusPreference.set(result.reason);
    return result.reason;
  } catch (error) {
    appendErrorLog(error, false);
    autoBackupStatusPreference.set('failed');
    return 'failed';
  } finally {
    await releaseBackground(token).catch((error: unknown) => appendErrorLog(error, false));
  }
};

const start = (): Promise<BackupRunResult> => {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
};

/**
 * Writes a backup now, whatever changed: "Back up now", and after setup.
 * One at a time: a call while one runs gets that one's result, unless
 * `fresh` (a new folder or passphrase): then it waits for that run, which
 * used the old one, and writes again.
 */
export const backUpNow = async (fresh = false): Promise<BackupRunResult> => {
  if (fresh && running) {
    await running;
  }
  return start();
};

/** Whether zero may write a backup by itself at this moment. */
const allowed = (entitlement: Entitlement = getEntitlement()): boolean =>
  autoBackupOnPreference.get() && isPro(entitlement.state);

/** On leaving: back up if anything changed. @internal Exported for tests. */
export const onLeave = (): Promise<BackupRunResult> =>
  allowed() && autoBackupDirtyPreference.get() ? start() : Promise.resolve('skipped');

/** On opening: back up if something changed and the last backup is a day old. @internal Exported for tests. */
export const onOpen = (entitlement: Entitlement, nowMs: number = Date.now()): Promise<BackupRunResult> =>
  allowed(entitlement) && autoBackupDirtyPreference.get() && nowMs - autoBackupLastAtPreference.get() >= DAY_MS
    ? start()
    : Promise.resolve('skipped');

/** A write to the data: the next backup is due. @internal Exported for tests. */
export const noteChange = (): void => {
  changes += 1;
  if (!autoBackupDirtyPreference.get()) {
    autoBackupDirtyPreference.set(true);
  }
};

let started = false;

/** Starts following the data and the app's state, and registers the producer. Once per JS runtime. */
export const startAutoBackup = (): void => {
  if (started) {
    return;
  }
  started = true;
  let first = true;
  observeTables(BACKED_UP_TABLES).subscribe(() => {
    // The first emission is the subscription itself, not a change.
    if (first) {
      first = false;
      return;
    }
    noteChange();
  });
  AppState.addEventListener('change', state => {
    if (state === 'background') {
      logRejection(onLeave());
    }
  });
  registerProducer({
    key: 'autoBackup',
    // Never awaited: a backup must not hold up the producers after it.
    sync: entitlement => {
      afterInteractions(() => logRejection(onOpen(entitlement)));
    },
  });
};
