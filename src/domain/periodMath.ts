import {fromMoneyUnits, toMoneyUnits} from './money';
import {toDayKey} from './dates';

/**
 * The one place a refund changes sign (R2, ZERO_SYSTEM_DESIGN.md §2.1).
 *
 * A period's spending is its expenses minus the refunds DATED in it (cash
 * basis): a refund lowers the month the money came back in, under its
 * expense's category. Every screen that totals spending (Home's card and day
 * headers, Reports' total, donut and heatmap, budgets, the daily allowance,
 * the day and category screens) gets its rows from `toSpendRows` and adds
 * them with the ordinary `sumAmounts`, so none of them subtracts refunds on
 * its own. periodSummaryService uses the same function for the database
 * figures. `amount` stays positive in storage (R1); only these derived rows
 * carry a negative amount.
 */

interface Dated {
  amount: number;
  date: string;
}

/** A refund in a spend list: its own amount and date, its expense's category. */
type SpendRow<E extends Dated, R extends Dated> = E | (R & {amount: number});

/** Expenses as they are, refunds as negative amounts, in one list for totalling. */
export const toSpendRows = <E extends Dated, R extends Dated>(
  expenses: readonly E[],
  refunds: readonly R[],
): Array<SpendRow<E, R>> => [...expenses, ...refunds.map(refund => ({...refund, amount: -refund.amount}))];

/** Spent in a period: Σ expenses − Σ refunds dated in it, exact (integer units). */
export const netSpent = (expenses: readonly {amount: number}[], refunds: readonly {amount: number}[]): number =>
  fromMoneyUnits(
    expenses.reduce((sum, e) => sum + toMoneyUnits(e.amount), 0) -
      refunds.reduce((sum, r) => sum + toMoneyUnits(r.amount), 0),
  );

/** A period's spending as every screen and the widget show it. */
interface Spending {
  /** Net of the refunds dated in the period (R2). */
  spent: number;
  refunded: number;
  /** Expenses in the period (refunds are not counted as entries). */
  count: number;
}

/**
 * The one way a period's spending is figured from its rows (audit 2026-11-08
 * §4.1). Home's and Reports' selector (rows already loaded) and
 * periodSummaryService (rows read from the database: the widget, the Money
 * tab, the daily allowance) both call it, so a change to the rule is a change
 * to every figure at once.
 */
export const spendingOf = (expenses: readonly {amount: number}[], refunds: readonly {amount: number}[]): Spending => ({
  spent: netSpent(expenses, refunds),
  refunded: netSpent(refunds, []),
  count: expenses.length,
});

/**
 * The rows dated on local day `day` ('YYYY-MM-DD'), by toDayKey: a row stored
 * with a zone suffix counts on the day the user saw it, as the heatmap shows it.
 */
export const onDay = <T extends {date: string}>(rows: readonly T[], day: string): T[] =>
  rows.filter(row => toDayKey(row.date) === day);

/** The rows dated on or before local day `day`. */
export const upToDay = <T extends {date: string}>(rows: readonly T[], day: string): T[] =>
  rows.filter(row => toDayKey(row.date) <= day);

/** What is left to refund on an expense, never below 0. */
export const refundableRemainder = (expenseAmount: number, refundedSoFar: number): number =>
  Math.max(0, fromMoneyUnits(toMoneyUnits(expenseAmount) - toMoneyUnits(refundedSoFar)));

/** Kept = received − spent for a period (R4): a period figure, never a balance. Exact. */
export const keptOf = (received: number, spent: number): number =>
  fromMoneyUnits(toMoneyUnits(received) - toMoneyUnits(spent));

/**
 * Splits a month's net spending for the daily allowance. A day whose refunds
 * outweigh its spending counts as no spend today; the money that came back
 * lowers the spending before today instead, so it is spread over the days
 * left rather than shown as extra room for today alone ("₹1,000 left today"
 * on an overspent month).
 */
export const splitForAllowance = (
  monthSpent: number,
  todaySpent: number,
): {spentBeforeToday: number; spentToday: number} => {
  const spentToday = Math.max(todaySpent, 0);
  return {spentBeforeToday: fromMoneyUnits(toMoneyUnits(monthSpent) - toMoneyUnits(spentToday)), spentToday};
};
