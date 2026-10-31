/**
 * The app's data shapes, one definition each (M18, v2.7.1). Services map
 * WatermelonDB models to these; Redux, hooks and screens only ever see these.
 * Deliberately not derived from the models: those carry `_raw`, relations and
 * the stored forms (a budget's month string, a debt's free-text type).
 *
 * Imports nothing: every layer may depend on this file.
 */

/** A calendar day, 'YYYY-MM-DD'. Build one with `isIsoDay` from a checked string. */
export type IsoDay = `${number}-${number}-${number}`;

/** What the app writes for a debt. Stored rows may hold any spelling; services normalise on read. */
export type DebtType = 'Borrow' | 'Lend';

/** A budget row's month, parsed. A recurring start of '' is the legacy form. */
export type BudgetMonthKey = {kind: 'month'; yearMonth: string} | {kind: 'recurring'; start: string};

/**
 * Which budget a row or a write addresses. The overall monthly budget is one
 * row per month key; per-category budgets are one row per (category, month key).
 */
export type BudgetScope = {budgetType: 'monthly'} | {budgetType: 'category'; categoryId: string};

export type BudgetType = BudgetScope['budgetType'];

/** A budget row: month parsed, and `categoryId` only on category budgets. */
export type BudgetData = {
  id: string;
  userId: string;
  amount: number;
  monthKey: BudgetMonthKey;
} & BudgetScope;

export interface ExpenseData {
  id: string;
  title: string;
  amount: number;
  /** '' when the user left it empty. */
  description: string;
  categoryId: string;
  userId: string;
  date: string;
}

export interface CategoryData {
  id: string;
  name: string;
  categoryStatus: boolean;
  userId: string;
  icon: string;
  color: string;
}

export interface DebtorData {
  id: string;
  title: string;
  /** The account kind ('Friend', 'Bank', …), not a DebtType. */
  type: string;
  debtorStatus: boolean;
  userId: string;
  icon: string;
  color: string;
}

export interface DebtData {
  id: string;
  description: string;
  amount: number;
  debtorId: string;
  userId: string;
  date: string;
  type: DebtType;
}

export interface CurrencyData {
  id: string;
  code: string;
  symbol: string;
  name: string;
  userId: string;
}
