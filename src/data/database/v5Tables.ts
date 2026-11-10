import type {ColumnSchema} from '@nozbe/watermelondb';
import {INCOMES_USER_DATE_INDEX_SQL, REFUNDS_USER_DATE_INDEX_SQL} from './indexes';

/**
 * Epoch milliseconds, maintained by WatermelonDB because every model declares
 * `createdAt` / `updatedAt` (schema v5). Upgraded rows are backfilled by the
 * v5 migration.
 */
export const TIMESTAMP_COLUMNS: ColumnSchema[] = [
  {name: 'created_at', type: 'number'},
  {name: 'updated_at', type: 'number'},
];

interface TableDefinition {
  name: string;
  columns: ColumnSchema[];
  unsafeSql?: (sql: string) => string;
}

/**
 * The three tables schema v5 creates, defined once: schema.ts builds fresh
 * installs from them and migrations.ts creates them on upgraded devices.
 */
export const V5_TABLES: readonly TableDefinition[] = [
  {
    // Where money sits. 2.8 creates exactly one hidden default per user, id `acct_<userId>`.
    name: 'accounts',
    columns: [
      {name: 'user_id', type: 'string', isIndexed: true},
      {name: 'name', type: 'string'},
      {name: 'type', type: 'string'},
      {name: 'currency', type: 'string'},
      {name: 'opening_balance', type: 'number'},
      {name: 'opening_date', type: 'string', isOptional: true},
      {name: 'is_default', type: 'boolean'},
      {name: 'account_status', type: 'boolean', isIndexed: true},
      {name: 'sort_order', type: 'number'},
      {name: 'icon', type: 'string'},
      {name: 'color', type: 'string'},
      ...TIMESTAMP_COLUMNS,
    ],
  },
  {
    // Money that came back for one expense; deleted with it.
    name: 'refunds',
    columns: [
      {name: 'user_id', type: 'string', isIndexed: true},
      {name: 'expense_id', type: 'string', isIndexed: true},
      {name: 'account_id', type: 'string', isIndexed: true},
      {name: 'amount', type: 'number'},
      {name: 'date', type: 'string', isIndexed: true},
      {name: 'note', type: 'string'},
      ...TIMESTAMP_COLUMNS,
    ],
    unsafeSql: sql => sql + REFUNDS_USER_DATE_INDEX_SQL,
  },
  {
    // Money that came in; day precision.
    name: 'incomes',
    columns: [
      {name: 'user_id', type: 'string', isIndexed: true},
      {name: 'category_id', type: 'string', isIndexed: true},
      {name: 'account_id', type: 'string', isIndexed: true},
      {name: 'amount', type: 'number'},
      {name: 'date', type: 'string', isIndexed: true},
      {name: 'note', type: 'string'},
      ...TIMESTAMP_COLUMNS,
    ],
    unsafeSql: sql => sql + INCOMES_USER_DATE_INDEX_SQL,
  },
];
