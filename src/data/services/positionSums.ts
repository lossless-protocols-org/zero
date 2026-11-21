import {Q} from '@nozbe/watermelondb';
import type {Clause} from '@nozbe/watermelondb/QueryDescription';
import {database, runsSql} from '../database/database';
import {dayRangeClauses} from './expenseDateRange';
import {positionSumsArgs, positionSumsSql, type PositionSumsRow} from './positionSumsQuery';
import {isBorrowType} from '../../domain/debtType';
import {toMoneyUnits} from '../../domain/money';

interface AmountRow {
  amount: number;
  date: string;
}
interface DebtAmountRow extends AmountRow {
  type: string;
}

const rowsOf = <T>(table: string, ...clauses: Clause[]): Promise<T[]> =>
  // unsafeFetchRaw is typed any[]; each caller names the columns its table has (schema.ts).
  database
    .get(table)
    .query(...clauses)
    .unsafeFetchRaw();

/** The reference: every row read, each one's units added in JS. jest's LokiJS cannot run SQL. */
const sumsInJs = async (
  userId: string,
  accountId: string,
  after: string | null,
  days: readonly string[],
): Promise<number[]> => {
  const last = days.reduce((latest, day) => (day > latest ? day : latest), days[0] ?? '');
  const range = dayRangeClauses(after, last);
  const own = [Q.where('user_id', userId), Q.where('account_id', accountId), ...range];
  const signed = (rows: readonly AmountRow[], sign: 1 | -1) =>
    rows.map(row => ({day: row.date.slice(0, 10), units: sign * toMoneyUnits(row.amount)}));
  const [expenses, refunds, incomes, sent, received, debts] = await Promise.all([
    rowsOf<AmountRow>('expenses', ...own),
    rowsOf<AmountRow>('refunds', ...own),
    rowsOf<AmountRow>('incomes', ...own),
    rowsOf<AmountRow>('transfers', Q.where('user_id', userId), Q.where('from_account_id', accountId), ...range),
    rowsOf<AmountRow>('transfers', Q.where('user_id', userId), Q.where('to_account_id', accountId), ...range),
    rowsOf<DebtAmountRow>('debts', ...own),
  ]);
  const rows = [
    ...signed(expenses, -1),
    ...signed(refunds, 1),
    ...signed(incomes, 1),
    ...signed(sent, -1),
    ...signed(received, 1),
    ...debts.map(row => ({
      day: row.date.slice(0, 10),
      units: (isBorrowType(row.type) ? 1 : -1) * toMoneyUnits(row.amount),
    })),
  ];
  return days.map(day => rows.reduce((sum, row) => (row.day <= day ? sum + row.units : sum), 0));
};

/**
 * Net money into one account over `(after, day]` for each day asked, in
 * units (money in positive). On the device one SQL statement adds them up
 * (positionSumsQuery.ts); the result is the same either way.
 */
export const flowSumsAt = async (
  userId: string,
  accountId: string,
  after: string | null,
  days: readonly string[],
): Promise<number[]> => {
  if (days.length === 0) {
    return [];
  }
  if (!runsSql) {
    return sumsInJs(userId, accountId, after, days);
  }
  const [row] = (await database
    .get('expenses')
    .query(Q.unsafeSqlQuery(positionSumsSql(days.length), positionSumsArgs(userId, accountId, after, days)))
    .unsafeFetchRaw()) as PositionSumsRow[]; // the statement selects s0…s(n−1), all numbers
  return days.map((_, i) => Math.round(row?.[`s${i}`] ?? 0));
};
