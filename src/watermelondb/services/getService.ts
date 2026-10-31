import {database} from '../database';
import User from '../models/User';
import Category from '../models/Category';
import Currency from '../models/Currency';
import Debtor from '../models/Debtor';
import Budget from '../models/Budget';
import {sanitizeString, DEFAULTS} from '../../utils/sanitize';
import {normalizeDebtType} from '../../utils/debtType';
import type {ExportDraft} from '../../backend/export/format';
import {appendErrorLog} from '../../utils/errorLog';
import {UNKNOWN_NAME} from '../../i18n/displayNames';

export type {ExportDraft} from '../../backend/export/format';

/**
 * Raw row shapes (column names) for the two big tables. They are read with
 * `unsafeFetchRaw` (L4, v2.7.1): the export only copies their fields, and
 * hydrating a Model per row at 10k rows was estimated at ~8 MB of transient
 * objects (FIX_PLAN L4; not measured in-repo).
 * Keep in step with schema.ts / models/Expense.ts / models/Debt.ts.
 */
interface RawExpenseRow {
  title: string;
  amount: number;
  description: string | null;
  category_id: string;
  date: string;
}
interface RawDebtRow {
  amount: number;
  description: string;
  debtor_id: string;
  date: string;
  type: string;
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
    const [users, categories, expenses, currencies, debtors, debts, budgets] = await Promise.all([
      database.get<User>('users').query().fetch(),
      database.get<Category>('categories').query().fetch(),
      expenseRows,
      database.get<Currency>('currencies').query().fetch(),
      database.get<Debtor>('debtors').query().fetch(),
      debtRows,
      database.get<Budget>('budgets').query().fetch(),
    ]);

    // Raw rows skip the model layer's column mapping, so a renamed column
    // would surface as `undefined` fields and a file full of "Unknown"
    // categories; fail loudly instead.
    assertColumns(expenses[0], ['title', 'amount', 'category_id', 'date'], 'expenses');
    assertColumns(debts[0], ['amount', 'description', 'debtor_id', 'date', 'type'], 'debts');

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
      categories: categories.map(c => ({
        name: c.name,
        categoryStatus: c.categoryStatus,
        icon: sanitizeString(c.icon, DEFAULTS.icon),
        color: sanitizeString(c.color, DEFAULTS.color),
      })),
      expenses: expenses.map(e => ({
        title: e.title,
        amount: e.amount,
        description: e.description ?? '',
        category: {name: categoryMap.get(e.category_id) ?? UNKNOWN_NAME},
        date: e.date,
      })),
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
    };
  } catch (error) {
    // Callers show the export-failed dialog; keep the cause in Diagnostics.
    appendErrorLog(error, false);
    return null;
  }
};
