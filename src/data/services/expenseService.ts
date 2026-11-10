import {Q} from '@nozbe/watermelondb';
import type {Clause} from '@nozbe/watermelondb/QueryDescription';
import {database} from '../database/database';
import {Expense} from '../database/models/Expense';
import {EXPENSE_YEARS_SQL, parseExpenseYears, type ExpenseYearRow} from './expenseYearsQuery';
import {assertUserId} from './assertUserId';
import {TITLE_HISTORY_SQL} from './titleHistory';
import {titleKey} from '../../domain/titleKey';
import {dayDateClauses, monthDateClauses} from './expenseDateRange';
import {resolveDefaultAccount} from './accountService';
import {assertExpenseEditKeepsRefunds, prepareDestroyRefundsOf} from './refundService';
import {isUsersCategoryOfKind} from './categoryKind';
import {categoryRefsOf} from './categoryRefs';
import {toMoneyUnits} from '../../domain/money';
import type {CategoryRef, ExpenseWithCategory} from '../../domain/types';

const mapExpenseWithCategory = (e: Expense, categoryMap: ReadonlyMap<string, CategoryRef>): ExpenseWithCategory => ({
  id: e.id,
  title: e.title,
  amount: e.amount,
  description: e.description ?? '',
  categoryId: e.categoryId,
  userId: e.userId,
  date: e.date,
  category: categoryMap.get(e.categoryId),
});

/**
 * An expense row as SQLite holds it (column names; keep in step with schema.ts
 * and models/Expense.ts). The list reads below skip Model hydration: Redux only
 * ever gets plain objects, and hydrating ~170 models was most of a month read
 * on the Moto once the index fixed the SQL (2.7.1 gate).
 */
interface RawExpenseRow {
  id: string;
  title: string;
  amount: number;
  description: string | null;
  category_id: string;
  user_id: string;
  date: string;
}

// unsafeFetchRaw is typed any[]; the rows are schema.ts's expenses table, and
// WatermelonDB's query still leaves out soft-deleted rows.
const fetchExpenseRows = (...clauses: Clause[]): Promise<RawExpenseRow[]> =>
  database
    .get<Expense>('expenses')
    .query(...clauses)
    .unsafeFetchRaw();

/** An expense as the widget's "quick" and "add again" pickers read it: no category join, no model. */
interface RecentExpenseRow {
  title: string;
  amount: number;
  categoryId: string;
  /** ISO date or date-time. */
  date: string;
}

/**
 * The user's expenses dated `sinceDay` ('YYYY-MM-DD') or later, raw: one index
 * range on (user_id, date). The widget derives its quick categories and "add
 * again" from one read of this instead of a 90-day scan plus two month reads
 * that each joined every category (audit 2026-11-08 §8.1).
 */
export const getExpenseRowsSince = async (userId: string, sinceDay: string): Promise<RecentExpenseRow[]> => {
  assertUserId(userId, 'expense');
  const rows = await fetchExpenseRows(Q.where('user_id', userId), Q.where('date', Q.gte(sinceDay)));
  return rows.map(row => ({
    title: String(row.title ?? ''),
    amount: Number(row.amount),
    categoryId: String(row.category_id ?? ''),
    date: String(row.date ?? ''),
  }));
};

const mapRawExpense = (row: RawExpenseRow, categoryMap: ReadonlyMap<string, CategoryRef>): ExpenseWithCategory => ({
  id: row.id,
  title: row.title,
  amount: row.amount,
  description: row.description ?? '',
  categoryId: row.category_id,
  userId: row.user_id,
  date: row.date,
  category: categoryMap.get(row.category_id),
});

/** One expense with its category, or null when the id no longer exists (M19). */
export const getExpenseById = async (expenseId: string): Promise<ExpenseWithCategory | null> => {
  const [expense] = await database.get<Expense>('expenses').query(Q.where('id', expenseId)).fetch();
  if (!expense) {
    return null;
  }
  return mapExpenseWithCategory(expense, await categoryRefsOf(expense.userId));
};

/** The rule an expense write broke. The forms validate first; this is the backstop (audit 2026-11-08 §4.3). */
type ExpenseRule = 'amountNotPositive' | 'notAnExpenseCategory';

/** A write refused because it would store an invalid expense. */
class ExpenseRuleError extends Error {
  readonly rule: ExpenseRule;
  constructor(rule: ExpenseRule) {
    super(`Expense rule broken: ${rule}`);
    this.name = 'ExpenseRuleError';
    this.rule = rule;
  }
}

const assertAmount = (amount: number): void => {
  if (!Number.isFinite(amount) || toMoneyUnits(amount) <= 0) {
    throw new ExpenseRuleError('amountNotPositive');
  }
};

/** The category is the user's and an expense one; an archived one is allowed (an old row keeps its category). */
const assertExpenseCategory = async (userId: string, categoryId: string): Promise<void> => {
  if (!(await isUsersCategoryOfKind(userId, categoryId, 'expense'))) {
    throw new ExpenseRuleError('notAnExpenseCategory');
  }
};

/**
 * Creates a new expense. Refuses an amount that is not above zero and a
 * category that is not one of the user's expense categories (ExpenseRuleError).
 */
export const createExpense = async (
  userId: string,
  title: string,
  amount: number,
  description: string,
  categoryId: string,
  date: string,
  /**
   * A fixed id (2.8: an entry made outside the app keeps the id it was queued
   * under, so replaying the queue after a crash cannot save it twice; an
   * existing row with that id is left as it is).
   */
  options: {id?: string} = {},
): Promise<string> => {
  assertUserId(userId, 'expense');
  let expenseId = '';
  await database.write(async () => {
    if (options.id && (await database.get<Expense>('expenses').query(Q.where('id', options.id)).fetchCount()) > 0) {
      expenseId = options.id;
      return;
    }
    assertAmount(amount);
    await assertExpenseCategory(userId, categoryId);
    // Every expense is paid from an account (schema v5): the user's default.
    const {accountId, prepared} = await resolveDefaultAccount(userId);
    // Uses WatermelonDB auto-generated ID (library default). This is intentional;
    // other services use nanoid(24) for historical reasons. Both are valid.
    const expense = database.get<Expense>('expenses').prepareCreate(exp => {
      exp.title = title;
      exp.amount = amount;
      exp.description = description || '';
      exp.categoryId = categoryId;
      exp.userId = userId;
      exp.date = date;
      exp.accountId = accountId;
      if (options.id) {
        exp._raw.id = options.id;
      }
    });
    await database.batch([...prepared, expense]);
    expenseId = expense.id;
  });
  return expenseId;
};

/**
 * Updates an expense by ID, under the same rules as createExpense: a new
 * amount above zero, a new category one of the owner's expense categories.
 */
export const updateExpenseById = async (
  expenseId: string,
  categoryId?: string,
  newTitle?: string,
  newAmount?: number,
  newDescription?: string,
  newDate?: string,
): Promise<void> => {
  await database.write(async () => {
    const expense = await database.get<Expense>('expenses').find(expenseId);
    if (newAmount !== undefined) {
      assertAmount(newAmount);
    }
    if (categoryId !== undefined && categoryId !== expense.categoryId) {
      await assertExpenseCategory(expense.userId, categoryId);
    }
    // An edit may not undercut the expense's refunds (RefundRuleError).
    if (newAmount !== undefined || newDate !== undefined) {
      await assertExpenseEditKeepsRefunds(expenseId, {
        amount: newAmount ?? expense.amount,
        date: newDate ?? expense.date,
      });
    }
    await expense.update(exp => {
      if (newTitle !== undefined) {
        exp.title = newTitle;
      }
      if (newAmount !== undefined) {
        exp.amount = newAmount;
      }
      if (newDescription !== undefined) {
        exp.description = newDescription;
      }
      if (newDate !== undefined) {
        exp.date = newDate;
      }
      if (categoryId !== undefined) {
        exp.categoryId = categoryId;
      }
    });
  });
};

/**
 * Deletes an expense and its refunds in one batch: a refund never outlives
 * its expense (the only cascade in the database).
 */
export const deleteExpenseById = async (expenseId: string): Promise<void> => {
  await database.write(async () => {
    const expense = await database.get<Expense>('expenses').find(expenseId);
    await database.batch([...(await prepareDestroyRefundsOf(expenseId)), expense.prepareDestroyPermanently()]);
  });
};

/**
 * Gets all expenses by user ID and date with category data
 */
export const getAllExpensesByDate = async (userId: string, targetDate: string): Promise<ExpenseWithCategory[]> => {
  const [rows, categoryMap] = await Promise.all([
    fetchExpenseRows(Q.where('user_id', userId), ...dayDateClauses(targetDate)),
    categoryRefsOf(userId),
  ]);
  return rows.map(row => mapRawExpense(row, categoryMap));
};

/**
 * Gets all expenses for a user in a specific month: an index range on
 * (user_id, date) since schema v4 (see expenseDateRange.ts).
 */
export const getAllExpensesByMonth = async (userId: string, yearMonth: string): Promise<ExpenseWithCategory[]> => {
  const [rows, categoryMap] = await Promise.all([
    fetchExpenseRows(Q.where('user_id', userId), ...monthDateClauses(yearMonth)),
    categoryRefsOf(userId),
  ]);
  return rows.map(row => mapRawExpense(row, categoryMap));
};

/**
 * Gets all expenses for a user in a specific month filtered by category ID
 */
export const getAllExpensesByCategoryAndMonth = async (
  userId: string,
  categoryId: string,
  yearMonth: string,
): Promise<ExpenseWithCategory[]> => {
  const [rows, categoryMap] = await Promise.all([
    fetchExpenseRows(Q.where('user_id', userId), Q.where('category_id', categoryId), ...monthDateClauses(yearMonth)),
    categoryRefsOf(userId),
  ]);
  return rows.map(row => mapRawExpense(row, categoryMap));
};

/**
 * "Categorise from history" (2.8): the category of the user's newest expense
 * with this title (by titleKey), or null. Measured:
 * references/play-vitals/perf/v2.8/phase5-entry-quality-2026-11-07.md.
 */
export const findCategoryIdForTitle = async (userId: string, title: string): Promise<string | null> => {
  const key = titleKey(title);
  if (!userId || key === '') {
    return null;
  }
  // unsafeFetchRaw is typed any[]; this query selects category_id only.
  const rows = (await database
    .get<Expense>('expenses')
    .query(Q.unsafeSqlQuery(TITLE_HISTORY_SQL, [key, userId]))
    .unsafeFetchRaw()) as Array<{category_id?: unknown}>;
  const id = rows[0]?.category_id;
  return typeof id === 'string' && id !== '' ? id : null;
};

/**
 * Distinct years that have expenses, straight from SQLite (L5, v2.7.1): one
 * `select distinct substr(date,1,4)` instead of fetching every row. Cached per
 * user in `services/availableYearsCache`.
 */
export const getAvailableExpenseYears = async (userId: string): Promise<number[]> => {
  const rows: ExpenseYearRow[] = await database
    .get<Expense>('expenses')
    .query(Q.unsafeSqlQuery(EXPENSE_YEARS_SQL, [userId]))
    .unsafeFetchRaw();
  return parseExpenseYears(rows);
};
