/**
 * Pure import planner — turns a validated, upgraded export payload into a
 * deduplicated, fully-resolvable creation plan. No database access, so every
 * rule here is unit-testable.
 *
 * Rules:
 * - Categories dedupe by name, debtors by title. When duplicates exist
 *   (real backups contain them — e.g. "Fuel" twice from the old
 *   import-retry bug), the ACTIVE entry wins; otherwise the first one does.
 * - Soft-delete statuses are preserved (import used to resurrect everything).
 * - Expense/debt references that point at a name missing from the backup are
 *   never dropped: the missing category/debtor is auto-created instead.
 * - Expenses and debts are NOT deduplicated — identical rows are
 *   indistinguishable from legitimately repeated transactions.
 * - Debt types are normalised to 'Borrow' | 'Lend'.
 * - Dedupe by name is case-SENSITIVE on purpose: the app now refuses to create
 *   a second active category/debtor whose name differs only by case, so two
 *   spellings in one file came from different rows and are kept apart.
 */

import type {ExportData} from '../export/validate';
import {DEFAULTS, sanitizeString} from '../../utils/sanitize';

/** One row of the validated file. The planned shapes below are these plus what planning resolves (M18). */
type FileRow<K extends keyof ExportData> = ExportData[K][number];

type PlannedCategory = Omit<FileRow<'categories'>, 'categoryStatus' | 'icon' | 'color'> & {
  status: boolean;
  icon: string;
  color: string;
  autoCreated: boolean;
};

type PlannedDebtor = Omit<FileRow<'debtors'>, 'debtorStatus' | 'icon' | 'type' | 'color'> & {
  status: boolean;
  icon: string;
  type: string;
  color: string;
  autoCreated: boolean;
};

type PlannedCurrency = FileRow<'currencies'>;

type PlannedBudget = Omit<FileRow<'budgets'>, 'category'> & {
  /** Set for per-category budgets; resolved to a fresh id at import time. */
  categoryName?: string;
};

type PlannedExpense = Omit<FileRow<'expenses'>, 'description' | 'category'> & {
  description: string;
  categoryName: string;
};

/** `type` is already a DebtType: the schema folds free-text types into the two. */
type PlannedDebt = Omit<FileRow<'debts'>, 'debtor'> & {debtorTitle: string};

export interface ImportStats {
  categories: number;
  debtors: number;
  currencies: number;
  expenses: number;
  debts: number;
  budgets: number;
  autoCreatedCategories: number;
  autoCreatedDebtors: number;
}

interface ImportPlan {
  categories: PlannedCategory[];
  debtors: PlannedDebtor[];
  currencies: PlannedCurrency[];
  budgets: PlannedBudget[];
  expenses: PlannedExpense[];
  debts: PlannedDebt[];
  stats: ImportStats;
}

const AUTO_CREATED_DEBTOR_TYPE = 'Other';

export const buildImportPlan = (data: ExportData): ImportPlan => {
  const categoriesByName = new Map<string, PlannedCategory>();
  for (const category of data.categories) {
    const planned: PlannedCategory = {
      name: category.name,
      status: category.categoryStatus ?? true,
      icon: sanitizeString(category.icon, DEFAULTS.icon),
      color: sanitizeString(category.color, DEFAULTS.color),
      autoCreated: false,
    };
    const existing = categoriesByName.get(category.name);
    if (!existing || (!existing.status && planned.status)) {
      categoriesByName.set(category.name, planned);
    }
  }

  const debtorsByTitle = new Map<string, PlannedDebtor>();
  for (const debtor of data.debtors) {
    const planned: PlannedDebtor = {
      title: debtor.title,
      status: debtor.debtorStatus ?? true,
      icon: sanitizeString(debtor.icon, DEFAULTS.icon),
      type: sanitizeString(debtor.type, AUTO_CREATED_DEBTOR_TYPE),
      color: sanitizeString(debtor.color, DEFAULTS.color),
      autoCreated: false,
    };
    const existing = debtorsByTitle.get(debtor.title);
    if (!existing || (!existing.status && planned.status)) {
      debtorsByTitle.set(debtor.title, planned);
    }
  }

  const currenciesByCode = new Map<string, PlannedCurrency>();
  for (const currency of data.currencies) {
    if (!currenciesByCode.has(currency.code)) {
      currenciesByCode.set(currency.code, {
        code: currency.code,
        symbol: currency.symbol,
        name: currency.name,
      });
    }
  }

  const budgetsByKey = new Map<string, PlannedBudget>();
  for (const budget of data.budgets) {
    const isCategoryBudget = budget.budgetType === 'category';
    const categoryName = isCategoryBudget ? budget.category?.name : undefined;
    // A category budget without a category (or whose category is not in the
    // file) has nothing to attach to; drop it rather than import an orphan.
    if (isCategoryBudget && (!categoryName || !categoriesByName.has(categoryName))) {
      continue;
    }
    const key = `${budget.month}|${budget.budgetType}|${categoryName ?? ''}`;
    if (!budgetsByKey.has(key)) {
      budgetsByKey.set(key, {
        amount: budget.amount,
        month: budget.month,
        budgetType: budget.budgetType,
        categoryName,
      });
    }
  }

  const expenses: PlannedExpense[] = data.expenses.map(expense => ({
    title: expense.title,
    amount: expense.amount,
    description: expense.description ?? '',
    categoryName: expense.category.name,
    date: expense.date,
  }));

  // Types were folded into the two the app knows by the schema, so no row can
  // land in a bucket that is counted but never shown (B7).
  const debts: PlannedDebt[] = data.debts.map(debt => ({
    amount: debt.amount,
    description: debt.description,
    debtorTitle: debt.debtor.title,
    date: debt.date,
    type: debt.type,
  }));

  // Auto-create anything referenced by a transaction but missing from the
  // backup's own entity lists (e.g. the 'Unknown' sentinel exported for
  // dangling ids) — losing the transaction would be far worse.
  let autoCreatedCategories = 0;
  for (const expense of expenses) {
    if (!categoriesByName.has(expense.categoryName)) {
      categoriesByName.set(expense.categoryName, {
        name: expense.categoryName,
        status: true,
        icon: DEFAULTS.icon,
        color: DEFAULTS.color,
        autoCreated: true,
      });
      autoCreatedCategories++;
    }
  }

  let autoCreatedDebtors = 0;
  for (const debt of debts) {
    if (!debtorsByTitle.has(debt.debtorTitle)) {
      debtorsByTitle.set(debt.debtorTitle, {
        title: debt.debtorTitle,
        status: true,
        icon: DEFAULTS.icon,
        type: AUTO_CREATED_DEBTOR_TYPE,
        color: DEFAULTS.color,
        autoCreated: true,
      });
      autoCreatedDebtors++;
    }
  }

  const categories = Array.from(categoriesByName.values());
  const debtors = Array.from(debtorsByTitle.values());
  const currencies = Array.from(currenciesByCode.values());
  const budgets = Array.from(budgetsByKey.values());

  return {
    categories,
    debtors,
    currencies,
    budgets,
    expenses,
    debts,
    stats: {
      categories: categories.length,
      debtors: debtors.length,
      currencies: currencies.length,
      expenses: expenses.length,
      debts: debts.length,
      budgets: budgets.length,
      autoCreatedCategories,
      autoCreatedDebtors,
    },
  };
};
