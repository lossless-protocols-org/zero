import {shiftIsoDay} from '../../domain/dates';

/**
 * One account's net money in, summed by SQLite (plan P8 exit gate: a balance
 * in 20 ms on the Moto). Reading every row of an account never reconciled
 * (the default Cash on the 10k seed: about 5,500 expenses) into JS took
 * 174 ms there; SQLite adds the same units and returns one number per day
 * asked. Kept free of the database import, so the bun:sqlite suite runs this
 * exact SQL against the seed and the replay (positionSums.bun.test.ts).
 *
 * The rules are netWorthService's, in SQL:
 * - money is added in units of 10⁻⁴ (`round(amount * 10000)`, as
 *   domain/money.toMoneyUnits; amounts are stored positive, so SQLite's
 *   half-away-from-zero and Math.round's half-up agree), and `total` of
 *   integer-valued doubles is exact up to 2⁵³;
 * - in: refunds, incomes, transfers to the account, borrowings through it;
 *   out: expenses, transfers from it, lendings through it (domain/debtType:
 *   a type that starts with "borrow", any case, is a borrowing; stored types
 *   are already 'Borrow' or 'Lend');
 * - a row counts on the day its date string starts with, as every range
 *   query in the app does;
 * - `_status is not 'deleted'` on every table (WatermelonDB adds it to its
 *   own queries, never to raw SQL).
 *
 * Column `s<i>` is the sum over rows dated after `after` and on or before `days[i]`.
 */

const UNITS = 'round(amount * 10000)';

const part = (table: string, accountColumn: string, units: string): string =>
  `select date, ${units} as units from ${table}` +
  ` where user_id is ? and ${accountColumn} is ? and date >= ? and date < ? and _status is not 'deleted'`;

const PARTS = [
  part('expenses', 'account_id', `-${UNITS}`),
  part('refunds', 'account_id', UNITS),
  part('incomes', 'account_id', UNITS),
  part('transfers', 'from_account_id', `-${UNITS}`),
  part('transfers', 'to_account_id', UNITS),
  part('debts', 'account_id', `case when lower(trim(type)) like 'borrow%' then ${UNITS} else -${UNITS} end`),
];

/** The statement for `count` days asked (one column each). */
export const positionSumsSql = (count: number): string => {
  const columns = Array.from({length: count}, (_, i) => `total(case when date < ? then units end) as s${i}`);
  return `select ${columns.join(', ')} from (${PARTS.join(' union all ')})`;
};

/**
 * Its arguments: each column's bound (the day after the day asked, since a
 * date with a time sorts after its bare day), then each part's user, account
 * and range. `after` null: from the beginning ('' sorts before every date).
 */
export const positionSumsArgs = (
  userId: string,
  accountId: string,
  after: string | null,
  days: readonly string[],
): string[] => {
  const ends = days.map(day => shiftIsoDay(day, 1));
  const from = after === null ? '' : shiftIsoDay(after, 1);
  const to = ends.reduce((latest, end) => (end > latest ? end : latest), from);
  return [...ends, ...PARTS.flatMap(() => [userId, accountId, from, to])];
};

/** The row SQLite returns: `s0`, `s1`, … as numbers. */
export type PositionSumsRow = Record<string, number | null>;
