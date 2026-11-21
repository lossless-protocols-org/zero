import {appSchema, tableSchema} from '@nozbe/watermelondb';
import {
  EXPENSES_ACCOUNT_DATE_INDEX_SQL,
  EXPENSES_TITLE_KEY_INDEX_SQL,
  EXPENSES_USER_DATE_INDEX_SQL,
  INCOMES_ACCOUNT_DATE_INDEX_SQL,
  REFUNDS_ACCOUNT_DATE_INDEX_SQL,
} from './indexes';
import {TIMESTAMP_COLUMNS, V5_TABLES, type TableDefinition} from './v5Tables';
import {
  ACCOUNT_KIND_COLUMN,
  DEBTS_ACCOUNT_COLUMN,
  MONTH_START_DAY_COLUMN,
  RECURRING_ID_COLUMN,
  V6_TABLES,
} from './v6Tables';

/**
 * What v6 adds to a v5 table for fresh installs, after the table's own v5 SQL, so a fresh
 * database ends exactly as an upgraded one (migrations.ts runs the same statements).
 */
const V6_INDEXES_ON_V5_TABLES: Record<string, string> = {
  refunds: REFUNDS_ACCOUNT_DATE_INDEX_SQL,
  incomes: INCOMES_ACCOUNT_DATE_INDEX_SQL,
};

/** v6 columns on v5 tables, appended last, as the migration's addColumns appends them. */
const V6_COLUMNS_ON_V5_TABLES: Record<string, ReadonlyArray<TableDefinition['columns'][number]>> = {
  incomes: [RECURRING_ID_COLUMN],
  accounts: [ACCOUNT_KIND_COLUMN],
};

const withV6Indexes = (table: TableDefinition): TableDefinition => {
  const extra = V6_INDEXES_ON_V5_TABLES[table.name] ?? '';
  const own = table.unsafeSql;
  const columns = [...table.columns, ...(V6_COLUMNS_ON_V5_TABLES[table.name] ?? [])];
  return own && extra ? {...table, columns, unsafeSql: sql => own(sql) + extra} : {...table, columns};
};

/**
 * Two books on one database (references/blueprint/ZERO_SYSTEM_DESIGN.md):
 * flows (expenses, refunds, incomes) feed spent / received / kept; positions
 * (accounts, debts) feed net worth from 3.0. One table per fact: a row's
 * table says what it is, so no query can count the wrong kind of money.
 */
export const schema = appSchema({
  version: 6,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        {name: 'username', type: 'string'},
        {name: 'email', type: 'string'},
        ...TIMESTAMP_COLUMNS,
        // v6 (P11), last, as the migration's addColumns appends it.
        MONTH_START_DAY_COLUMN,
      ],
    }),
    tableSchema({
      name: 'categories',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'category_status', type: 'boolean', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'icon', type: 'string', isOptional: true},
        {name: 'color', type: 'string'},
        // v5: 'expense' | 'income'; lists order by sort_order.
        {name: 'kind', type: 'string', isIndexed: true},
        {name: 'sort_order', type: 'number'},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    tableSchema({
      name: 'expenses',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'amount', type: 'number'},
        {name: 'description', type: 'string', isOptional: true},
        {name: 'category_id', type: 'string', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'date', type: 'string', isIndexed: true},
        // v5: every expense is paid from an account (the hidden default in 2.8).
        {name: 'account_id', type: 'string', isIndexed: true},
        ...TIMESTAMP_COLUMNS,
        // v6 (P9), last: an upgraded table gets it appended (addColumns), so a fresh one must match.
        RECURRING_ID_COLUMN,
      ],
      // v4: the composite index the month/day range queries need (see indexes.ts); v6: by account.
      unsafeSql: sql =>
        sql + EXPENSES_USER_DATE_INDEX_SQL + EXPENSES_TITLE_KEY_INDEX_SQL + EXPENSES_ACCOUNT_DATE_INDEX_SQL,
    }),
    tableSchema({
      name: 'currencies',
      columns: [
        {name: 'code', type: 'string'},
        {name: 'symbol', type: 'string'},
        {name: 'name', type: 'string'},
        {name: 'user_id', type: 'string', isIndexed: true},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    tableSchema({
      name: 'debtors',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'type', type: 'string'},
        {name: 'debtor_status', type: 'boolean', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'icon', type: 'string', isOptional: true},
        {name: 'color', type: 'string'},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    tableSchema({
      name: 'debts',
      columns: [
        {name: 'description', type: 'string'},
        {name: 'amount', type: 'number'},
        {name: 'debtor_id', type: 'string', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'date', type: 'string', isIndexed: true},
        {name: 'type', type: 'string'},
        ...TIMESTAMP_COLUMNS,
        // v6, last: an upgraded table gets it appended (addColumns), so a fresh one must match.
        DEBTS_ACCOUNT_COLUMN,
      ],
    }),
    tableSchema({
      name: 'budgets',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'category_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'amount', type: 'number'},
        {name: 'month', type: 'string', isIndexed: true},
        {name: 'budget_type', type: 'string'},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    // v5 tables, defined once and shared with the migration (v5Tables.ts); v6 indexes them by account.
    ...V5_TABLES.map(table => tableSchema(withV6Indexes(table))),
    // v6 tables (3.0), likewise shared (v6Tables.ts).
    ...V6_TABLES.map(table => tableSchema(table)),
  ],
});
