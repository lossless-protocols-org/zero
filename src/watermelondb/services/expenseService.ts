import {Q} from '@nozbe/watermelondb';
import type {Clause} from '@nozbe/watermelondb/QueryDescription';
import {DEFAULTS} from '../../utils/sanitize';
import {database} from '../database';
import Expense from '../models/Expense';
import Category from '../models/Category';
import {EXPENSE_YEARS_SQL, parseExpenseYears, type ExpenseYearRow} from './expenseYearsQuery';
import {assertUserId} from './assertUserId';
import {dayDateClauses, monthDateClauses} from './expenseDateRange';
import type {ExpenseData} from '../../domain/types';
export type {ExpenseData};

// Extended expense type with populated category
export interface ExpenseWithCategory extends ExpenseData {
  category?: {
    id: string;
    name: string;
    icon?: string;
    color: string;
  };
}

type CategoryInfo = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

const buildCategoryMap = async (userId: string): Promise<Map<string, CategoryInfo>> => {
  // Intentionally queries ALL categories (no category_status filter) so that
  // expenses under soft-deleted categories still resolve their name/icon/color.
  // Do NOT add a status filter here — it would break historical categorization.
  const categories = await database.get<Category>('categories').query(Q.where('user_id', userId)).fetch();
  return new Map(
    categories.map(cat => [
      cat.id,
      {id: cat.id, name: cat.name, icon: cat.icon ?? '', color: cat.color ?? DEFAULTS.color},
    ]),
  );
};

const mapExpenseWithCategory = (e: Expense, categoryMap: Map<string, CategoryInfo>): ExpenseWithCategory => ({
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

const mapRawExpense = (row: RawExpenseRow, categoryMap: Map<string, CategoryInfo>): ExpenseWithCategory => ({
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
  return mapExpenseWithCategory(expense, await buildCategoryMap(expense.userId));
};

/**
 * Creates a new expense
 */
export const createExpense = async (
  userId: string,
  title: string,
  amount: number,
  description: string,
  categoryId: string,
  date: string,
): Promise<string> => {
  assertUserId(userId, 'expense');
  let expenseId = '';
  await database.write(async () => {
    // Uses WatermelonDB auto-generated ID (library default). This is intentional;
    // other services use nanoid(24) for historical reasons. Both are valid.
    const expense = await database.get<Expense>('expenses').create(exp => {
      exp.title = title;
      exp.amount = amount;
      exp.description = description || '';
      exp.categoryId = categoryId;
      exp.userId = userId;
      exp.date = date;
    });
    expenseId = expense.id;
  });
  return expenseId;
};

/**
 * Updates an expense by ID
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
 * Deletes an expense by ID
 */
export const deleteExpenseById = async (expenseId: string): Promise<void> => {
  await database.write(async () => {
    const expense = await database.get<Expense>('expenses').find(expenseId);
    await expense.destroyPermanently();
  });
};

/**
 * Gets all expenses by user ID and date with category data
 */
export const getAllExpensesByDate = async (userId: string, targetDate: string): Promise<ExpenseWithCategory[]> => {
  const [rows, categoryMap] = await Promise.all([
    fetchExpenseRows(Q.where('user_id', userId), ...dayDateClauses(targetDate)),
    buildCategoryMap(userId),
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
    buildCategoryMap(userId),
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
    buildCategoryMap(userId),
  ]);
  return rows.map(row => mapRawExpense(row, categoryMap));
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
