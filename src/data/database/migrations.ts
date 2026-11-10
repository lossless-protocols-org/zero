import {schemaMigrations, createTable, addColumns, unsafeExecuteSql} from '@nozbe/watermelondb/Schema/migrations';
import {EXPENSES_TITLE_KEY_INDEX_SQL, EXPENSES_USER_DATE_INDEX_SQL, STATUS_INDEXES_SQL} from './indexes';
import {TIMESTAMP_COLUMNS, V5_TABLES} from './v5Tables';
import {V5_BACKFILL_SQL} from './v5Backfill';

export const migrations = schemaMigrations({
  migrations: [
    {
      // 2.8: the last migration that rewrites rows (ZERO_SYSTEM_DESIGN.md §10).
      // New tables, new columns, then ONE idempotent SQL string that creates
      // each user's default account and backfills every row. addColumns
      // writes '' / 0 / null into new columns (never NULL for required ones),
      // so the backfill matches those values; a retried migration is a no-op.
      toVersion: 5,
      steps: [
        ...V5_TABLES.map(table => createTable(table)),
        addColumns({
          table: 'expenses',
          columns: [{name: 'account_id', type: 'string', isIndexed: true}, ...TIMESTAMP_COLUMNS],
        }),
        addColumns({
          table: 'categories',
          columns: [
            {name: 'kind', type: 'string', isIndexed: true},
            {name: 'sort_order', type: 'number'},
            ...TIMESTAMP_COLUMNS,
          ],
        }),
        ...['users', 'currencies', 'debtors', 'debts', 'budgets'].map(table =>
          addColumns({table, columns: TIMESTAMP_COLUMNS}),
        ),
        unsafeExecuteSql(V5_BACKFILL_SQL),
        // An index only (2.8 categorise from history): no row changes.
        unsafeExecuteSql(EXPENSES_TITLE_KEY_INDEX_SQL),
      ],
    },
    {
      // 2.7.1: indexes only, no data or column change (backups stay envelope v4).
      // The composite index makes month/day queries an index range; the two
      // status indexes are the ones the no-op v2 step below left out.
      toVersion: 4,
      steps: [unsafeExecuteSql(EXPENSES_USER_DATE_INDEX_SQL + STATUS_INDEXES_SQL)],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'budgets',
          columns: [
            {name: 'user_id', type: 'string', isIndexed: true},
            {name: 'category_id', type: 'string', isOptional: true, isIndexed: true},
            {name: 'amount', type: 'number'},
            {name: 'month', type: 'string', isIndexed: true},
            {name: 'budget_type', type: 'string'},
          ],
        }),
      ],
    },
    {
      // Intended to index category_status / debtor_status.
      toVersion: 2,
      steps: [
        // NO-OP, and knowingly so. WatermelonDB does NOT recreate indexes for
        // existing tables on a version bump — `isIndexed` in schema.ts only
        // takes effect when a table is created, i.e. on fresh installs.
        // Devices upgraded from v1 therefore lack these two indexes. The
        // tables are small enough that it does not matter in practice; if it
        // ever does, add an explicit `unsafeExecuteSql('CREATE INDEX IF NOT
        // EXISTS ...')` step to the NEXT migration rather than editing this
        // one (already-applied migrations never re-run).
      ],
    },
  ],
});
