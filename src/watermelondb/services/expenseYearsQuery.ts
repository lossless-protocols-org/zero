/**
 * The distinct years that have expenses, computed in SQLite (L5, v2.7.1)
 * instead of fetching every row and taking `substring(0, 4)` in JS. Kept
 * free of the database import so the bun:sqlite suite can run the exact SQL.
 *
 * Dates are local ISO strings (`YYYY-MM-DD…`), so the year is the first four
 * characters. `_status is not 'deleted'` is required by every unsafeSqlQuery
 * (WatermelonDB does not add it for raw SQL).
 */
export const EXPENSE_YEARS_SQL =
  "select distinct substr(date, 1, 4) as year from expenses where user_id is ? and _status is not 'deleted'";

export interface ExpenseYearRow {
  year: string | null;
}

/** Sorted ascending; rows whose date does not start with a 4-digit year are skipped. */
export const parseExpenseYears = (rows: readonly ExpenseYearRow[]): number[] => {
  const years = new Set<number>();
  for (const row of rows) {
    if (row.year && /^\d{4}$/.test(row.year)) {
      years.add(Number(row.year));
    }
  }
  return Array.from(years).sort((a, b) => a - b);
};
