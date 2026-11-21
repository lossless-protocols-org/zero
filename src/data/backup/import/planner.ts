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
 * - Every income category is kept, with its entries (3.0). Who is paying plays
 *   no part in a restore (law L1): a Free app restoring a Pro backup stores
 *   all of them and shows one (src/pro/projection.ts); the others wait in
 *   Settings → Pro data kept. 2.8 merged extras into the first; a 3.0 backup
 *   (envelope v6) is refused by 2.8 as too new, so 2.8 never meets one.
 * - Money in always has an ACTIVE income category to land in after a restore,
 *   as after createUser and the v5 upgrade (audit 2026-11-08 §4.1): a file
 *   with none gets the default 'Income'; a file whose income categories are
 *   all archived has its first one (domain/incomeCategories order) reactivated.
 * - v5: exactly one default account is planned (the file's, else a new
 *   'Cash'); entries naming no account or an unknown one land on it.
 * - v5: a refund that does not fit its expense (before its day, or more in
 *   total than the expense) is left out and counted in `rejectedRefunds`;
 *   its expense is kept.
 * - v5: an entry without `createdAt` gets it from its date, exactly as the
 *   database migration does (domain/isoEpoch.ts); `updatedAt` defaults to it.
 * - v6: a transfer, a checkpoint or a debt that names an account the file
 *   does not list makes that account (type 'other', counted in
 *   `autoCreatedAccounts`) rather than lose the row or move it onto another
 *   account, whose balance it would then be wrong for. An expense or income
 *   naming an unknown account still lands on the default, as in 2.8: its
 *   total is right either way.
 * - v6: a transfer whose two ends are the same account moves nothing; it is
 *   left out and counted in `rejectedTransfers`.
 * - v6: a debt without an account touched none, and stays so.
 */

import type {ExportData} from '../export/validate';
import {DEFAULTS, sanitizeString} from '../../../domain/sanitize';
import {epochFromIsoDate} from '../../../domain/isoEpoch';
import {toMoneyUnits} from '../../../domain/money';
import type {CategoryKind} from '../../../domain/types';
import {CATEGORY_SORT_STEP, sortOrderAt} from '../../../domain/categoryOrder';
import {DEFAULT_ACCOUNT_COLOR, DEFAULT_ACCOUNT_ICON, DEFAULT_ACCOUNT_NAME} from '../../database/defaultAccount';
import {UNKNOWN_NAME} from '../../../i18n/displayNames';
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

/** `accountName` null: the refund follows its expense's account (every refund before v6, and most after). */
type PlannedRefund = Omit<FileRefund, 'account' | 'createdAt' | 'updatedAt'> &
  Timestamps & {accountName: string | null};

type PlannedExpense = Omit<
  FileRow<'expenses'>,
  'description' | 'category' | 'account' | 'refunds' | 'recurring' | 'createdAt' | 'updatedAt'
> &
  Timestamps & {
    description: string;
    categoryName: string;
    accountName: string;
    refunds: PlannedRefund[];
    /** P9: the ref of the rule that made it, kept only when that rule is in the plan. */
    recurringRef: string | null;
  };

type PlannedIncome = Omit<FileRow<'incomes'>, 'category' | 'account' | 'recurring' | 'createdAt' | 'updatedAt'> &
  Timestamps & {
    categoryName: string;
    accountName: string;
    recurringRef: string | null;
  };

/** `type` is already a DebtType: the schema folds free-text types into the two. */
type PlannedDebt = Omit<FileRow<'debts'>, 'debtor' | 'account' | 'createdAt' | 'updatedAt'> &
  Timestamps & {
    debtorTitle: string;
    /** v6: the account the money moved through; null when none. */
    accountName: string | null;
  };

type PlannedTransfer = Omit<
  FileRow<'transfers'>,
  'fromAccount' | 'toAccount' | 'recurring' | 'createdAt' | 'updatedAt'
> &
  Timestamps & {
    fromAccountName: string;
    toAccountName: string;
    recurringRef: string | null;
  };

type PlannedCheckpoint = Omit<FileRow<'checkpoints'>, 'account' | 'createdAt' | 'updatedAt'> &
  Timestamps & {
    accountName: string;
  };

/** v6 (P9): a recurring rule. Its category (null for a transfer) and accounts by name. */
type PlannedRule = Omit<FileRow<'recurring'>, 'category' | 'account' | 'toAccount' | 'createdAt' | 'updatedAt'> &
  Timestamps & {
    categoryName: string | null;
    accountName: string;
    toAccountName: string | null;
  };

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
  transfers: number;
  checkpoints: number;
  /** v6: accounts a transfer, checkpoint or debt named that the file did not list. */
  autoCreatedAccounts: number;
  /** v6: transfers left out because both ends were the same account. */
  rejectedTransfers: number;
  /** v6 (P9): recurring rules. */
  recurringRules: number;
  /** v6 (P9): rules left out: a ref the file used twice, or a transfer rule whose ends are one account. */
  rejectedRules: number;
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
  transfers: PlannedTransfer[];
  checkpoints: PlannedCheckpoint[];
  recurring: PlannedRule[];
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
  // v6 references name their account outright; one the file does not list is made, not
  // swapped for another account (whose balance the row would then be wrong for).
  let autoCreatedAccounts = 0;
  const ensureAccount = (name: string): string => {
    if (!accountsByName.has(name)) {
      accountsByName.set(name, {
        name,
        type: 'other',
        currency: userCurrency,
        openingBalance: 0,
        openingDate: null,
        isDefault: false,
        accountStatus: true,
        sortOrder: Math.max(0, ...[...accountsByName.values()].map(a => a.sortOrder)) + CATEGORY_SORT_STEP,
        icon: DEFAULT_ACCOUNT_ICON,
        color: DEFAULT_ACCOUNT_COLOR,
      });
      autoCreatedAccounts++;
    }
    return name;
  };

  // Made before any entry is placed, so an expense or income naming one of these lands on it,
  // not on the default (the file names the account; only the list of accounts left it out).
  for (const row of data.debts) {
    if (row.account !== undefined) {
      ensureAccount(row.account);
    }
  }
  for (const row of data.transfers) {
    ensureAccount(row.fromAccount);
    ensureAccount(row.toAccount);
  }
  for (const row of data.checkpoints) {
    ensureAccount(row.account);
  }
  for (const expense of data.expenses) {
    for (const refund of expense.refunds ?? []) {
      if (refund.account !== undefined) {
        ensureAccount(refund.account);
      }
    }
  }
  for (const rule of data.recurring) {
    ensureAccount(rule.account);
    if (rule.toAccount !== undefined) {
      ensureAccount(rule.toAccount);
    }
  }

  // P9: rules by ref, first one wins; a transfer rule must name two different accounts.
  let rejectedRules = 0;
  const rulesByRef = new Map<string, PlannedRule>();
  for (const rule of data.recurring) {
    const isTransfer = rule.target === 'transfer';
    const toAccountName = isTransfer && rule.toAccount !== undefined ? rule.toAccount : null;
    if (rulesByRef.has(rule.ref) || (isTransfer && (toAccountName === null || toAccountName === rule.account))) {
      rejectedRules++;
      continue;
    }
    rulesByRef.set(rule.ref, {
      ref: rule.ref,
      target: rule.target,
      title: rule.title,
      categoryName: isTransfer ? null : (rule.category?.name ?? UNKNOWN_NAME),
      accountName: rule.account,
      toAccountName,
      amount: rule.amount,
      cadence: rule.cadence,
      interval: rule.interval,
      startDate: rule.startDate,
      endDate: rule.endDate,
      nextIndex: rule.nextIndex,
      remindDaysBefore: rule.remindDaysBefore,
      active: rule.active,
      ...timestampsOf({date: rule.startDate, createdAt: rule.createdAt, updatedAt: rule.updatedAt}, now),
    });
  }
  /** A made row keeps its rule only when that rule is coming in with it. */
  const ruleRefOf = (ref: string | undefined): string | null => (ref !== undefined && rulesByRef.has(ref) ? ref : null);

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
      refunds.push({
        amount: refund.amount,
        date: refund.date,
        note: refund.note,
        accountName: refund.account === undefined ? null : ensureAccount(refund.account),
        ...timestampsOf(refund, now),
      });
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
      recurringRef: ruleRefOf(expense.recurring),
    };
  });

  const incomes: PlannedIncome[] = data.incomes.map(income => ({
    amount: income.amount,
    date: income.date,
    note: income.note,
    categoryName: income.category.name,
    accountName: accountNameFor(income.account),
    ...timestampsOf(income, now),
    recurringRef: ruleRefOf(income.recurring),
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
    accountName: debt.account === undefined ? null : ensureAccount(debt.account),
  }));

  let rejectedTransfers = 0;
  const transfers: PlannedTransfer[] = data.transfers.flatMap(transfer => {
    const fromAccountName = ensureAccount(transfer.fromAccount);
    const toAccountName = ensureAccount(transfer.toAccount);
    if (fromAccountName === toAccountName) {
      rejectedTransfers++;
      return [];
    }
    return [
      {
        fromAccountName,
        toAccountName,
        amount: transfer.amount,
        date: transfer.date,
        note: transfer.note,
        ...timestampsOf(transfer, now),
        recurringRef: ruleRefOf(transfer.recurring),
      },
    ];
  });

  const checkpoints: PlannedCheckpoint[] = data.checkpoints.map(checkpoint => ({
    accountName: ensureAccount(checkpoint.account),
    balance: checkpoint.balance,
    date: checkpoint.date,
    gap: checkpoint.gap,
    kind: checkpoint.kind,
    note: checkpoint.note,
    ...timestampsOf(checkpoint, now),
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
  // A rule keeps its category, as an entry does (made if the file lacks it).
  for (const rule of rulesByRef.values()) {
    if (rule.categoryName !== null && rule.target !== 'transfer') {
      ensureCategory(rule.target, rule.categoryName);
    }
  }

  // Money in always has an active category to land in: a file with none (every
  // backup made before v5) gets the default, and one whose income categories are
  // all archived has the first of them made active again; the app would otherwise
  // have nowhere to put money in. Every income category and entry is kept as it was.
  const incomeCategories = [...categoriesByKey.values()]
    .filter(c => c.kind === 'income')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const firstIncome = incomeCategories[0];
  if (!firstIncome) {
    categoriesByKey.set(categoryKey('income', DEFAULT_INCOME_CATEGORY_NAME), {
      name: DEFAULT_INCOME_CATEGORY_NAME,
      kind: 'income',
      status: true,
      icon: DEFAULT_INCOME_CATEGORY_ICON,
      color: DEFAULT_INCOME_CATEGORY_COLOR,
      sortOrder: sortOrderAt(0),
      autoCreated: false,
    });
  } else if (!incomeCategories.some(c => c.status)) {
    firstIncome.status = true;
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
    transfers,
    checkpoints,
    recurring: [...rulesByRef.values()],
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
      transfers: transfers.length,
      checkpoints: checkpoints.length,
      autoCreatedAccounts,
      rejectedTransfers,
      recurringRules: rulesByRef.size,
      rejectedRules,
    },
  };
};
