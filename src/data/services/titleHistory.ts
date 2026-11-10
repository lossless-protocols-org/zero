/**
 * "Categorise from history" (2.8): the title key and the one query, kept apart
 * from expenseService so a bun:sqlite test can run the exact SQL against the
 * real schema (__tests__/sqlite/titleHistory.bun.test.ts).
 *
 * A title is compared by its key (domain/titleKey: SQLite's
 * `lower(trim(title))`, computed in JS). The `expenses_title_key_date` index
 * (indexes.ts) answers the query alone; `+user_id` keeps the planner
 * (WatermelonDB never runs ANALYZE) off the user_id indexes, which would scan
 * every row for a title never typed before.
 */

/** Parameters: [titleKey(title), userId]. Returns at most one `category_id`. */
export const TITLE_HISTORY_SQL =
  "select category_id from expenses where lower(trim(title)) = ? and +user_id = ? and _status is not 'deleted' order by date desc limit 1";
