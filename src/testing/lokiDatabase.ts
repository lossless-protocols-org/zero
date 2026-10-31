import {Database} from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import {schema} from '../watermelondb/schema';
import {migrations} from '../watermelondb/migrations';
import * as models from '../watermelondb/models';

/**
 * A stand-in for `src/watermelondb/database` backed by an in-memory LokiJS
 * WatermelonDB, for jest (M22, v2.7.1):
 *
 *   jest.mock('../src/watermelondb/database', () =>
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

export const lokiDatabaseModule = (dbName: string) => {
  const db = new Database({
    adapter: new LokiJSAdapter({
      schema,
      migrations,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      dbName,
      extraLokiOptions: LOKI_OPTIONS,
    }),
    modelClasses: [
      models.User,
      models.Category,
      models.Expense,
      models.Currency,
      models.Debtor,
      models.Debt,
      models.Budget,
    ],
  });
  return {database: db, getDatabase: () => db, getDatabaseError: (): Error | null => null, default: db};
};
