/**
 * Writes are patches (3.0 law L6, handbook/blueprint/ZERO_3.0_ENTITLEMENT.md).
 * An edit changes the fields it was given and nothing else on the row. From
 * 3.0 a free screen edits rows that carry fields it does not show (the
 * account, later tags and the recurring rule); a service that rebuilt the row
 * from the form would wipe them, silently, and nobody would know until the
 * user paid again.
 *
 * Every column of every table is compared before and after, from the schema,
 * so a column added later is covered the day it is added: it must be filled
 * by the seed below and must survive every edit that does not name it. Every
 * exported `update…` service must be listed here, and every table must have
 * at least one writer listed.
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import type {Category} from '../../src/data/database/models/Category';
import {database} from '../../src/data/database/database';
import {schema} from '../../src/data/database/schema';
import {defaultAccountId} from '../../src/data/database/defaultAccount';
import {defaultIncomeCategoryId} from '../../src/data/database/defaultIncomeCategory';
import {createUser, setMonthStartDay, updateUserById} from '../../src/data/services/userService';
import {createCurrency, updateCurrencyById} from '../../src/data/services/currencyService';
import {
  createCategory,
  ensureIncomeCategory,
  reorderCategories,
  softDeleteCategoryById,
  updateCategoryById,
} from '../../src/data/services/categoryService';
import {createExpense, updateExpenseById} from '../../src/data/services/expenseService';
import {createIncome, updateIncome} from '../../src/data/services/incomeService';
import {createRefund, updateRefund} from '../../src/data/services/refundService';
import {createDebtor, updateDebtorById} from '../../src/data/services/debtorService';
import {createDebt, updateDebtById} from '../../src/data/services/debtService';
import {upsertBudget} from '../../src/data/services/budgetService';
import {createTransfer, updateTransfer} from '../../src/data/services/transferService';
import {createRule, setRulePaused, updateRule} from '../../src/data/services/recurringService';
import {createCheckpoint, updateCheckpoint} from '../../src/data/services/checkpointService';
import {
  createAccount,
  renameAccountKind,
  setAccountArchived,
  setDefaultAccount,
  updateAccount,
} from '../../src/data/services/accountService';
import {fromRoot} from '../harness/paths';
import {seedCategory} from '../harness/seedCategory';

type Raw = Record<string, unknown>;

/** Maintained by WatermelonDB on every update; every other column must be accounted for. */
const UPDATED_AT = 'updated_at';

const columnsOf = (table: string): string[] => {
  const columns = schema.tables[table]?.columnArray;
  if (!columns) {
    throw new Error(`no such table: ${table}`);
  }
  return ['id', ...columns.map(column => column.name)];
};

const rawOf = async (table: string, id: string): Promise<Raw> => {
  const record = await database.get(table).find(id);
  // A copy of the stored row; `_raw` is the record's own plain object of column values.
  return {...(record._raw as unknown as Raw)};
};

/** The columns whose stored value differs, apart from updated_at. */
const changedColumns = (table: string, before: Raw, after: Raw): string[] =>
  columnsOf(table)
    .filter(column => column !== UPDATED_AT && !Object.is(before[column], after[column]))
    .sort();

interface Seeded {
  /** The row the writer edits. */
  id: string;
  /** One call per thing the writer can change, with the columns that call may touch. */
  patches: Record<string, {apply: () => Promise<void>; columns: string[]}>;
  /** The same call with nothing to change, where the writer has one. */
  empty?: () => Promise<void>;
}

interface Writer {
  /** The exported service function. */
  fn: string;
  table: string;
  /** Columns the service legitimately leaves empty on the seeded row. */
  mayBeEmpty?: string[];
  seed: () => Promise<Seeded>;
}

const WHEN = '2026-11-05T10:00:00';
const LATER = '2026-11-06T11:30:00';

const seedUser = async (): Promise<{userId: string; currencyId: string; food: string; travel: string}> => {
  const userId = await createUser('Asha', 'asha@example.com');
  const currencyId = await createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await createCategory('Food', userId, 'pizza', '#111111', 'expense');
  const travel = await createCategory('Travel', userId, 'car', '#222222', 'expense');
  return {userId, currencyId, food, travel};
};

/** An account of the user's own beside the default, as Pro makes one (P8): every column filled. */
const seedAccount = (userId: string, name: string): Promise<string> =>
  createAccount(userId, {
    name,
    type: 'bank',
    openingBalance: 100,
    openingDate: '2026-01-01',
    icon: 'landmark',
    color: '#224466',
    kind: 'Salary',
  });

/** A rule of the user's (P9), so a seeded row can carry a real recurring_id that an edit must keep. */
const seedRule = (userId: string, categoryId: string, accountId: string): Promise<string> =>
  createRule(
    userId,
    {
      target: 'expense',
      title: 'Gym',
      categoryId,
      accountId,
      toAccountId: null,
      amount: 999,
      cadence: 'monthly',
      interval: 1,
      startDate: '2026-11-02',
      endDate: '2027-11-02',
      remindDaysBefore: 2,
    },
    '2026-11-02',
  );

/** Marks a row as made by a rule, as the materialiser writes it (every column then filled). */
const linkToRule = async (table: string, id: string, ruleId: string): Promise<void> => {
  await database.write(async () => {
    const record = await database.get(table).find(id);
    await record.update(r => {
      (r._raw as unknown as {recurring_id: string}).recurring_id = ruleId;
    });
  });
};

const WRITERS: Writer[] = [
  {
    fn: 'updateUserById',
    table: 'users',
    seed: async () => {
      const {userId} = await seedUser();
      // P11: a chosen month start day, so an edit that wiped it would show.
      await setMonthStartDay(userId, 7);
      return {
        id: userId,
        empty: () => updateUserById(userId, {}),
        patches: {
          username: {apply: () => updateUserById(userId, {username: 'Bela'}), columns: ['username']},
          email: {apply: () => updateUserById(userId, {email: 'bela@example.com'}), columns: ['email']},
        },
      };
    },
  },
  {
    fn: 'setMonthStartDay',
    table: 'users',
    seed: async () => {
      const {userId} = await seedUser();
      await setMonthStartDay(userId, 7);
      return {
        id: userId,
        // The same day again: nothing changes.
        empty: () => setMonthStartDay(userId, 7),
        patches: {
          monthStartDay: {apply: () => setMonthStartDay(userId, 15), columns: ['month_start_day']},
        },
      };
    },
  },
  {
    fn: 'updateCurrencyById',
    table: 'currencies',
    seed: async () => {
      const {currencyId} = await seedUser();
      return {
        id: currencyId,
        empty: () => updateCurrencyById(currencyId, {}),
        patches: {
          code: {apply: () => updateCurrencyById(currencyId, {code: 'PHP'}), columns: ['code']},
          symbol: {apply: () => updateCurrencyById(currencyId, {symbol: '₱'}), columns: ['symbol']},
          name: {apply: () => updateCurrencyById(currencyId, {name: 'Philippine Peso'}), columns: ['name']},
        },
      };
    },
  },
  {
    // The currency edit also relabels the user's accounts: their `currency`, and only that.
    fn: 'updateCurrencyById',
    table: 'accounts',
    // The default account opens on no particular day.
    // The default account, as the app makes it: no opening date, and no kind of the user's own.
    mayBeEmpty: ['opening_date', 'kind'],
    seed: async () => {
      const {userId, currencyId} = await seedUser();
      return {
        id: defaultAccountId(userId),
        empty: () => updateCurrencyById(currencyId, {}),
        patches: {
          code: {apply: () => updateCurrencyById(currencyId, {code: 'PHP'}), columns: ['currency']},
          symbol: {apply: () => updateCurrencyById(currencyId, {symbol: '₱'}), columns: []},
        },
      };
    },
  },
  {
    fn: 'updateCategoryById',
    table: 'categories',
    seed: async () => {
      const {food} = await seedUser();
      return {
        id: food,
        empty: () => updateCategoryById(food),
        patches: {
          name: {apply: () => updateCategoryById(food, 'Groceries'), columns: ['name']},
          icon: {apply: () => updateCategoryById(food, undefined, 'apple'), columns: ['icon']},
          color: {apply: () => updateCategoryById(food, undefined, undefined, '#999999'), columns: ['color']},
        },
      };
    },
  },
  {
    fn: 'softDeleteCategoryById',
    table: 'categories',
    seed: async () => {
      const {food} = await seedUser();
      return {
        id: food,
        patches: {archive: {apply: () => softDeleteCategoryById(food), columns: ['category_status']}},
      };
    },
  },
  {
    fn: 'reorderCategories',
    table: 'categories',
    seed: async () => {
      const {userId, food, travel} = await seedUser();
      return {
        id: food,
        patches: {
          order: {apply: () => reorderCategories(userId, 'expense', [travel, food]), columns: ['sort_order']},
        },
      };
    },
  },
  {
    // The repair that makes money in possible again when every income category is archived.
    fn: 'ensureIncomeCategory',
    table: 'categories',
    seed: async () => {
      const {userId} = await seedUser();
      const id = defaultIncomeCategoryId(userId);
      await database.write(async () => {
        const category = await database.get<Category>('categories').find(id);
        await category.update(c => {
          c.categoryStatus = false;
        });
      });
      return {
        id,
        patches: {
          reactivate: {
            apply: async () => {
              expect(await ensureIncomeCategory(userId)).toBe(true);
            },
            columns: ['category_status'],
          },
        },
      };
    },
  },
  {
    fn: 'updateExpenseById',
    table: 'expenses',
    seed: async () => {
      const {userId, food, travel} = await seedUser();
      const savings = await seedAccount(userId, 'Savings');
      const id = await createExpense(userId, 'Lunch', 250, 'with Ravi', food, WHEN);
      await linkToRule('expenses', id, await seedRule(userId, food, savings));
      return {
        id,
        empty: () => updateExpenseById(id),
        patches: {
          category: {apply: () => updateExpenseById(id, travel), columns: ['category_id']},
          title: {apply: () => updateExpenseById(id, undefined, 'Dinner'), columns: ['title']},
          amount: {apply: () => updateExpenseById(id, undefined, undefined, 300), columns: ['amount']},
          description: {
            apply: () => updateExpenseById(id, undefined, undefined, undefined, 'alone'),
            columns: ['description'],
          },
          date: {
            apply: () => updateExpenseById(id, undefined, undefined, undefined, undefined, LATER),
            columns: ['date'],
          },
          account: {
            apply: () => updateExpenseById(id, undefined, undefined, undefined, undefined, undefined, savings),
            columns: ['account_id'],
          },
        },
      };
    },
  },
  {
    fn: 'updateIncome',
    table: 'incomes',
    seed: async () => {
      const {userId, food} = await seedUser();
      const salary = defaultIncomeCategoryId(userId);
      // A second income category, as a restored Pro backup brings.
      await seedCategory(database, 'bonus', {userId, kind: 'income', name: 'Bonus'});
      const bonus = 'bonus';
      const savings = await seedAccount(userId, 'Savings');
      const id = await createIncome(userId, {categoryId: salary, amount: 40_000, date: '2026-11-01', note: 'November'});
      await linkToRule('incomes', id, await seedRule(userId, food, savings));
      return {
        id,
        empty: () => updateIncome(id, {}),
        patches: {
          category: {apply: () => updateIncome(id, {categoryId: bonus}), columns: ['category_id']},
          amount: {apply: () => updateIncome(id, {amount: 41_000}), columns: ['amount']},
          date: {apply: () => updateIncome(id, {date: '2026-11-02'}), columns: ['date']},
          note: {apply: () => updateIncome(id, {note: 'late'}), columns: ['note']},
          account: {apply: () => updateIncome(id, {accountId: savings}), columns: ['account_id']},
        },
      };
    },
  },
  {
    fn: 'updateRefund',
    table: 'refunds',
    seed: async () => {
      const {userId, food} = await seedUser();
      const savings = await seedAccount(userId, 'Savings');
      const expenseId = await createExpense(userId, 'Shoes', 2000, 'online', food, WHEN);
      const id = await createRefund(expenseId, {amount: 500, date: LATER, note: 'wrong size'});
      return {
        id,
        empty: () => updateRefund(id, {}),
        patches: {
          amount: {apply: () => updateRefund(id, {amount: 600}), columns: ['amount']},
          date: {apply: () => updateRefund(id, {date: '2026-11-07T09:00:00'}), columns: ['date']},
          note: {apply: () => updateRefund(id, {note: 'returned'}), columns: ['note']},
          account: {apply: () => updateRefund(id, {accountId: savings}), columns: ['account_id']},
        },
      };
    },
  },
  {
    fn: 'updateDebtorById',
    table: 'debtors',
    seed: async () => {
      const {userId} = await seedUser();
      const id = await createDebtor('Rohit', userId, 'user', 'Person', '#555555');
      return {
        id,
        empty: () => updateDebtorById(id),
        patches: {
          title: {apply: () => updateDebtorById(id, 'Yuva'), columns: ['title']},
          type: {apply: () => updateDebtorById(id, undefined, 'Other Accounts'), columns: ['type']},
          icon: {apply: () => updateDebtorById(id, undefined, undefined, 'landmark'), columns: ['icon']},
          color: {
            apply: () => updateDebtorById(id, undefined, undefined, undefined, '#666666'),
            columns: ['color'],
          },
        },
      };
    },
  },
  {
    fn: 'updateDebtById',
    table: 'debts',
    seed: async () => {
      const {userId} = await seedUser();
      const debtorId = await createDebtor('Rohit', userId, 'user', 'Person', '#555555');
      // v6: through an account, so an edit that does not name it must leave it.
      const accountId = await seedAccount(userId, 'Savings');
      const card = await seedAccount(userId, 'Card');
      const id = await createDebt(userId, 1800, 'Movie tickets', debtorId, WHEN, 'Lend', {accountId});
      return {
        id,
        empty: () => updateDebtById(id),
        patches: {
          amount: {apply: () => updateDebtById(id, 1900), columns: ['amount']},
          description: {apply: () => updateDebtById(id, undefined, 'Concert'), columns: ['description']},
          date: {apply: () => updateDebtById(id, undefined, undefined, LATER), columns: ['date']},
          type: {apply: () => updateDebtById(id, undefined, undefined, undefined, 'Borrow'), columns: ['type']},
          account: {
            apply: () => updateDebtById(id, undefined, undefined, undefined, undefined, card),
            columns: ['account_id'],
          },
          noAccount: {
            apply: () => updateDebtById(id, undefined, undefined, undefined, undefined, null),
            columns: ['account_id'],
          },
        },
      };
    },
  },
  {
    fn: 'updateTransfer',
    table: 'transfers',
    seed: async () => {
      const {userId, food} = await seedUser();
      const savings = await seedAccount(userId, 'Savings');
      const card = await seedAccount(userId, 'Card');
      const cash = defaultAccountId(userId);
      const id = await createTransfer(userId, {
        fromAccountId: cash,
        toAccountId: savings,
        amount: 750,
        date: '2026-11-06',
        note: 'to savings',
      });
      await linkToRule('transfers', id, await seedRule(userId, food, savings));
      return {
        id,
        empty: () => updateTransfer(id, {}),
        patches: {
          from: {apply: () => updateTransfer(id, {fromAccountId: card}), columns: ['from_account_id']},
          to: {apply: () => updateTransfer(id, {toAccountId: card}), columns: ['to_account_id']},
          amount: {apply: () => updateTransfer(id, {amount: 800}), columns: ['amount']},
          date: {apply: () => updateTransfer(id, {date: '2026-11-07'}), columns: ['date']},
          note: {apply: () => updateTransfer(id, {note: 'rent'}), columns: ['note']},
        },
      };
    },
  },
  {
    fn: 'updateCheckpoint',
    table: 'checkpoints',
    seed: async () => {
      const {userId} = await seedUser();
      const savings = await seedAccount(userId, 'Savings');
      const card = await seedAccount(userId, 'Card');
      const id = await createCheckpoint(userId, {
        accountId: savings,
        balance: 1200,
        date: '2026-11-08',
        gap: -30.5,
        kind: 'adjustment',
        note: 'statement',
      });
      return {
        id,
        empty: () => updateCheckpoint(id, {}),
        patches: {
          account: {apply: () => updateCheckpoint(id, {accountId: card}), columns: ['account_id']},
          balance: {apply: () => updateCheckpoint(id, {balance: -50}), columns: ['balance']},
          date: {apply: () => updateCheckpoint(id, {date: '2026-11-09'}), columns: ['date']},
          gap: {apply: () => updateCheckpoint(id, {gap: 12}), columns: ['gap']},
          kind: {apply: () => updateCheckpoint(id, {kind: 'revaluation'}), columns: ['kind']},
          note: {apply: () => updateCheckpoint(id, {note: 'broker'}), columns: ['note']},
        },
      };
    },
  },
  {
    fn: 'updateAccount',
    table: 'accounts',
    seed: async () => {
      const {userId} = await seedUser();
      const id = await seedAccount(userId, 'Savings');
      return {
        id,
        empty: () => updateAccount(id, {}),
        patches: {
          name: {apply: () => updateAccount(id, {name: 'Salary account'}), columns: ['name']},
          type: {apply: () => updateAccount(id, {type: 'wallet'}), columns: ['type']},
          opening: {apply: () => updateAccount(id, {openingBalance: -20}), columns: ['opening_balance']},
          openingDate: {apply: () => updateAccount(id, {openingDate: '2026-02-01'}), columns: ['opening_date']},
          icon: {apply: () => updateAccount(id, {icon: 'piggy-bank'}), columns: ['icon']},
          color: {apply: () => updateAccount(id, {color: '#777777'}), columns: ['color']},
          kind: {apply: () => updateAccount(id, {kind: 'Joint'}), columns: ['kind']},
        },
      };
    },
  },
  {
    fn: 'renameAccountKind',
    table: 'accounts',
    seed: async () => {
      const {userId} = await seedUser();
      const id = await seedAccount(userId, 'Savings');
      return {
        id,
        // The word it already has: nothing to write.
        empty: () => renameAccountKind(userId, 'spend', [id], 'Salary'),
        patches: {rename: {apply: () => renameAccountKind(userId, 'spend', [id], 'Joint'), columns: ['kind']}},
      };
    },
  },
  {
    fn: 'setAccountArchived',
    table: 'accounts',
    seed: async () => {
      const {userId} = await seedUser();
      const id = await seedAccount(userId, 'Savings');
      return {
        id,
        patches: {archive: {apply: () => setAccountArchived(id, true), columns: ['account_status']}},
      };
    },
  },
  {
    fn: 'setDefaultAccount',
    table: 'accounts',
    seed: async () => {
      const {userId} = await seedUser();
      const id = await seedAccount(userId, 'Savings');
      return {
        id,
        empty: () => setDefaultAccount(defaultAccountId(userId)),
        patches: {makeDefault: {apply: () => setDefaultAccount(id), columns: ['is_default']}},
      };
    },
  },
  {
    fn: 'updateRule',
    table: 'recurring_rules',
    seed: async () => {
      const {userId} = await seedUser();
      const savings = await seedAccount(userId, 'Savings');
      const card = await seedAccount(userId, 'Card');
      // A transfer rule fills to_account_id; its category is '' (empty by design).
      const id = await createRule(
        userId,
        {
          target: 'transfer',
          title: 'SIP',
          categoryId: '',
          accountId: savings,
          toAccountId: card,
          amount: 500,
          cadence: 'monthly',
          interval: 1,
          startDate: '2026-11-02',
          endDate: '2027-11-02',
          remindDaysBefore: 1,
        },
        '2026-11-02',
      );
      const today = '2026-11-02';
      return {
        id,
        empty: () => updateRule(id, {}, today),
        patches: {
          title: {apply: () => updateRule(id, {title: 'Index SIP'}, today), columns: ['title']},
          amount: {apply: () => updateRule(id, {amount: 600}, today), columns: ['amount']},
          to: {apply: () => updateRule(id, {toAccountId: defaultAccountId(userId)}, today), columns: ['to_account_id']},
          end: {apply: () => updateRule(id, {endDate: '2027-12-02'}, today), columns: ['end_date']},
          remind: {apply: () => updateRule(id, {remindDaysBefore: 3}, today), columns: ['remind_days_before']},
          // A new schedule starts again from today: where it is next moves with it.
          interval: {
            apply: () => updateRule(id, {interval: 2}, today),
            columns: ['interval'],
          },
        },
      };
    },
    mayBeEmpty: ['category_id'],
  },
  {
    fn: 'setRulePaused',
    table: 'recurring_rules',
    mayBeEmpty: ['category_id'],
    seed: async () => {
      const {userId} = await seedUser();
      const savings = await seedAccount(userId, 'Savings');
      const card = await seedAccount(userId, 'Card');
      const id = await createRule(
        userId,
        {
          target: 'transfer',
          title: 'SIP',
          categoryId: '',
          accountId: savings,
          toAccountId: card,
          amount: 500,
          cadence: 'monthly',
          interval: 1,
          startDate: '2026-11-02',
          endDate: '2027-11-02',
          remindDaysBefore: 1,
        },
        '2026-11-02',
      );
      return {id, patches: {pause: {apply: () => setRulePaused(id, true), columns: ['rule_status']}}};
    },
  },
  {
    fn: 'upsertBudget',
    table: 'budgets',
    seed: async () => {
      const {userId, food} = await seedUser();
      const scope = {budgetType: 'category', categoryId: food} as const;
      const month = {kind: 'month', yearMonth: '2026-11'} as const;
      const id = await upsertBudget(userId, 5000, month, scope);
      return {
        id,
        patches: {
          amount: {
            apply: async () => {
              // The same month and scope: the existing row is edited, not a second one made.
              expect(await upsertBudget(userId, 6000, month, scope)).toBe(id);
            },
            columns: ['amount'],
          },
        },
      };
    },
  },
];

/**
 * Every place under src/data that edits an existing row, by file. A new one fails here until
 * it has a writer above (or, for a shipped one-off repair, a reason on its line).
 */
const EDIT_SITES: Record<string, number> = {
  // updateUserById; P11: setMonthStartDay (one column, tested by userService.monthStart.test.ts).
  'services/userService.ts': 2,
  'services/currencyService.ts': 1,
  // P9: updateRule, setRulePaused, startFromToday, the rule moving on after a made row (prepareAdvance),
  // and deleteRule taking the link off the rows a rule made. Tested by recurringService.test.ts.
  'services/recurringService.ts': 5,
  // P9: removing Pro data takes the link to a rule off made rows (recurringFold.test.ts).
  'services/recurringFold.ts': 1,
  // P11: removing Pro data clears the month start day (monthStartFold.test.ts).
  'services/monthStartFold.ts': 1,
  // The relabel inside updateCurrencyById; updateAccount; setAccountArchived; setDefaultAccount; renameAccountKind.
  'services/accountService.ts': 5,
  'services/categoryService.ts': 4, // update, archive, reorder, ensureIncomeCategory
  'services/expenseService.ts': 1,
  'services/incomeService.ts': 1,
  'services/refundService.ts': 1,
  'services/debtorService.ts': 1,
  'services/debtService.ts': 1,
  'services/transferService.ts': 1,
  'services/checkpointService.ts': 1,
  'services/budgetService.ts': 1,
  // Pro data kept (law L9): folding extra income categories in, only on the user's own request.
  // Tested by __tests__/unit/data/services/incomeCategoryFold.test.ts (note and category only).
  'services/incomeCategoryFold.ts': 1,
  // Accounts, transfers and checkpoints (P8): entries move to the default account and a debt's
  // account is cleared, only on the user's own request. Tested by accountsFold.test.ts.
  'services/accountsFold.ts': 2,
  // The one place the planned removal is prepared, one update per row (proDataService.test.ts).
  'services/proDataService.ts': 1,
  // Data migrations that already ran on users' phones (icon and colour repairs). A shipped
  // script is never edited; a new one is a new line here and a decision about what it may touch.
  'dataMigrations/scripts/001_sanitize_icon_color.ts': 2,
  'dataMigrations/scripts/002_remap_category_colors.ts': 2,
};

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = `${dir}/${name}`;
    return statSync(full).isDirectory() ? filesUnder(full) : name.endsWith('.ts') ? [full] : [];
  });

const label = (writer: Writer): string => `${writer.fn} on ${writer.table}`;

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

describe('every writer is covered', () => {
  it('lists every exported update service', () => {
    const dir = fromRoot('src', 'data', 'services');
    const exported = readdirSync(dir)
      .filter(file => file.endsWith('.ts'))
      .flatMap(file => [...readFileSync(`${dir}/${file}`, 'utf8').matchAll(/^export const (update[A-Z]\w*)/gm)])
      .map(match => match[1])
      .sort();
    const listed = [...new Set(WRITERS.map(writer => writer.fn).filter(fn => fn.startsWith('update')))].sort();
    expect(listed).toEqual(exported);
  });

  it('accounts for every place in the data layer that edits a stored row', () => {
    const root = fromRoot('src', 'data');
    const sites: Record<string, number> = {};
    for (const file of filesUnder(root)) {
      const count = readFileSync(file, 'utf8')
        .split('\n')
        .filter(line => !/^\s*(\*|\/\/|\/\*)/.test(line) && /\.(update|prepareUpdate)\(/.test(line)).length;
      if (count > 0) {
        sites[file.slice(root.length + 1)] = count;
      }
    }
    expect(sites).toEqual(EDIT_SITES);
  });

  it('has a writer for every table', () => {
    expect([...new Set(WRITERS.map(writer => writer.table))].sort()).toEqual(Object.keys(schema.tables).sort());
  });
});

describe.each(WRITERS.map(writer => [label(writer), writer] as const))('%s', (_label, writer) => {
  it('edits a row that has every column filled, so a column it wiped would show', async () => {
    const {id} = await writer.seed();
    const raw = await rawOf(writer.table, id);
    const empty = columnsOf(writer.table).filter(
      column => (raw[column] === null || raw[column] === undefined || raw[column] === '') && column !== UPDATED_AT,
    );
    expect(empty).toEqual(writer.mayBeEmpty ?? []);
  });

  it('changes nothing when given nothing to change', async () => {
    const {id, empty} = await writer.seed();
    if (!empty) {
      return;
    }
    const before = await rawOf(writer.table, id);
    await empty();
    expect(changedColumns(writer.table, before, await rawOf(writer.table, id))).toEqual([]);
  });

  it('changes only the columns each edit names', async () => {
    const {patches} = await writer.seed();
    const touched: Record<string, string[]> = {};
    const expected: Record<string, string[]> = {};
    for (const name of Object.keys(patches)) {
      // A fresh row per edit, so one edit's change cannot hide another's.
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
      const seeded = await writer.seed();
      const patch = seeded.patches[name];
      if (!patch) {
        throw new Error(`the seed lost the ${name} edit`);
      }
      const before = await rawOf(writer.table, seeded.id);
      await patch.apply();
      touched[name] = changedColumns(writer.table, before, await rawOf(writer.table, seeded.id));
      expected[name] = [...patch.columns].sort();
    }
    expect(touched).toEqual(expected);
  });
});
