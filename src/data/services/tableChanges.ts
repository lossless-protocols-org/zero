import {database} from '../database/database';

/** The tables a screen can show; `users` changes only with a restore or a wipe. 3.0 adds the positions. */
export type WatchedTable =
  | 'expenses'
  | 'refunds'
  | 'incomes'
  | 'categories'
  | 'budgets'
  | 'currencies'
  | 'debts'
  | 'debtors'
  | 'users'
  | 'accounts'
  | 'transfers'
  | 'checkpoints'
  | 'recurring_rules';

/**
 * Emits once at once, then after every write batch to any of `tables`
 * (WatermelonDB sends one change event per batch). Unsubscribe to stop.
 */
export const observeTables = (tables: readonly WatchedTable[]) => database.withChangesForTables([...tables]);
