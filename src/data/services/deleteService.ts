import type {Model} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {MODEL_CLASSES} from '../database/models/modelClasses';

export interface RecordCounts {
  users: number;
  expenses: number;
  categories: number;
  debts: number;
  debtors: number;
  budgets: number;
  currencies: number;
  accounts: number;
  refunds: number;
  incomes: number;
  total: number;
}

/** Every table, from the registered models, so a new table cannot be forgotten by the wipe. */
const TABLES = MODEL_CLASSES.map(model => model.table);

const countOf = (table: string): Promise<number> => database.get(table).query().fetchCount();

/**
 * How much is on the device. The Welcome screen's "Get Started" used to wipe
 * everything unconditionally on the assumption that a device showing
 * onboarding is empty; a lost onboarding flag makes that assumption false.
 */
export const countAllRecords = async (): Promise<RecordCounts> => {
  const [users, expenses, categories, debts, debtors, budgets, currencies, accounts, refunds, incomes] =
    await Promise.all([
      countOf('users'),
      countOf('expenses'),
      countOf('categories'),
      countOf('debts'),
      countOf('debtors'),
      countOf('budgets'),
      countOf('currencies'),
      countOf('accounts'),
      countOf('refunds'),
      countOf('incomes'),
    ]);
  const total = users + expenses + categories + debts + debtors + budgets + currencies + accounts + refunds + incomes;
  return {users, expenses, categories, debts, debtors, budgets, currencies, accounts, refunds, incomes, total};
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
