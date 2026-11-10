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

/** A budget row: month parsed, and `categoryId` only on category budgets. */
export type BudgetData = {
  id: string;
  userId: string;
  amount: number;
  monthKey: BudgetMonthKey;
} & BudgetScope;

interface ExpenseData {
  id: string;
  title: string;
  amount: number;
  /** '' when the user left it empty. */
  description: string;
  categoryId: string;
  userId: string;
  /**
   * As stored: 'YYYY-MM-DDTHH:mm:ss' local since 2.7, but rows written by
   * older versions and old backups come in other shapes, which is why
   * domain/dates.toDayKey has a slow path. A plain string on purpose (audit
   * 2026-11-08, Appendix A: "date brands inconsistent"): IncomeData.date is
   * an IsoDay because only 2.8 writes it, as a validated day; a template type
   * here would promise a shape the stored data does not, and every row mapper
   * would need a cast. Read it through domain/dates, never by slicing.
   */
  date: string;
}

/**
 * How any row shows its category: one shape for expenses, refunds and lists
 * (there were seven, audit 2026-11-08 §5). `icon` is '' when none was chosen.
 */
export interface CategoryRef {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/** An expense with its category joined; `category` is undefined only when the category row is gone. */
export interface ExpenseWithCategory extends ExpenseData {
  category?: CategoryRef;
}

/** A category the user picks before it exists (onboarding, the defaults list): its name and look. */
export interface CategoryChoice {
  name: string;
  icon?: string;
  color?: string;
}

/**
 * Categories are typed (schema v5): expense categories classify spending,
 * income categories classify money in. Every category read names a kind.
 */
export type CategoryKind = 'expense' | 'income';

export interface CategoryData {
  id: string;
  name: string;
  kind: CategoryKind;
  categoryStatus: boolean;
  userId: string;
  icon: string;
  color: string;
  sortOrder: number;
}

/** Money that came back for one expense. Lowers spending in the month of `date` (cash basis). */
export interface RefundData {
  id: string;
  userId: string;
  expenseId: string;
  accountId: string;
  amount: number;
  /** Local 'YYYY-MM-DDTHH:mm:ss', like an expense's date; never on a day before the expense. */
  date: string;
  /** '' when the user left it empty. */
  note: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * A refund as a list shows it: the refund's own amount, date and note, with its
 * expense's title and category (a refund is money back on that purchase).
 */
export interface RefundListRow {
  id: string;
  expenseId: string;
  amount: number;
  date: string;
  note: string;
  title: string;
  categoryId: string;
  category?: CategoryRef;
}

/** Money that came in. Day precision: income has no time of day. */
export interface IncomeData {
  id: string;
  userId: string;
  /** A category of kind 'income'. */
  categoryId: string;
  accountId: string;
  amount: number;
  date: IsoDay;
  /** The user's own label ('Salary'); '' when empty. */
  note: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * The flow figures of one period (the income statement). Spent is net of the
 * refunds dated in the period; kept = received − spent, never cumulative.
 * Computed only by periodSummaryService.
 */
export interface PeriodSummary {
  spent: number;
  refunded: number;
  received: number;
  kept: number;
  /** Expense rows in the period; refunds and incomes are not counted as entries. */
  count: number;
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
