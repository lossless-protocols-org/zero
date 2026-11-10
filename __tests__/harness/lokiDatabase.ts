import {Database} from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import logger from '@nozbe/watermelondb/utils/common/logger';
import {schema} from '../../src/data/database/schema';
import {migrations} from '../../src/data/database/migrations';
import {MODEL_CLASSES} from '../../src/data/database/models/modelClasses';

/**
 * A stand-in for `src/data/database/database` backed by an in-memory LokiJS
 * WatermelonDB, for jest (M22, v2.7.1):
 *
 *   jest.mock('../src/data/database/database', () =>
 *     require('../src/testing/lokiDatabase').lokiDatabaseModule('myTest'));
 *
 * The real schema, migrations and models: services run their real queries.
 * LokiJS cannot run `unsafeSqlQuery` (those tests are `*.bun.test.ts`).
 */
// Without these, loki keeps an autosave timer alive and jest never exits —
// which would hang CI rather than fail it. A named constant: WatermelonDB's
// type for extraLokiOptions lists only the autosave keys, though LokiJS takes
// `persistenceMethod` as well.
const LOKI_OPTIONS = {autosave: false, persistenceMethod: 'memory'};

export const lokiDatabaseModule = (dbName = 'zeroTest') => {
  // The adapter logs every setup step and a deprecation note per suite; a
  // test's output should be its own. Failures still throw.
  logger.silence();
  const db = new Database({
    adapter: new LokiJSAdapter({
      schema,
      migrations,
      useWebWorker: false,
      // Required by the adapter; false keeps the plain in-memory store.
      useIncrementalIndexedDB: false,
      dbName,
      extraLokiOptions: LOKI_OPTIONS,
    }),
    modelClasses: MODEL_CLASSES,
  });
  return {database: db, getDatabaseError: (): Error | null => null};
};
