import {Q} from '@nozbe/watermelondb';
import type {Clause, Where} from '@nozbe/watermelondb/QueryDescription';
import {database} from '../database/database';
import {Expense} from '../database/models/Expense';
import {Refund} from '../database/models/Refund';
import {dayDateClauses, monthDateClauses} from './expenseDateRange';
import {fromMoneyUnits, toMoneyUnits} from '../../domain/money';
import {categoryRefsOf} from './categoryRefs';
import type {RefundData, RefundListRow} from '../../domain/types';
import {compareDateKeys, toDayKey} from '../../domain/dates';

/**
 * Refunds (schema v5): money that came back for one expense. A refund is a
 * child of its expense: created only for an existing expense, never more in
 * total than the expense, never on a day before it, deleted with it. It
 * lowers spending in the month of its own date (cash basis); the expense
 * keeps its amount. ZERO_SYSTEM_DESIGN.md R2, R12.
 */

export type RefundRule =
  'amountNotPositive' | 'exceedsExpense' | 'beforeExpense' | 'expenseBelowRefunds' | 'expenseAfterRefund';

/**
 * A write refused because it would break one of the refund invariants. The UI maps `rule` to copy.
 */
export class RefundRuleError extends Error {
  readonly rule: RefundRule;
  constructor(rule: RefundRule) {
    super(`Refund rule broken: ${rule}`);
    this.name = 'RefundRuleError';
    this.rule = rule;
  }
}

/** The local day of a stored date (toDayKey). Refund bounds compare days, not times. */
const dayOf = toDayKey;

const isPositiveAmount = (amount: number): boolean => Number.isFinite(amount) && toMoneyUnits(amount) > 0;

const toRefundData = (r: Refund): RefundData => ({
  id: r.id,
  userId: r.userId,
  expenseId: r.expenseId,
  accountId: r.accountId,
  amount: r.amount,
  date: r.date,
  note: r.note ?? '',
  createdAt: r.createdAt.getTime(),
  updatedAt: r.updatedAt.getTime(),
});

const refundsOf = (expenseId: string): Promise<Refund[]> =>
  database.get<Refund>('refunds').query(Q.where('expense_id', expenseId)).fetch();

/**
 * Checks a proposed refund against its expense and the expense's other
 * refunds (`others` excludes the one being edited). Pure, so the edit path
 * and the expense-edit guard share it.
 */
const assertRefundFits = (
  expense: {amount: number; date: string},
  refund: {amount: number; date: string},
  others: ReadonlyArray<{amount: number}>,
): void => {
  if (!isPositiveAmount(refund.amount)) {
    throw new RefundRuleError('amountNotPositive');
  }
  if (dayOf(refund.date) < dayOf(expense.date)) {
    throw new RefundRuleError('beforeExpense');
  }
  const total = others.reduce((sum, r) => sum + toMoneyUnits(r.amount), toMoneyUnits(refund.amount));
  if (total > toMoneyUnits(expense.amount)) {
    throw new RefundRuleError('exceedsExpense');
  }
};

/**
 * Throws when an edit of an expense would leave its refunds invalid: an
 * amount below what was already refunded, or a date after a refund's day.
 * Called by expenseService inside its writer.
 */
export const assertExpenseEditKeepsRefunds = async (
  expenseId: string,
  next: {amount: number; date: string},
): Promise<void> => {
  const refunds = await refundsOf(expenseId);
  if (refunds.length === 0) {
    return;
  }
  const refunded = refunds.reduce((sum, r) => sum + toMoneyUnits(r.amount), 0);
  if (toMoneyUnits(next.amount) < refunded) {
    throw new RefundRuleError('expenseBelowRefunds');
  }
  if (refunds.some(r => dayOf(r.date) < dayOf(next.date))) {
    throw new RefundRuleError('expenseAfterRefund');
  }
};

/** Prepared deletes of every refund of an expense, for the expense delete's own batch. */
export const prepareDestroyRefundsOf = async (expenseId: string): Promise<Refund[]> =>
  (await refundsOf(expenseId)).map(r => r.prepareDestroyPermanently());

/**
 * Records money that came back for an expense. The refund lands on the
 * expense's account (2.8 has one; 3.0 lets the user choose).
 */
export const createRefund = async (
  expenseId: string,
  input: {amount: number; date: string; note: string},
): Promise<string> => {
  let id = '';
  await database.write(async () => {
    const expense = await database.get<Expense>('expenses').find(expenseId);
    assertRefundFits(expense, input, await refundsOf(expenseId));
    const refund = await database.get<Refund>('refunds').create(r => {
      r.userId = expense.userId;
      r.expenseId = expense.id;
      r.accountId = expense.accountId;
      r.amount = input.amount;
      r.date = input.date;
      r.note = input.note;
    });
    id = refund.id;
  });
  return id;
};

export const updateRefund = async (
  refundId: string,
  patch: {amount?: number; date?: string; note?: string},
): Promise<void> => {
  await database.write(async () => {
    const refund = await database.get<Refund>('refunds').find(refundId);
    const expense = await database.get<Expense>('expenses').find(refund.expenseId);
    const others = (await refundsOf(expense.id)).filter(r => r.id !== refund.id);
    assertRefundFits(expense, {amount: patch.amount ?? refund.amount, date: patch.date ?? refund.date}, others);
    await refund.update(r => {
      if (patch.amount !== undefined) {
        r.amount = patch.amount;
      }
      if (patch.date !== undefined) {
        r.date = patch.date;
      }
      if (patch.note !== undefined) {
        r.note = patch.note;
      }
    });
  });
};

export const deleteRefund = async (refundId: string): Promise<void> => {
  await database.write(async () => {
    const refund = await database.get<Refund>('refunds').find(refundId);
    await refund.destroyPermanently();
  });
};

/** The refunds of one expense, oldest first. */
export const getRefundsByExpense = async (expenseId: string): Promise<RefundData[]> =>
  (await refundsOf(expenseId)).map(toRefundData).sort((a, b) => compareDateKeys(a.date, b.date, 1));

/** A refund row as SQLite holds it (column names; keep in step with v5Tables.ts). */
interface RawRefundRow {
  id: string;
  expense_id: string;
  amount: number;
  date: string;
  note: string | null;
}
interface RawParentRow {
  id: string;
  title: string;
  category_id: string;
}

// unsafeFetchRaw is typed any[]; the rows are v5Tables.ts's refunds table.
const fetchRefundRows = (...clauses: Clause[]): Promise<RawRefundRow[]> =>
  database
    .get<Refund>('refunds')
    .query(...clauses)
    .unsafeFetchRaw();

/**
 * Refunds dated in a range, each with its expense's title and category. A
 * refund's expense may sit in an earlier month, so parents are read by id.
 * `categoryId` keeps only refunds of that category's expenses.
 */
const refundRowsIn = async (userId: string, range: Clause[], categoryId?: string): Promise<RefundListRow[]> => {
  const refunds = await fetchRefundRows(Q.where('user_id', userId), ...range);
  if (refunds.length === 0) {
    return [];
  }
  const parentIds = [...new Set(refunds.map(r => r.expense_id))];
  // unsafeFetchRaw is typed any[]; the rows are schema.ts's expenses table.
  const parents: RawParentRow[] = await database
    .get<Expense>('expenses')
    .query(Q.where('id', Q.oneOf(parentIds)))
    .unsafeFetchRaw();
  const parentById = new Map(parents.map(p => [p.id, p]));
  const categoryById = await categoryRefsOf(userId);
  return refunds.flatMap(refund => {
    const parent = parentById.get(refund.expense_id);
    // A refund never outlives its expense (deleted in one batch); skip if it somehow did.
    if (!parent || (categoryId !== undefined && parent.category_id !== categoryId)) {
      return [];
    }
    return [
      {
        id: refund.id,
        expenseId: refund.expense_id,
        amount: refund.amount,
        date: refund.date,
        note: refund.note ?? '',
        title: parent.title,
        categoryId: parent.category_id,
        category: categoryById.get(parent.category_id),
      },
    ];
  });
};

/** Refunds dated in a 'YYYY-MM' month, for Home, Reports and the budget figures. */
export const getRefundRowsByMonth = (userId: string, yearMonth: string): Promise<RefundListRow[]> =>
  refundRowsIn(userId, monthDateClauses(yearMonth));

/** Refunds dated on one 'YYYY-MM-DD' day, for the day screen. */
export const getRefundRowsByDate = (userId: string, day: string): Promise<RefundListRow[]> =>
  refundRowsIn(userId, dayDateClauses(day));

/** Refunds dated in a month on expenses of one category, for the category screen. */
export const getRefundRowsByCategoryAndMonth = (
  userId: string,
  categoryId: string,
  yearMonth: string,
): Promise<RefundListRow[]> => refundRowsIn(userId, monthDateClauses(yearMonth), categoryId);

/**
 * How much has come back on each expense the clauses select, whenever it came
 * back: the "₹1,200 refunded" badge. Expenses with no refund are absent.
 *
 * One join on the refund's expense, so the expense set is described by the
 * same clauses that read it (a month, a day, a category's month). It used to
 * take the expense ids and inline every one into an `IN (...)` literal: about
 * 12 KB of SQL re-parsed on every Home focus for a 400-row month (audit
 * 2026-11-08 §8.4).
 */
const refundedAmountsOf = async (userId: string, expenseClauses: readonly Where[]): Promise<Record<string, number>> => {
  const rows = await fetchRefundRows(
    Q.where('user_id', userId),
    Q.on('expenses', [Q.where('user_id', userId), ...expenseClauses]),
  );
  const units = new Map<string, number>();
  for (const row of rows) {
    units.set(row.expense_id, (units.get(row.expense_id) ?? 0) + toMoneyUnits(row.amount));
  }
  return Object.fromEntries([...units].map(([id, u]) => [id, fromMoneyUnits(u)]));
};

/** The badge amounts for a 'YYYY-MM' month's expenses (Home, Reports). */
export const getRefundedAmountsByMonth = (userId: string, yearMonth: string): Promise<Record<string, number>> =>
  refundedAmountsOf(userId, monthDateClauses(yearMonth));

/** The badge amounts for one 'YYYY-MM-DD' day's expenses (the day screen). */
export const getRefundedAmountsByDate = (userId: string, day: string): Promise<Record<string, number>> =>
  refundedAmountsOf(userId, dayDateClauses(day));

/** The badge amounts for one category's expenses in a month (the category screen). */
export const getRefundedAmountsByCategoryAndMonth = (
  userId: string,
  categoryId: string,
  yearMonth: string,
): Promise<Record<string, number>> =>
  refundedAmountsOf(userId, [Q.where('category_id', categoryId), ...monthDateClauses(yearMonth)]);
