import {Q} from '@nozbe/watermelondb';
import type {Clause} from '@nozbe/watermelondb/QueryDescription';
import {database} from '../database/database';
import {dayDateClauses, monthDateClauses} from './expenseDateRange';
import {fromMoneyUnits, toMoneyUnits} from '../../domain/money';
import {netSpent, onDay, spendingOf, splitForAllowance, upToDay} from '../../domain/periodMath';
import type {PeriodSummary} from '../../domain/types';

/**
 * The seam between the two books (ZERO_SYSTEM_DESIGN.md §2.1): the flow
 * figures of one period, from the database. Spending is netted against
 * refunds by domain/periodMath (R2), the same rule every screen uses; kept is
 * received − spent (R4). Reads only the three
 * flow tables, never accounts, debts or transfers (R14).
 *
 * Each table is one index range on (user_id, date) returning the period's
 * amounts; the sum is exact integer arithmetic (R10). A month is a few
 * hundred rows at most, and the same code runs on device SQLite and in the
 * LokiJS test harness.
 */

interface AmountRow {
  amount: number;
  /** ISO date or date-time; every flow table has it (schema.ts, v5Tables.ts). */
  date: string;
}

// unsafeFetchRaw is typed any[]; every flow table has numeric `amount` and ISO `date` columns (schema.ts, v5Tables.ts).
const amountsIn = (table: 'expenses' | 'refunds' | 'incomes', userId: string, range: Clause[]): Promise<AmountRow[]> =>
  database
    .get(table)
    .query(Q.where('user_id', userId), ...range)
    .unsafeFetchRaw();

const unitsOf = (rows: readonly AmountRow[]): number => rows.reduce((sum, row) => sum + toMoneyUnits(row.amount), 0);

const readFlows = (userId: string, range: Clause[]) =>
  Promise.all([
    amountsIn('expenses', userId, range),
    amountsIn('refunds', userId, range),
    amountsIn('incomes', userId, range),
  ]);

const summariseRows = (
  expenses: readonly AmountRow[],
  refunds: readonly AmountRow[],
  incomes: readonly AmountRow[],
): PeriodSummary => {
  // spendingOf (domain/periodMath) is the one spending rule, as Home's selector uses it; units for the rest.
  const spending = spendingOf(expenses, refunds);
  const receivedUnits = unitsOf(incomes);
  return {
    spent: spending.spent,
    refunded: spending.refunded,
    received: fromMoneyUnits(receivedUnits),
    kept: fromMoneyUnits(receivedUnits - toMoneyUnits(spending.spent)),
    count: spending.count,
  };
};

const summarise = async (userId: string, range: Clause[]): Promise<PeriodSummary> => {
  const [expenses, refunds, incomes] = await readFlows(userId, range);
  return summariseRows(expenses, refunds, incomes);
};

/** Spent, refunded, received and kept for a 'YYYY-MM' month (the widget snapshot). */
export const getMonthSummary = (userId: string, yearMonth: string): Promise<PeriodSummary> =>
  summarise(userId, monthDateClauses(yearMonth));

/**
 * @internal test
 * The same for one 'YYYY-MM-DD' day: the reference getMonthAndDaySummary's day is checked against.
 */
export const getDaySummary = (userId: string, day: string): Promise<PeriodSummary> =>
  summarise(userId, dayDateClauses(day));

/**
 * A month and one of its days from ONE read of the month's rows (the widget's
 * month and today figures; audit 2026-11-08 §8.1). A day's rows are those on
 * that local day (periodMath.onDay), exactly as Home's Today counts them.
 */
export const getMonthAndDaySummary = async (
  userId: string,
  yearMonth: string,
  day: string,
): Promise<{month: PeriodSummary; day: PeriodSummary}> => {
  if (!day.startsWith(`${yearMonth}-`)) {
    throw new Error(`Day "${day}" is not in month "${yearMonth}"`);
  }
  dayDateClauses(day); // the same validation as a day read: a real calendar day
  const [expenses, refunds, incomes] = await readFlows(userId, monthDateClauses(yearMonth));
  return {
    month: summariseRows(expenses, refunds, incomes),
    day: summariseRows(onDay(expenses, day), onDay(refunds, day), onDay(incomes, day)),
  };
};

/**
 * The daily allowance's spending for an entry dated `day`: what was spent on
 * that day and before it in its month, from one read, split as
 * splitForAllowance does (a day whose refunds outweigh its spending counts as
 * no spend that day). The add form's hint reads this instead of querying and
 * netting on its own (audit 2026-11-08 §4.1).
 */
export const getAllowanceSpend = async (
  userId: string,
  day: string,
): Promise<{spentOnDay: number; spentBeforeDay: number}> => {
  dayDateClauses(day); // a real calendar day, or a throw
  const range = monthDateClauses(day.slice(0, 7));
  const [expenses, refunds] = await Promise.all([
    amountsIn('expenses', userId, range),
    amountsIn('refunds', userId, range),
  ]);
  const split = splitForAllowance(
    netSpent(upToDay(expenses, day), upToDay(refunds, day)),
    netSpent(onDay(expenses, day), onDay(refunds, day)),
  );
  return {spentOnDay: split.spentToday, spentBeforeDay: split.spentBeforeToday};
};

/**
 * Tables whose writes change a summary or how it reads: the flows themselves,
 * plus the budget it is measured against, the currency it is shown in and the
 * user it belongs to. Kept here, beside the reads, so a new flow table is
 * added to the watch in the same change (the home-screen widget, 2.8).
 */
const SUMMARY_INPUT_TABLES = ['expenses', 'refunds', 'incomes', 'budgets', 'currencies', 'users'];

/** Emits once at once, then after every write to a table a summary depends on (unsubscribe to stop). */
export const observeSummaryInputs = () => database.withChangesForTables(SUMMARY_INPUT_TABLES);
