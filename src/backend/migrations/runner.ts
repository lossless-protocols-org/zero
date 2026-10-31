import StorageService from '../../utils/storage';
import {DATA_MIGRATIONS} from './registry';
import {appendErrorLog} from '../../utils/errorLog';
import {getAppVersion} from '../../utils/getVersion';
import {getDatabaseError} from '../../watermelondb/database';

const MIGRATION_VERSION_KEY = 'data_migration_version';
const MIGRATION_RETRY_KEY = 'data_migration_retry_count';
const MIGRATION_FAILED_KEY = 'data_migration_failed';
const MIGRATION_FAILED_APP_VERSION_KEY = 'data_migration_failed_app_version';
const MAX_RETRIES = 3;

/**
 * Returns true if migrations have permanently failed (exceeded retry limit).
 */
export const hasMigrationFailed = (): boolean => {
  return StorageService.getBoolean(MIGRATION_FAILED_KEY);
};

const clearMigrationFailure = (): void => {
  StorageService.setBoolean(MIGRATION_FAILED_KEY, false);
  StorageService.setNumber(MIGRATION_RETRY_KEY, 0);
  StorageService.removeItemSync(MIGRATION_FAILED_APP_VERSION_KEY);
};

/**
 * User-initiated retry (Settings banner): clears the permanent-failure flag
 * and re-runs pending migrations. True only when every migration has now run:
 * a retry that fails again is attempt 1 of a fresh count, so "not flagged as
 * failed" is not success (it hid the Settings warning while still broken).
 */
export const retryMigrations = async (): Promise<boolean> => {
  clearMigrationFailure();
  await runMigrations();
  const latest = Math.max(0, ...DATA_MIGRATIONS.map(m => m.version));
  const completed = (StorageService.getNumber(MIGRATION_VERSION_KEY) ?? 0) >= latest;
  if (!completed) {
    // The user asked and it still failed: keep the warning up (banner and
    // Settings) rather than wait three more launches to raise it again.
    StorageService.setBoolean(MIGRATION_FAILED_KEY, true);
    StorageService.setItemSync(MIGRATION_FAILED_APP_VERSION_KEY, getAppVersion());
  }
  return completed;
};

/**
 * Sequential data migration runner.
 *
 * - Reads current version from MMKV
 * - Runs each pending migration in order (version > current)
 * - Advances version ONLY after each migration succeeds
 * - If a migration fails, increments retry counter
 * - After MAX_RETRIES consecutive failures on the same version, sets a
 *   permanent failure flag and stops retrying
 */
export const runMigrations = async (): Promise<void> => {
  if (hasMigrationFailed()) {
    // Don't stay poisoned forever: an app update may ship a fixed migration,
    // so the permanent flag only holds for the app version that set it.
    const failedOnVersion = StorageService.getItemSync(MIGRATION_FAILED_APP_VERSION_KEY);
    if (failedOnVersion === getAppVersion()) {
      return;
    }
    clearMigrationFailure();
  }

  const currentVersion = StorageService.getNumber(MIGRATION_VERSION_KEY) ?? 0;

  const pending = DATA_MIGRATIONS.filter(m => m.version > currentVersion).sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    StorageService.setNumber(MIGRATION_RETRY_KEY, 0);
    return;
  }

  for (const migration of pending) {
    try {
      await migration.up();
      StorageService.setNumber(MIGRATION_VERSION_KEY, migration.version);
      StorageService.setNumber(MIGRATION_RETRY_KEY, 0);
    } catch (error) {
      if (getDatabaseError()) {
        // The database itself failed to open; that is not this migration's
        // fault and must not burn one of its retries (App shows the fallback).
        break;
      }
      const retryCount = (StorageService.getNumber(MIGRATION_RETRY_KEY) ?? 0) + 1;
      StorageService.setNumber(MIGRATION_RETRY_KEY, retryCount);

      const err = error instanceof Error ? error : new Error(String(error));
      appendErrorLog(err, false);

      if (__DEV__) {
        console.error(
          `Data migration ${migration.version} (${migration.name}) failed (attempt ${retryCount}/${MAX_RETRIES}):`,
          error,
        );
      }

      if (retryCount >= MAX_RETRIES) {
        StorageService.setBoolean(MIGRATION_FAILED_KEY, true);
        StorageService.setItemSync(MIGRATION_FAILED_APP_VERSION_KEY, getAppVersion());
        appendErrorLog(
          new Error(`Migration ${migration.version} permanently failed after ${MAX_RETRIES} attempts`),
          true,
        );
      }
      break;
    }
  }
};
