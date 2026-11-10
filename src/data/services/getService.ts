import {database} from '../database/database';
import {User} from '../database/models/User';
import {Category} from '../database/models/Category';
import {Currency} from '../database/models/Currency';
import {Debtor} from '../database/models/Debtor';
import {Budget} from '../database/models/Budget';
import {Account} from '../database/models/Account';
import {toCategoryKind} from './categoryKind';
import {sanitizeString, DEFAULTS} from '../../domain/sanitize';
import {normalizeDebtType} from '../../domain/debtType';
import {compareDateKeys} from '../../domain/dates';
import type {ExportDraft} from '../backup/export/format';
import {appendErrorLog} from '../../platform/errorLog';
import {UNKNOWN_NAME} from '../../i18n/displayNames';

export type {ExportDraft} from '../backup/export/format';

/**
 * Raw row shapes (column names) for the two big tables. They are read with
 * `unsafeFetchRaw` (L4, v2.7.1): the export only copies their fields, and
 * hydrating a Model per row at 10k rows was estimated at ~8 MB of transient
 * objects (FIX_PLAN L4; not measured in-repo).
 * Keep in step with schema.ts / models/Expense.ts / models/Debt.ts.
 */
interface RawExpenseRow {
  id: string;
  title: string;
  amount: number;
  description: string | null;
  category_id: string;
  date: string;
  account_id: string;
  created_at: number;
  updated_at: number;
}
interface RawDebtRow {
  amount: number;
  description: string;
  debtor_id: string;
  date: string;
  type: string;
  created_at: number;
  updated_at: number;
}
interface RawRefundRow {
  expense_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: number;
  updated_at: number;
}
interface RawIncomeRow {
  category_id: string;
  account_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: number;
  updated_at: number;
}

const assertColumns = (row: object | undefined, columns: readonly string[], table: string): void => {
  if (!row) {
    return;
  }
  const missing = columns.filter(column => !(column in row));
  if (missing.length > 0) {
    throw new Error(`Raw ${table} row lacks column(s) ${missing.join(', ')} — schema drifted from getService`);
  }
};

/**
 * Gets all data from the database in a format suitable for export/import.
 * Sanitizes all values before returning.
 */
export const getAllData = async (): Promise<ExportDraft | null> => {
  try {
    // unsafeFetchRaw is typed any[]; the row shapes above are what schema.ts
    // defines, and exportRoundTrip.test.ts proves the output byte for byte.
    const expenseRows: Promise<RawExpenseRow[]> = database.get('expenses').query().unsafeFetchRaw();
    const debtRows: Promise<RawDebtRow[]> = database.get('debts').query().unsafeFetchRaw();
    const refundRows: Promise<RawRefundRow[]> = database.get('refunds').query().unsafeFetchRaw();
    const incomeRows: Promise<RawIncomeRow[]> = database.get('incomes').query().unsafeFetchRaw();
    const [users, categories, expenses, currencies, debtors, debts, budgets, accounts, refunds, incomes] =
      await Promise.all([
        database.get<User>('users').query().fetch(),
        database.get<Category>('categories').query().fetch(),
        expenseRows,
        database.get<Currency>('currencies').query().fetch(),
        database.get<Debtor>('debtors').query().fetch(),
        debtRows,
        database.get<Budget>('budgets').query().fetch(),
        database.get<Account>('accounts').query().fetch(),
        refundRows,
        incomeRows,
      ]);

    // Raw rows skip the model layer's column mapping, so a renamed column
    // would surface as `undefined` fields and a file full of "Unknown"
    // categories; fail loudly instead.
    assertColumns(
      expenses[0],
      ['id', 'title', 'amount', 'category_id', 'date', 'account_id', 'created_at'],
      'expenses',
    );
    assertColumns(debts[0], ['amount', 'description', 'debtor_id', 'date', 'type', 'created_at'], 'debts');
    assertColumns(refunds[0], ['expense_id', 'amount', 'date', 'note', 'created_at'], 'refunds');
    assertColumns(incomes[0], ['category_id', 'account_id', 'amount', 'date', 'note', 'created_at'], 'incomes');

    // Accounts are referenced by name; entries on the default account omit it.
    const accountNameById = new Map(accounts.map(a => [a.id, a.name]));
    const defaultAccountIds = new Set(accounts.filter(a => a.isDefault).map(a => a.id));
    const accountRef = (accountId: string): string | undefined =>
      defaultAccountIds.has(accountId) ? undefined : accountNameById.get(accountId);

    // Refunds travel nested in their expense (export v5), oldest first.
    const refundsByExpense = new Map<string, RawRefundRow[]>();
    for (const refund of refunds) {
      const list = refundsByExpense.get(refund.expense_id) ?? [];
      list.push(refund);
      refundsByExpense.set(refund.expense_id, list);
    }

    const categoryMap = new Map<string, string>();
    categories.forEach(c => {
      categoryMap.set(c.id, c.name);
    });

    const debtorMap = new Map<string, string>();
    debtors.forEach(d => {
      debtorMap.set(d.id, d.title);
    });

    return {
      users: users.map(u => ({
        username: u.username,
        email: u.email,
      })),
      // Key order everywhere below is validate.ts's schema order, so an
      // export → import → export round trip is byte-identical.
      categories: categories.map(c => ({
        name: c.name,
        categoryStatus: c.categoryStatus,
        icon: sanitizeString(c.icon, DEFAULTS.icon),
        color: sanitizeString(c.color, DEFAULTS.color),
        kind: toCategoryKind(c.kind),
        sortOrder: c.sortOrder,
      })),
      expenses: expenses.map(e => {
        const ownRefunds = (refundsByExpense.get(e.id) ?? []).sort((a, b) => compareDateKeys(a.date, b.date, 1));
        return {
          title: e.title,
          amount: e.amount,
          description: e.description ?? '',
          category: {name: categoryMap.get(e.category_id) ?? UNKNOWN_NAME},
          date: e.date,
          account: accountRef(e.account_id),
          createdAt: e.created_at,
          updatedAt: e.updated_at,
          refunds:
            ownRefunds.length === 0
              ? undefined
              : ownRefunds.map(r => ({
                  amount: r.amount,
                  date: r.date,
                  note: r.note ?? '',
                  createdAt: r.created_at,
                  updatedAt: r.updated_at,
                })),
        };
      }),
      currencies: currencies.map(c => ({
        code: c.code,
        symbol: c.symbol,
        name: c.name,
      })),
      debtors: debtors.map(d => ({
        title: d.title,
        debtorStatus: d.debtorStatus,
        icon: sanitizeString(d.icon, DEFAULTS.icon),
        type: d.type ?? DEFAULTS.type,
        color: sanitizeString(d.color, DEFAULTS.color),
      })),
      debts: debts.map(d => ({
        amount: d.amount,
        description: d.description,
        debtor: {title: debtorMap.get(d.debtor_id) ?? UNKNOWN_NAME},
        date: d.date,
        type: normalizeDebtType(d.type),
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })),
      // Per-category budgets carry their category NAME (ids are minted fresh on
      // import). One whose category no longer exists has nothing to attach to
      // and is left out rather than imported as an orphan.
      budgets: budgets.flatMap(b => {
        if (b.budgetType === 'category') {
          const name = b.categoryId ? categoryMap.get(b.categoryId) : undefined;
          if (!name) {
            return [];
          }
          return [{amount: b.amount, month: b.month, budgetType: b.budgetType, category: {name}}];
        }
        return [{amount: b.amount, month: b.month, budgetType: b.budgetType}];
      }),
      accounts: accounts.map(a => ({
        name: a.name,
        type: a.type,
        currency: a.currency,
        openingBalance: a.openingBalance,
        openingDate: a.openingDate,
        isDefault: a.isDefault,
        accountStatus: a.accountStatus,
        sortOrder: a.sortOrder,
        icon: a.icon,
        color: a.color,
      })),
      incomes: incomes.map(i => ({
        amount: i.amount,
        date: i.date,
        category: {name: categoryMap.get(i.category_id) ?? UNKNOWN_NAME},
        note: i.note ?? '',
        account: accountRef(i.account_id),
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      })),
    };
  } catch (error) {
    // Callers show the export-failed dialog; keep the cause in Diagnostics.
    appendErrorLog(error, false);
    return null;
  }
};
