import {nanoid} from 'nanoid';
import type {Model} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {User} from '../database/models/User';
import {Category} from '../database/models/Category';
import {Expense} from '../database/models/Expense';
import {Currency} from '../database/models/Currency';
import {Debtor} from '../database/models/Debtor';
import {Debt} from '../database/models/Debt';
import {Budget} from '../database/models/Budget';
import {Account} from '../database/models/Account';
import {Refund} from '../database/models/Refund';
import {Income} from '../database/models/Income';
import {MODEL_CLASSES} from '../database/models/modelClasses';
import {defaultAccountId} from '../database/defaultAccount';
import {buildImportPlan, categoryKey, type ImportStats} from '../backup/import/planner';
import {sanitizeString} from '../../domain/sanitize';
import type {ExportData} from '../backup/export/format';
import {appendErrorLog} from '../../platform/errorLog';
import {DEFAULT_USER_NAME} from '../../i18n/displayNames';

interface ImportResult {
  userId: string;
  stats: ImportStats;
}

/**
 * Sets a record's timestamps from the plan inside its builder. WatermelonDB
 * stamps `now` before the builder runs, so these win; `@readonly` guards the
 * model property, not the raw column `_setRaw` writes.
 */
const keepTimestamps = (record: Model, stamps: {createdAt: number; updatedAt: number}): void => {
  record._setRaw('created_at', stamps.createdAt);
  record._setRaw('updated_at', stamps.updatedAt);
};

/**
 * Progress of a restore: the entity group being prepared, in write order;
 * 'writing' while the single batch runs (one synchronous native call, the
 * screen cannot update during it); 'committed' once it has landed. The
 * callback must not throw: a throw after 'committed' would report a restore
 * that already succeeded as failed.
 */
type ImportPhase =
  | 'user'
  | 'categories'
  | 'debtors'
  | 'currencies'
  | 'expenses'
  | 'incomes'
  | 'debts'
  | 'budgets'
  | 'writing'
  | 'committed';

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
    // Every table, from the registered models, so a new table cannot survive the wipe.
    const existing = await Promise.all(MODEL_CLASSES.map(model => database.get(model.table).query().fetch()));

    // Hydrates every existing row only to destroy it. It cannot leave the
    // transaction without giving up atomicity; on a re-import over a large
    // table this is the longest step before the first phase is reported.
    const destroys = existing.flat().map(record => record.prepareDestroyPermanently());

    onProgress?.('user');
    const newUser = database.get<User>('users').prepareCreate(user => {
      user._raw.id = userId;
      user.username = sanitizeString(username, DEFAULT_USER_NAME);
      user.email = sanitizeString(email, '');
    });

    await yieldToUi();
    onProgress?.('categories');
    const categoryIdByKey = new Map<string, string>();
    const newCategories = plan.categories.map(planned => {
      const id = nanoid(24);
      categoryIdByKey.set(categoryKey(planned.kind, planned.name), id);
      return database.get<Category>('categories').prepareCreate(cat => {
        cat._raw.id = id;
        cat.name = planned.name;
        cat.kind = planned.kind;
        cat.sortOrder = planned.sortOrder;
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
    // Accounts belong with the currency group on the progress list. The
    // default's id derives from the new user id, like on a fresh install.
    const accountIdByName = new Map<string, string>();
    const newAccounts = plan.accounts.map(planned => {
      const id = planned.isDefault ? defaultAccountId(userId) : nanoid(24);
      accountIdByName.set(planned.name, id);
      return database.get<Account>('accounts').prepareCreate(account => {
        account._raw.id = id;
        account.userId = userId;
        account.name = planned.name;
        account.type = planned.type;
        account.currency = planned.currency;
        account.openingBalance = planned.openingBalance;
        account.openingDate = planned.openingDate;
        account.isDefault = planned.isDefault;
        account.accountStatus = planned.accountStatus;
        account.sortOrder = planned.sortOrder;
        account.icon = planned.icon;
        account.color = planned.color;
      });
    });

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
    // Refunds are prepared with their expenses: each needs its expense's new id.
    const newExpenses = plan.expenses.map(planned =>
      database.get<Expense>('expenses').prepareCreate(expense => {
        expense.title = planned.title;
        expense.amount = planned.amount;
        expense.description = planned.description;
        expense.categoryId = idFor(categoryIdByKey, categoryKey('expense', planned.categoryName), 'category');
        expense.userId = userId;
        expense.date = planned.date;
        expense.accountId = idFor(accountIdByName, planned.accountName, 'account');
        keepTimestamps(expense, planned);
      }),
    );
    const newRefunds = plan.expenses.flatMap((planned, index) => {
      // same index: newExpenses was mapped from plan.expenses above
      const parent = newExpenses[index] as Expense;
      return planned.refunds.map(refund =>
        database.get<Refund>('refunds').prepareCreate(r => {
          r.userId = userId;
          r.expenseId = parent.id;
          r.accountId = parent.accountId;
          r.amount = refund.amount;
          r.date = refund.date;
          r.note = refund.note;
          keepTimestamps(r, refund);
        }),
      );
    });
    await yieldToUi();
    onProgress?.('incomes');
    const newIncomes = plan.incomes.map(planned =>
      database.get<Income>('incomes').prepareCreate(income => {
        income.userId = userId;
        income.categoryId = idFor(categoryIdByKey, categoryKey('income', planned.categoryName), 'category');
        income.accountId = idFor(accountIdByName, planned.accountName, 'account');
        income.amount = planned.amount;
        income.date = planned.date;
        income.note = planned.note;
        keepTimestamps(income, planned);
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
        keepTimestamps(debt, planned);
      }),
    );

    await yieldToUi();
    onProgress?.('budgets');
    const newBudgets = plan.budgets.map(planned =>
      database.get<Budget>('budgets').prepareCreate(budget => {
        budget.userId = userId;
        budget.categoryId = planned.categoryName
          ? idFor(categoryIdByKey, categoryKey('expense', planned.categoryName), 'category')
          : '';
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
      ...newAccounts,
      ...newExpenses,
      ...newRefunds,
      ...newIncomes,
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
