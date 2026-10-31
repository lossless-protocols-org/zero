import {runMigrations} from './migrations/runner';
import {database, getDatabaseError} from '../watermelondb/database';

export {hasMigrationFailed, retryMigrations} from './migrations/runner';

/**
 * Initialize the backend layer.
 * Called once on app startup before any screens render.
 *
 * Responsibilities:
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
 */
export const initBackend = async (): Promise<Error | null> => {
  await runMigrations();
  try {
    await database.get('users').query().fetchCount();
  } catch (error) {
    return getDatabaseError() ?? (error instanceof Error ? error : new Error(String(error)));
  }
  return getDatabaseError();
};
