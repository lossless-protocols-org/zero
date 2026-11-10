import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import {schema} from './schema';
import {migrations} from './migrations';
import {MODEL_CLASSES} from './models/modelClasses';

let databaseError: Error | null = null;

const recordError = (error: unknown): Error => {
  databaseError ??= error instanceof Error ? error : new Error(String(error));
  return databaseError;
};

/**
 * The database setup error, if any: a constructor that threw, or the
 * adapter's `onSetUpError` (fired when the file is first touched).
 * data/startup.ts probes the database and returns this, so App shows
 * DatabaseErrorFallback before any screen reads.
 */
export const getDatabaseError = (): Error | null => databaseError;

/**
 * What `database` is when the constructor itself threw: every use rethrows
 * that error, named, at the call that tried. Never the normal path.
 */
const unavailable = (error: Error): Database =>
  // The target is never read: every property access throws the setup error.
  new Proxy({} as Database, {
    get() {
      throw error;
    },
  });

const create = (): Database => {
  try {
    return new Database({
      adapter: new SQLiteAdapter({
        schema,
        migrations,
        jsi: true,
        onSetUpError: error => {
          recordError(error);
          if (__DEV__) {
            console.error('WatermelonDB setup error:', error);
          }
        },
      }),
      modelClasses: MODEL_CLASSES,
    });
  } catch (error) {
    return unavailable(recordError(error));
  }
};

/**
 * The one database, built when this module is first imported (by the
 * services, before the first screen renders). A plain Database: it used to
 * be a Proxy that built itself on first property access, which put a trap on
 * every service call and turned a setup failure into a throw from a property
 * getter deep inside whatever read first (audit 2026-11-08 §5). Building it
 * up front costs nothing extra (startup touched it first anyway), and a
 * failure is caught here and reported by startup.
 */
export const database: Database = create();
