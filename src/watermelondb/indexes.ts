/**
 * Indexes WatermelonDB's `isIndexed` cannot express, shared by the schema
 * (fresh installs, via the table's `unsafeSql`) and the v4 migration
 * (upgrades), so both end with the same database. `if not exists` makes a
 * retried migration harmless.
 */

/**
 * Month and day queries are `user_id = ? AND date >= ? AND date < ?`. Without
 * statistics (WatermelonDB never runs ANALYZE) SQLite prefers the equality
 * index on user_id, which on a single-user device matches every row; the
 * composite index turns them into a range (Moto g84, 10k rows: 15–59 ms per
 * month before, see expenseDateRange.bun.test.ts).
 */
export const EXPENSES_USER_DATE_INDEX_SQL =
  'create index if not exists "expenses_user_id_date" on "expenses" ("user_id", "date");';

/** What the v2 migration meant to add: devices that came from v1 never got these. */
export const STATUS_INDEXES_SQL =
  'create index if not exists "categories_category_status" on "categories" ("category_status");' +
  'create index if not exists "debtors_debtor_status" on "debtors" ("debtor_status");';
