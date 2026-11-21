import type {Period} from '../../domain/period';

/**
 * Several months' flows, summed by SQLite in one statement (3.0, plan P12
 * gate: twelve months of the 10k seed in 50 ms on the low-end phone). Reading
 * a year of rows into JS to add them up costs several times that there
 * (positionSumsQuery.ts has the same lesson for balances). Kept free of the
 * database import, so the bun:sqlite suite runs this exact SQL against the
 * seed and a plain JS sum (trendSums.bun.test.ts).
 *
 * The rules are periodSummaryService's and domain/periodMath's, in SQL:
 * - money is added in units of 10⁻⁴ (`round(amount * 10000)`), exactly;
 * - a row counts in the month whose days hold its date string, as every
 *   range query in the app does: with the months in order and touching, a
 *   row's month is the number of later months' first days it is not before;
 * - a refund lowers the month it is DATED in, under its expense's category (R2);
 * - `_status is not 'deleted'` on every table (WatermelonDB adds it to its
 *   own queries, never to raw SQL).
 *
 * One row per (month, kind, category): kind 'e' expenses, 'r' refunds, 'i' incomes.
 */
export interface TrendSumsRow {
  bucket: number;
  kind: 'e' | 'r' | 'i';
  category_id: string | null;
  units: number;
  n: number;
}

const UNITS = 'round(amount * 10000)';

/** The periods must be in order and touch: each starts where the one before ends. */
export const assertContiguous = (periods: readonly Period[]): void => {
  periods.forEach((period, index) => {
    const before = periods[index - 1];
    if (period.next <= period.start || (before && before.next !== period.start)) {
      throw new Error('Trend periods must be in order and touch, each starting where the one before ends');
    }
  });
};

/** The statement for `count` months (count ≥ 1). */
export const trendSumsSql = (count: number): string => {
  // 0 for the first month; one more for each later month the date is not before.
  const bucket = count <= 1 ? '0' : `(${Array.from({length: count - 1}, () => '(date >= ?)').join(' + ')})`;
  const part = (table: string, kind: string, category: string): string =>
    `select ${bucket} as bucket, '${kind}' as kind, ${category} as category_id, ${UNITS} as units from ${table}` +
    ` where user_id is ? and date >= ? and date < ? and _status is not 'deleted'`;
  return (
    'select bucket, kind, category_id, total(units) as units, count(*) as n from (' +
    [
      part('expenses', 'e', 'category_id'),
      part(
        'refunds',
        'r',
        "(select category_id from expenses where expenses.id = refunds.expense_id and expenses._status is not 'deleted')",
      ),
      part('incomes', 'i', 'category_id'),
    ].join(' union all ') +
    ') group by bucket, kind, category_id'
  );
};

/** Its arguments: for each of the three parts, the later months' first days, then the user and the whole range. */
export const trendSumsArgs = (userId: string, periods: readonly Period[]): string[] => {
  assertContiguous(periods);
  const first = periods[0];
  const last = periods.at(-1);
  if (!first || !last) {
    return [];
  }
  const part = [...periods.slice(1).map(period => period.start), userId, first.start, last.next];
  return [...part, ...part, ...part];
};
