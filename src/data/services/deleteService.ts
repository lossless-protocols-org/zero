import {Q, type Model} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {MODEL_CLASSES} from '../database/models/modelClasses';

/** Every table, from the registered models, so a new table cannot be forgotten by the wipe or the count. */
const TABLES = MODEL_CLASSES.map(model => model.table);

/**
 * Tables whose rows a new user gets without entering anything: the user row, the seeded
 * categories, the currency and the default account. Every other table holds what the user put in.
 */
const SEEDED_TABLES: ReadonlySet<string> = new Set(['users', 'categories', 'currencies', 'accounts']);

export interface RecordCounts {
  /** Rows per table, for every table the database has. */
  byTable: Record<string, number>;
  /**
   * Rows the user entered: every table but the seeded ones, plus any account beyond the
   * default and any income category beyond the one each user is given (more come only from Pro
   * or a Pro backup). A table added later counts here by default, so its rows are never wiped
   * unasked.
   */
  entered: number;
  total: number;
}

const countOf = (table: string): Promise<number> => database.get(table).query().fetchCount();

/**
 * How much is on the device. The Welcome screen's "Get Started" used to wipe
 * everything unconditionally on the assumption that a device showing
 * onboarding is empty; a lost onboarding flag makes that assumption false.
 */
export const countAllRecords = async (): Promise<RecordCounts> => {
  const [counts, ownAccounts, incomeCategories] = await Promise.all([
    Promise.all(TABLES.map(countOf)),
    database.get('accounts').query(Q.where('is_default', false)).fetchCount(),
    database.get('categories').query(Q.where('kind', 'income')).fetchCount(),
  ]);
  const byTable = Object.fromEntries(TABLES.map((table, i) => [table, counts[i] ?? 0]));
  const extraIncomeCategories = Math.max(0, incomeCategories - (byTable['users'] ?? 0));
  const entered =
    TABLES.filter(table => !SEEDED_TABLES.has(table)).reduce((sum, table) => sum + (byTable[table] ?? 0), 0) +
    ownAccounts +
    extraIncomeCategories;
  const total = Object.values(byTable).reduce((sum, n) => sum + n, 0);
  return {byTable, entered, total};
};

/**
 * Deletes all data from all collections
 */
export const deleteAllData = async (): Promise<void> => {
  try {
    await database.write(async () => {
      const records: Model[] = (await Promise.all(TABLES.map(table => database.get(table).query().fetch()))).flat();
      await database.batch(records.map(record => record.prepareDestroyPermanently()));
    });
  } catch (error) {
    if (__DEV__) {
      console.error('Error deleting all data:', error);
    }
    throw error;
  }
};
