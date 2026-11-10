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
 * - v5: categories are keyed by (kind, name): "Gift" may be an expense and an
 *   income category at once. Expenses and budgets resolve to expense
 *   categories, incomes to income categories, each auto-created if missing.
 * - v5: exactly one ACTIVE income category: the file's first (extras are
 *   merged into it), made active if it was archived, else the default
 *   'Income'. Money in always has somewhere to land after a restore, as after
 *   createUser and the v5 upgrade (audit 2026-11-08 §4.1).
 * - v5: exactly one default account is planned (the file's, else a new
 *   'Cash'); entries naming no account or an unknown one land on it.
 * - v5: a refund that does not fit its expense (before its day, or more in
 *   total than the expense) is left out and counted in `rejectedRefunds`;
 *   its expense is kept.
 * - v5: an entry without `createdAt` gets it from its date, exactly as the
 *   database migration does (domain/isoEpoch.ts); `updatedAt` defaults to it.
 */

import type {ExportData} from '../export/validate';
import {DEFAULTS, sanitizeString} from '../../../domain/sanitize';
import {epochFromIsoDate} from '../../../domain/isoEpoch';
import {toMoneyUnits} from '../../../domain/money';
import type {CategoryKind} from '../../../domain/types';
import {FREE_INCOME_CATEGORIES} from '../../../domain/freeTier';
import {CATEGORY_SORT_STEP, sortOrderAt} from '../../../domain/categoryOrder';
import {DEFAULT_ACCOUNT_COLOR, DEFAULT_ACCOUNT_ICON, DEFAULT_ACCOUNT_NAME} from '../../database/defaultAccount';
import {
  DEFAULT_INCOME_CATEGORY_COLOR,
  DEFAULT_INCOME_CATEGORY_ICON,
  DEFAULT_INCOME_CATEGORY_NAME,
} from '../../database/defaultIncomeCategory';
import {compareDateKeys, toDayKey} from '../../../domain/dates';

/** One row of the validated file. The planned shapes below are these plus what planning resolves (M18). */
type FileRow<K extends keyof ExportData> = ExportData[K][number];

type PlannedCategory = Omit<FileRow<'categories'>, 'categoryStatus' | 'icon' | 'color' | 'sortOrder'> & {
  status: boolean;
  icon: string;
  color: string;
  sortOrder: number;
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

type PlannedAccount = FileRow<'accounts'>;

type PlannedBudget = Omit<FileRow<'budgets'>, 'category'> & {
  /** Set for per-category budgets; resolved to a fresh id at import time. */
  categoryName?: string;
};

interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

/** A refund as the file nests it in its expense. */
type FileRefund = NonNullable<FileRow<'expenses'>['refunds']>[number];

type PlannedRefund = Omit<FileRefund, 'createdAt' | 'updatedAt'> & Timestamps;

type PlannedExpense = Omit<
  FileRow<'expenses'>,
  'description' | 'category' | 'account' | 'refunds' | 'createdAt' | 'updatedAt'
> &
  Timestamps & {
    description: string;
    categoryName: string;
    accountName: string;
    refunds: PlannedRefund[];
  };

type PlannedIncome = Omit<FileRow<'incomes'>, 'category' | 'account' | 'createdAt' | 'updatedAt'> &
  Timestamps & {
    categoryName: string;
    accountName: string;
  };

/** `type` is already a DebtType: the schema folds free-text types into the two. */
type PlannedDebt = Omit<FileRow<'debts'>, 'debtor' | 'createdAt' | 'updatedAt'> & Timestamps & {debtorTitle: string};

export interface ImportStats {
  categories: number;
  debtors: number;
  currencies: number;
  expenses: number;
  debts: number;
  budgets: number;
  accounts: number;
  refunds: number;
  incomes: number;
  autoCreatedCategories: number;
  autoCreatedDebtors: number;
  /** Refunds left out because they did not fit their expense. */
  rejectedRefunds: number;
  /** Entries whose account was not in the file, recorded on the default account. */
  reassignedToDefaultAccount: number;
  /** Income categories beyond Free's one, folded into `incomeCategoryKept` with their entries. */
  mergedIncomeCategories: number;
  incomeCategoryKept: string | null;
}

interface ImportPlan {
  categories: PlannedCategory[];
  debtors: PlannedDebtor[];
  currencies: PlannedCurrency[];
  accounts: PlannedAccount[];
  budgets: PlannedBudget[];
  expenses: PlannedExpense[];
  incomes: PlannedIncome[];
  debts: PlannedDebt[];
  stats: ImportStats;
}

const AUTO_CREATED_DEBTOR_TYPE = 'Other';

/** The map key of a category: names are unique per kind, not overall. */
export const categoryKey = (kind: CategoryKind, name: string): string => `${kind}\u0000${name}`;

/** Timestamps of an entry: the file's, else from its date (as the v5 migration), else `now`. */
const timestampsOf = (row: {date: string; createdAt?: number; updatedAt?: number}, now: number): Timestamps => {
  const createdAt = row.createdAt ?? epochFromIsoDate(row.date) ?? now;
  return {createdAt, updatedAt: row.updatedAt ?? createdAt};
};

/** The local day of a stored date; refund bounds compare days, as refundService does (toDayKey). */
const dayOf = toDayKey;

export const buildImportPlan = (data: ExportData, now: number = Date.now()): ImportPlan => {
  const categoriesByKey = new Map<string, PlannedCategory>();
  data.categories.forEach((category, index) => {
    const planned: PlannedCategory = {
      name: category.name,
      kind: category.kind,
      status: category.categoryStatus ?? true,
      icon: sanitizeString(category.icon, DEFAULTS.icon),
      color: sanitizeString(category.color, DEFAULTS.color),
      sortOrder: category.sortOrder ?? sortOrderAt(index),
      autoCreated: false,
    };
    const key = categoryKey(category.kind, category.name);
    const existing = categoriesByKey.get(key);
    if (!existing || (!existing.status && planned.status)) {
      categoriesByKey.set(key, planned);
    }
  });

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
  const userCurrency = currenciesByCode.values().next().value?.code ?? '';

  // Accounts: deduped by name; exactly one default (the file's first, else a new 'Cash').
  const accountsByName = new Map<string, PlannedAccount>();
  for (const account of data.accounts) {
    if (!accountsByName.has(account.name)) {
      accountsByName.set(account.name, {...account, currency: userCurrency || account.currency});
    }
  }
  const fileDefault = [...accountsByName.values()].find(account => account.isDefault);
  const defaultAccount: PlannedAccount = fileDefault ?? {
    name: accountsByName.has(DEFAULT_ACCOUNT_NAME) ? `${DEFAULT_ACCOUNT_NAME} (default)` : DEFAULT_ACCOUNT_NAME,
    type: 'cash',
    currency: userCurrency,
    openingBalance: 0,
    openingDate: null,
    isDefault: true,
    accountStatus: true,
    sortOrder: 0,
    icon: DEFAULT_ACCOUNT_ICON,
    color: DEFAULT_ACCOUNT_COLOR,
  };
  for (const account of accountsByName.values()) {
    account.isDefault = account === defaultAccount;
  }
  accountsByName.set(defaultAccount.name, defaultAccount);
  let reassignedToDefaultAccount = 0;
  const accountNameFor = (name: string | undefined): string => {
    if (name === undefined) {
      return defaultAccount.name;
    }
    if (accountsByName.has(name)) {
      return name;
    }
    reassignedToDefaultAccount++;
    return defaultAccount.name;
  };

  const budgetsByKey = new Map<string, PlannedBudget>();
  for (const budget of data.budgets) {
    const isCategoryBudget = budget.budgetType === 'category';
    const categoryName = isCategoryBudget ? budget.category?.name : undefined;
    // A category budget without a category (or whose category is not in the
    // file) has nothing to attach to; drop it rather than import an orphan.
    if (isCategoryBudget && (!categoryName || !categoriesByKey.has(categoryKey('expense', categoryName)))) {
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

  let rejectedRefunds = 0;
  let refundCount = 0;
  const expenses: PlannedExpense[] = data.expenses.map(expense => {
    // Refunds in date order; each must fit what is left of the expense.
    let refundedUnits = 0;
    const refunds: PlannedRefund[] = [];
    for (const refund of [...(expense.refunds ?? [])].sort((a, b) => compareDateKeys(a.date, b.date, 1))) {
      const units = toMoneyUnits(refund.amount);
      if (dayOf(refund.date) < dayOf(expense.date) || refundedUnits + units > toMoneyUnits(expense.amount)) {
        rejectedRefunds++;
        continue;
      }
      refundedUnits += units;
      refunds.push({amount: refund.amount, date: refund.date, note: refund.note, ...timestampsOf(refund, now)});
    }
    refundCount += refunds.length;
    return {
      title: expense.title,
      amount: expense.amount,
      description: expense.description ?? '',
      categoryName: expense.category.name,
      date: expense.date,
      accountName: accountNameFor(expense.account),
      ...timestampsOf(expense, now),
      refunds,
    };
  });

  const incomes: PlannedIncome[] = data.incomes.map(income => ({
    amount: income.amount,
    date: income.date,
    note: income.note,
    categoryName: income.category.name,
    accountName: accountNameFor(income.account),
    ...timestampsOf(income, now),
  }));

  // Types were folded into the two the app knows by the schema, so no row can
  // land in a bucket that is counted but never shown (B7).
  const debts: PlannedDebt[] = data.debts.map(debt => ({
    amount: debt.amount,
    description: debt.description,
    debtorTitle: debt.debtor.title,
    date: debt.date,
    type: debt.type,
    ...timestampsOf(debt, now),
  }));

  // Auto-create anything referenced by an entry but missing from the
  // backup's own entity lists (e.g. the 'Unknown' sentinel exported for
  // dangling ids) — losing the entry would be far worse.
  let autoCreatedCategories = 0;
  const lastSortOrder = (kind: CategoryKind): number =>
    Math.max(0, ...[...categoriesByKey.values()].filter(c => c.kind === kind).map(c => c.sortOrder));
  const ensureCategory = (kind: CategoryKind, name: string): void => {
    const key = categoryKey(kind, name);
    if (!categoriesByKey.has(key)) {
      categoriesByKey.set(key, {
        name,
        kind,
        status: true,
        icon: DEFAULTS.icon,
        color: DEFAULTS.color,
        // after the file's own categories of its kind
        sortOrder: lastSortOrder(kind) + CATEGORY_SORT_STEP,
        autoCreated: true,
      });
      autoCreatedCategories++;
    }
  };
  expenses.forEach(expense => ensureCategory('expense', expense.categoryName));
  incomes.forEach(income => ensureCategory('income', income.categoryName));

  // Free has one income category (domain/freeTier). A file with more (an old
  // dev build, or an edited JSON) keeps the first one, active before archived
  // and then in its own order, and every money-in entry moves onto it. Nothing
  // is lost: an entry without a note keeps its old category's name as the note
  // ("Freelance"), so the row still says what it was. The restore summary says so.
  const incomeCategories = [...categoriesByKey.values()]
    .filter(c => c.kind === 'income')
    .sort((a, b) => Number(b.status) - Number(a.status) || a.sortOrder - b.sortOrder);
  const keptIncome = incomeCategories.slice(0, FREE_INCOME_CATEGORIES);
  const extraIncome = incomeCategories.slice(FREE_INCOME_CATEGORIES);
  const keeper = keptIncome[0];
  if (keeper && extraIncome.length > 0) {
    extraIncome.forEach(c => categoriesByKey.delete(categoryKey('income', c.name)));
    incomes.forEach(income => {
      if (income.categoryName !== keeper.name) {
        income.note = income.note || income.categoryName;
        income.categoryName = keeper.name;
      }
    });
  }

  // Money in always has an active category to land in: a file with none (every
  // backup made before v5) gets the default, and a lone archived one is made
  // active again; the app would otherwise have nowhere to put money in.
  if (!keeper) {
    categoriesByKey.set(categoryKey('income', DEFAULT_INCOME_CATEGORY_NAME), {
      name: DEFAULT_INCOME_CATEGORY_NAME,
      kind: 'income',
      status: true,
      icon: DEFAULT_INCOME_CATEGORY_ICON,
      color: DEFAULT_INCOME_CATEGORY_COLOR,
      sortOrder: sortOrderAt(0),
      autoCreated: false,
    });
  } else if (!keeper.status) {
    keeper.status = true;
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

  const categories = Array.from(categoriesByKey.values());
  const debtors = Array.from(debtorsByTitle.values());
  const currencies = Array.from(currenciesByCode.values());
  const accounts = Array.from(accountsByName.values());
  const budgets = Array.from(budgetsByKey.values());

  return {
    categories,
    debtors,
    currencies,
    accounts,
    budgets,
    expenses,
    incomes,
    debts,
    stats: {
      categories: categories.length,
      debtors: debtors.length,
      currencies: currencies.length,
      expenses: expenses.length,
      debts: debts.length,
      budgets: budgets.length,
      accounts: accounts.length,
      refunds: refundCount,
      incomes: incomes.length,
      autoCreatedCategories,
      autoCreatedDebtors,
      rejectedRefunds,
      reassignedToDefaultAccount,
      mergedIncomeCategories: keeper ? extraIncome.length : 0,
      incomeCategoryKept: keeper && extraIncome.length > 0 ? keeper.name : null,
    },
  };
};
