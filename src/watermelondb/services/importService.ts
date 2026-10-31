import {nanoid} from 'nanoid';
import {database} from '../database';
import User from '../models/User';
import Category from '../models/Category';
import Expense from '../models/Expense';
import Currency from '../models/Currency';
import Debtor from '../models/Debtor';
import Debt from '../models/Debt';
import Budget from '../models/Budget';
import {buildImportPlan, type ImportStats} from '../../backend/import/planner';
import {sanitizeString} from '../../utils/sanitize';
import type {ExportData} from '../../backend/export/format';
import {appendErrorLog} from '../../utils/errorLog';
import {DEFAULT_USER_NAME} from '../../i18n/displayNames';

interface ImportResult {
  userId: string;
  stats: ImportStats;
}

/**
 * Progress of a restore: the entity group being prepared, in write order;
 * 'writing' while the single batch runs (one synchronous native call, the
 * screen cannot update during it); 'committed' once it has landed. The
 * callback must not throw: a throw after 'committed' would report a restore
 * that already succeeded as failed.
 */
type ImportPhase =
  'user' | 'categories' | 'debtors' | 'currencies' | 'expenses' | 'debts' | 'budgets' | 'writing' | 'committed';

/**
 * Lets the UI paint between the heavy synchronous steps of a large restore
 * (planning 20k rows, preparing 20k records). One macrotask, no work.
 */
const yieldToUi = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Restores a backup ATOMICALLY: wipe-existing + recreate-everything happen in
 * ONE database.write with ONE database.batch. If anything fails, the write
 * rolls back and the data that was on the device stays untouched — which is
 * what makes retrying an import safe.
 *
 * Do not replace the inlined wipe with deleteAllData(): WatermelonDB writers
 * do not nest, and a separate wipe-write would reintroduce the
 * half-imported-state bug this service exists to fix.
 */
export const importAllData = async (
  data: ExportData,
  onProgress?: (phase: ImportPhase) => void,
): Promise<ImportResult> => {
  await yieldToUi();
  const plan = buildImportPlan(data);
  const {username, email} = data.users[0];
  const userId = nanoid(24);

  await database.write(async () => {
    const [users, categories, expenses, currencies, debtors, debts, budgets] = await Promise.all([
      database.get<User>('users').query().fetch(),
      database.get<Category>('categories').query().fetch(),
      database.get<Expense>('expenses').query().fetch(),
      database.get<Currency>('currencies').query().fetch(),
      database.get<Debtor>('debtors').query().fetch(),
      database.get<Debt>('debts').query().fetch(),
      database.get<Budget>('budgets').query().fetch(),
    ]);

    // Hydrates every existing row only to destroy it. It cannot leave the
    // transaction without giving up atomicity; on a re-import over a large
    // table this is the longest step before the first phase is reported.
    const destroys = [...users, ...categories, ...expenses, ...currencies, ...debtors, ...debts, ...budgets].map(
      record => record.prepareDestroyPermanently(),
    );

    onProgress?.('user');
    const newUser = database.get<User>('users').prepareCreate(user => {
      user._raw.id = userId;
      user.username = sanitizeString(username, DEFAULT_USER_NAME);
      user.email = sanitizeString(email, '');
    });

    await yieldToUi();
    onProgress?.('categories');
    const categoryIdByName = new Map<string, string>();
    const newCategories = plan.categories.map(planned => {
      const id = nanoid(24);
      categoryIdByName.set(planned.name, id);
      return database.get<Category>('categories').prepareCreate(cat => {
        cat._raw.id = id;
        cat.name = planned.name;
        cat.categoryStatus = planned.status;
        cat.userId = userId;
        cat.icon = planned.icon;
        cat.color = planned.color;
      });
    });

    await yieldToUi();
    onProgress?.('debtors');
    const debtorIdByTitle = new Map<string, string>();
    const newDebtors = plan.debtors.map(planned => {
      const id = nanoid(24);
      debtorIdByTitle.set(planned.title, id);
      return database.get<Debtor>('debtors').prepareCreate(debtor => {
        debtor._raw.id = id;
        debtor.title = planned.title;
        debtor.type = planned.type;
        debtor.debtorStatus = planned.status;
        debtor.userId = userId;
        debtor.icon = planned.icon;
        debtor.color = planned.color;
      });
    });

    await yieldToUi();
    onProgress?.('currencies');
    const newCurrencies = plan.currencies.map(planned =>
      database.get<Currency>('currencies').prepareCreate(currency => {
        currency._raw.id = nanoid(24);
        currency.code = planned.code;
        currency.symbol = planned.symbol;
        currency.name = planned.name;
        currency.userId = userId;
      }),
    );

    await yieldToUi();
    onProgress?.('expenses');
    // The planner auto-creates every referenced category/debtor, so these
    // lookups cannot miss. If one ever does, throwing here rolls the whole
    // write back (L7); writing '' would silently orphan the row.
    const idFor = (map: Map<string, string>, name: string, kind: string): string => {
      const id = map.get(name);
      if (id === undefined) {
        // No name in the message: it reaches the error log, whose report promises no names (M8).
        throw new Error(`Import plan references a ${kind} that was not planned`);
      }
      return id;
    };
    const newExpenses = plan.expenses.map(planned =>
      database.get<Expense>('expenses').prepareCreate(expense => {
        expense.title = planned.title;
        expense.amount = planned.amount;
        expense.description = planned.description;
        expense.categoryId = idFor(categoryIdByName, planned.categoryName, 'category');
        expense.userId = userId;
        expense.date = planned.date;
      }),
    );

    await yieldToUi();
    onProgress?.('debts');
    const newDebts = plan.debts.map(planned =>
      database.get<Debt>('debts').prepareCreate(debt => {
        debt.amount = planned.amount;
        debt.description = planned.description;
        debt.debtorId = idFor(debtorIdByTitle, planned.debtorTitle, 'debtor');
        debt.userId = userId;
        debt.date = planned.date;
        debt.type = planned.type;
      }),
    );

    await yieldToUi();
    onProgress?.('budgets');
    const newBudgets = plan.budgets.map(planned =>
      database.get<Budget>('budgets').prepareCreate(budget => {
        budget.userId = userId;
        budget.categoryId = planned.categoryName ? idFor(categoryIdByName, planned.categoryName, 'category') : '';
        budget.amount = planned.amount;
        budget.month = planned.month;
        budget.budgetType = planned.budgetType;
      }),
    );

    await yieldToUi();
    onProgress?.('writing');
    await yieldToUi();
    // Deliberate exception to WatermelonDB's "pass prepared records to batch()
    // synchronously" guidance: the yields above only let the UI paint, the
    // writer lock is held throughout, and no prepareUpdate is involved (the
    // runtime check only covers that case).
    // ONE array, not a spread: a spread of 2×N records is a function call with
    // 2×N arguments, and WatermelonDB warns it can exceed the maximum call
    // stack on large imports. Same single transaction, same atomicity (L3).
    await database.batch([
      ...destroys,
      newUser,
      ...newCategories,
      ...newDebtors,
      ...newCurrencies,
      ...newExpenses,
      ...newDebts,
      ...newBudgets,
    ]);
  });
  try {
    onProgress?.('committed');
  } catch (error) {
    // The data is committed; a UI callback failure must not look like a failed restore.
    appendErrorLog(error, false);
  }

  return {userId, stats: plan.stats};
};
