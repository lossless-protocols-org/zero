import {runMigrations} from './dataMigrations/runner';
import {database, getDatabaseError} from './database/database';
import {recordFirstSeenVersion} from '../platform/firstSeenVersion';
import {createMmkvPreference, wholeNumber} from '../platform/mmkvPreference';
import {isOnboardedPreference} from '../platform/onboarding';
import {schema} from './database/schema';

export {hasMigrationFailed, retryMigrations} from './dataMigrations/runner';

/**
 * Initialize the backend layer.
 * Called once on app startup before any screens render.
 *
 * Responsibilities:
 * - Record the pre-3.0 flag (`firstSeenAppVersion`, written once)
 * - Run pending data migrations (sequential, versioned, idempotent; the
 *   runner records its own failures and never throws)
 * - Open the database once so a failure is observed before any screen
 *   mounts (M3, v2.7.1): the adapter's `onSetUpError` only fires when the
 *   database is first touched, and with no migration pending nothing touched
 *   it — so on every upgraded install `App` saw no error and rendered Home
 *   over a database that could not open. The probe also catches a file that
 *   opens but fails on its first read (a corrupt page), which `onSetUpError`
 *   never sees.
 *
 * Returns the error that makes the database unusable, or null. `App` logs it
 * (once, as fatal) and shows DatabaseErrorFallback.
 *
 * Once per JS runtime: the app and the quick-add sheet (2.8) are two React
 * roots on one runtime, and may both start it; they share one run, so
 * migrations never run twice at once. A failed start is not kept, so the
 * next root to start tries again.
 */
let started: Promise<Error | null> | null = null;

/** The schema version this install's database last opened at; 0 before 2.8 recorded it. */
const openedSchemaVersion = createMmkvPreference('database_schema_version', wholeNumber, 0);

/**
 * True when this start will migrate a database that holds someone's data.
 * WatermelonDB migrates when the database is first touched, synchronously
 * on the JS thread (JSI), so on a large database the v4 → v5 step keeps
 * the first frame waiting for a second or more, once (audit 2026-11-08
 * §8.4). App shows an "Updating" screen first instead of a blank one. A new
 * install has nothing to migrate, and its onboarding flag is not set yet.
 */
export const isSchemaUpgradePending = (): boolean =>
  isOnboardedPreference.get() && openedSchemaVersion.get() < schema.version;

const openBackend = async (): Promise<Error | null> => {
  // Plan §5.6: the pre-3.0 flag, written once on the first launch of 2.8+.
  recordFirstSeenVersion();
  await runMigrations();
  try {
    await database.get('users').query().fetchCount();
  } catch (error) {
    return getDatabaseError() ?? (error instanceof Error ? error : new Error(String(error)));
  }
  const failure = getDatabaseError();
  if (!failure) {
    openedSchemaVersion.set(schema.version);
  }
  return failure;
};

export const initBackend = (): Promise<Error | null> => {
  started ??= openBackend().then(failure => {
    if (failure) {
      started = null;
    }
    return failure;
  });
  return started;
};
