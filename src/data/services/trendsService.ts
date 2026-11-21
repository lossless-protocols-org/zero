import {Q} from '@nozbe/watermelondb';
import {database, runsSql} from '../database/database';
import {fromMoneyUnits, toMoneyUnits} from '../../domain/money';
import type {Period} from '../../domain/period';
import type {TrendPoint} from '../../domain/trends';
import {assertContiguous, trendSumsArgs, trendSumsSql, type TrendSumsRow} from './trendSumsQuery';

/**
 * Trends (3.0, plan P12; Pro key `trends`): spent, refunded, received, kept
 * and per-category spending for several months in one read. Tier-blind like
 * every service: the screen that shows it is Pro's. The months are worked
 * out above the data layer (domain/trends.trendMonths with the month start
 * day that applies); here they are only ranges that touch.
 *
 * On the device one SQL statement groups the rows (trendSumsQuery.ts); jest's
 * LokiJS cannot run SQL, so it reads the rows and groups them here by the
 * same rules. `__tests__/sqlite/trendSums.bun.test.ts` keeps the two equal.
 */

interface RawRow {
  amount: number;
  date: string;
  category_id?: string;
  expense_id?: string;
}

const rowsOf = (table: string, userId: string, from: string, to: string): Promise<RawRow[]> =>
  // unsafeFetchRaw is typed any[]; every flow table has `amount` and `date` (schema.ts, v5Tables.ts).
  database
    .get(table)
    .query(Q.where('user_id', userId), Q.where('date', Q.gte(from)), Q.where('date', Q.lt(to)))
    .unsafeFetchRaw();

/** The reference: every row read and grouped in JS. */
const groupInJs = async (userId: string, periods: readonly Period[]): Promise<TrendSumsRow[]> => {
  const from = periods[0]?.start ?? '';
  const to = periods.at(-1)?.next ?? '';
  const [expenses, refunds, incomes] = await Promise.all([
    rowsOf('expenses', userId, from, to),
    rowsOf('refunds', userId, from, to),
    rowsOf('incomes', userId, from, to),
  ]);
  // A refund's category is its expense's, whenever that expense was dated.
  const parentIds = [...new Set(refunds.map(refund => refund.expense_id ?? ''))];
  const parents: Array<{id: string; category_id: string}> =
    parentIds.length === 0
      ? []
      : await database
          .get('expenses')
          .query(Q.where('id', Q.oneOf(parentIds)))
          .unsafeFetchRaw();
  const categoryOfExpense = new Map(parents.map(parent => [parent.id, parent.category_id]));
  const starts = periods.slice(1).map(period => period.start);
  const bucketOf = (date: string): number => starts.reduce((bucket, start) => bucket + (date >= start ? 1 : 0), 0);

  const groups = new Map<string, TrendSumsRow>();
  const add = (kind: TrendSumsRow['kind'], row: RawRow, categoryId: string | null): void => {
    const bucket = bucketOf(row.date);
    const key = `${bucket}|${kind}|${categoryId ?? ''}`;
    const group = groups.get(key) ?? {bucket, kind, category_id: categoryId, units: 0, n: 0};
    group.units += toMoneyUnits(row.amount);
    group.n += 1;
    groups.set(key, group);
  };
  expenses.forEach(row => add('e', row, row.category_id ?? null));
  refunds.forEach(row => add('r', row, categoryOfExpense.get(row.expense_id ?? '') ?? null));
  incomes.forEach(row => add('i', row, row.category_id ?? null));
  return [...groups.values()];
};

const groupInSql = async (userId: string, periods: readonly Period[]): Promise<TrendSumsRow[]> =>
  (await database
    .get('expenses')
    .query(Q.unsafeSqlQuery(trendSumsSql(periods.length), trendSumsArgs(userId, periods)))
    .unsafeFetchRaw()) as TrendSumsRow[]; // the statement selects exactly these five columns

/**
 * The figures of each of `periods` (in order, touching), one point per
 * period with the key the caller gave it. A period with no rows is all zeros.
 */
export const getTrends = async (
  userId: string,
  months: ReadonlyArray<{key: string; period: Period}>,
): Promise<TrendPoint[]> => {
  const periods = months.map(month => month.period);
  assertContiguous(periods);
  if (periods.length === 0) {
    return [];
  }
  const rows = await (runsSql ? groupInSql(userId, periods) : groupInJs(userId, periods));
  return months.map(({key, period}, bucket) => {
    const mine = rows.filter(row => row.bucket === bucket);
    const unitsOf = (kind: TrendSumsRow['kind']): number =>
      mine.filter(row => row.kind === kind).reduce((sum, row) => sum + Math.round(row.units), 0);
    const expenseUnits = unitsOf('e');
    const refundUnits = unitsOf('r');
    const receivedUnits = unitsOf('i');
    const byCategory = new Map<string, number>();
    for (const row of mine) {
      if (row.kind === 'i') {
        continue;
      }
      // A refund whose expense is gone has no category: it still lowers the month's total, under none.
      const categoryId = row.category_id ?? '';
      byCategory.set(
        categoryId,
        (byCategory.get(categoryId) ?? 0) + (row.kind === 'e' ? 1 : -1) * Math.round(row.units),
      );
    }
    return {
      key,
      period,
      spent: fromMoneyUnits(expenseUnits - refundUnits),
      refunded: fromMoneyUnits(refundUnits),
      received: fromMoneyUnits(receivedUnits),
      kept: fromMoneyUnits(receivedUnits - (expenseUnits - refundUnits)),
      count: mine.filter(row => row.kind === 'e').reduce((sum, row) => sum + row.n, 0),
      byCategory: Object.fromEntries([...byCategory].map(([id, units]) => [id, fromMoneyUnits(units)])),
    };
  });
};
