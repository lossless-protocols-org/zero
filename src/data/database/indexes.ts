/**
 * Indexes WatermelonDB's `isIndexed` cannot express, shared by the schema
 * (fresh installs, via the table's `unsafeSql`) and the migrations
 * (upgrades), so both end with the same database. `if not exists` makes a
 * retried migration harmless.
 */

/**
 * Month and day queries are `user_id = ? AND date >= ? AND date < ?`. Without
 * statistics (WatermelonDB never runs ANALYZE) SQLite prefers the equality
 * index on user_id, which on a single-user device matches every row; the
 * composite index turns them into a range (Moto g84, 10k rows: 15–59 ms per
 * month before, see __tests__/sqlite/expenseDateRange.bun.test.ts).
 */
export const EXPENSES_USER_DATE_INDEX_SQL =
  'create index if not exists "expenses_user_id_date" on "expenses" ("user_id", "date");';

/** What the v2 migration meant to add: devices that came from v1 never got these. */
export const STATUS_INDEXES_SQL =
  'create index if not exists "categories_category_status" on "categories" ("category_status");' +
  'create index if not exists "debtors_debtor_status" on "debtors" ("debtor_status");';

/**
 * Schema v5 (2.8): the same month/day range for the two new flow tables, and
 * the by-category scan the Money tab groups income with (3.0 uses it).
 */
export const REFUNDS_USER_DATE_INDEX_SQL =
  'create index if not exists "refunds_user_id_date" on "refunds" ("user_id", "date");';
export const INCOMES_USER_DATE_INDEX_SQL =
  'create index if not exists "incomes_user_id_date" on "incomes" ("user_id", "date");' +
  'create index if not exists "incomes_user_id_category_id_date" on "incomes" ("user_id", "category_id", "date");';

/**
 * 2.8 "categorise from history": the newest expense with a title, by the
 * title's key (SQLite's lower(trim(title)), the exact expression the query
 * uses) then date, so the lookup is one index probe that already returns the
 * newest first. Without it a title with no history scanned every row: Moto
 * g84, 10k rows, 18.5 ms avg / 27.6 ms max (gate 16 ms); with it ~0 ms
 * (references/play-vitals/perf/v2.8/phase5-entry-quality-2026-11-07.md).
 */
export const EXPENSES_TITLE_KEY_INDEX_SQL =
  'create index if not exists "expenses_title_key_date" on "expenses" (lower(trim("title")), "date");';

/**
 * Schema v6 (3.0): an account's balance reads every flow and transfer of that
 * account up to a day (ZERO_SYSTEM_DESIGN.md §2.1, §7: `(user_id, account_id,
 * date)` on each). Without these, each balance would scan the user's whole
 * history once per account. The two new tables carry their own (v6Tables.ts).
 */
export const EXPENSES_ACCOUNT_DATE_INDEX_SQL =
  'create index if not exists "expenses_user_id_account_id_date" on "expenses" ("user_id", "account_id", "date");';
export const INCOMES_ACCOUNT_DATE_INDEX_SQL =
  'create index if not exists "incomes_user_id_account_id_date" on "incomes" ("user_id", "account_id", "date");';
export const REFUNDS_ACCOUNT_DATE_INDEX_SQL =
  'create index if not exists "refunds_user_id_account_id_date" on "refunds" ("user_id", "account_id", "date");';
export const TRANSFERS_ACCOUNT_DATE_INDEXES_SQL =
  'create index if not exists "transfers_user_id_from_account_id_date" on "transfers" ("user_id", "from_account_id", "date");' +
  'create index if not exists "transfers_user_id_to_account_id_date" on "transfers" ("user_id", "to_account_id", "date");';
export const CHECKPOINTS_ACCOUNT_DATE_INDEX_SQL =
  'create index if not exists "checkpoints_user_id_account_id_date" on "checkpoints" ("user_id", "account_id", "date");';

/**
 * Schema v6, plan P9: the materialiser reads each user's rules due by today
 * (`next_run <= today`) on every open; a rule that ended has next_run null.
 */
export const RECURRING_RULES_NEXT_RUN_INDEX_SQL =
  'create index if not exists "recurring_rules_user_id_next_run" on "recurring_rules" ("user_id", "next_run");';
