/**
 * Integration test for the backup RESTORE path — the highest-consequence code
 * in the app and, until this file existed, the only major subsystem with no
 * test at all.
 *
 * `planner.test.ts` covers the pure plan. This covers what the plan is worth:
 * that `importAllData` actually lands it in a database, and — critically —
 * that its atomicity claim is real. `importService` promises that wipe +
 * recreate happen in ONE `database.write`/`database.batch` so a mid-import
 * failure rolls back and leaves the device's existing data untouched. An app
 * with no telemetry cannot discover a broken restore in the field; a user
 * discovers it while trying to recover a lost phone.
 *
 * Lives in the root `__tests__/` directory, which bunfig.toml excludes, because
 * it needs jest.mock hoisting to swap the native SQLite adapter for LokiJS —
 * the same reason App.test.tsx lives here.
 */
import type {User, Category, Expense, Currency, Debtor, Debt, Budget} from '../../../../src/data/database/models';
import type {ExportData} from '../../../../src/data/backup/export/format';
import {database} from '../../../../src/data/database/database';
import {importAllData} from '../../../../src/data/services/importService';
import * as planner from '../../../../src/data/backup/import/planner';

const backup = (overrides: Partial<ExportData> = {}): ExportData => ({
  users: [{username: 'Ada', email: ''}],
  categories: [
    {name: 'Fuel', kind: 'expense', categoryStatus: false, icon: 'car', color: '#111111'},
    // The real backup in references/ contains "Fuel" twice — the ACTIVE one
    // must win the merge, not simply the last one seen.
    {name: 'Fuel', kind: 'expense', categoryStatus: true, icon: 'car', color: '#222222'},
    {name: 'Retired', kind: 'expense', categoryStatus: false, icon: 'box', color: '#333333'},
  ],
  expenses: [
    {title: 'Petrol', amount: 40, description: '', category: {name: 'Fuel'}, date: '2026-08-01'},
    // References a category that is NOT in the categories array — must be
    // auto-created, never silently dropped.
    {title: 'Mystery', amount: 7, description: '', category: {name: 'Unknown'}, date: '2026-08-02'},
  ],
  currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
  debtors: [{title: 'Sam', debtorStatus: true, icon: 'user', type: 'Friend', color: '#444444'}],
  debts: [{amount: 500, description: 'lunch', debtor: {title: 'Sam'}, date: '2026-08-03', type: 'Lend'}],
  budgets: [{amount: 30000, month: 'recurring:2026-08', budgetType: 'monthly'}],
  accounts: [],
  incomes: [],
  ...overrides,
});

const countAll = async () => ({
  users: await database.get<User>('users').query().fetchCount(),
  categories: await database.get<Category>('categories').query().fetchCount(),
  expenses: await database.get<Expense>('expenses').query().fetchCount(),
  currencies: await database.get<Currency>('currencies').query().fetchCount(),
  debtors: await database.get<Debtor>('debtors').query().fetchCount(),
  debts: await database.get<Debt>('debts').query().fetchCount(),
  budgets: await database.get<Budget>('budgets').query().fetchCount(),
});

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

describe('importAllData', () => {
  it('restores every entity type, including budgets', async () => {
    const {stats} = await importAllData(backup());
    const counts = await countAll();

    expect(counts.users).toBe(1);
    expect(counts.currencies).toBe(1);
    expect(counts.debtors).toBe(1);
    expect(counts.debts).toBe(1);
    // Budgets were the entity the old import silently dropped entirely.
    expect(counts.budgets).toBe(1);
    expect(stats.budgets).toBe(1);

    const budget = (await database.get<Budget>('budgets').query().fetch())[0];
    expect(budget?.amount).toBe(30000);
    expect(budget?.month).toBe('recurring:2026-08');
  });

  it('preserves soft-delete status instead of resurrecting everything', async () => {
    await importAllData(backup());
    const categories = await database.get<Category>('categories').query().fetch();
    const retired = categories.find(c => c.name === 'Retired');

    // The old import went through createCategory, which hardcoded `true`, so
    // deleted categories reappeared in every picker after a restore.
    expect(retired?.categoryStatus).toBe(false);
  });

  it('merges duplicate category names, preferring the active row', async () => {
    await importAllData(backup());
    const categories = await database.get<Category>('categories').query().fetch();
    const fuel = categories.filter(c => c.name === 'Fuel');

    expect(fuel).toHaveLength(1);
    expect(fuel[0]?.categoryStatus).toBe(true);
    expect(fuel[0]?.color).toBe('#222222');
  });

  it('never drops an expense whose category is missing from the backup', async () => {
    const {stats} = await importAllData(backup());
    const expenses = await database.get<Expense>('expenses').query().fetch();

    expect(expenses).toHaveLength(2);
    expect(stats.autoCreatedCategories).toBe(1);

    const categories = await database.get<Category>('categories').query().fetch();
    const unknown = categories.find(c => c.name === 'Unknown');
    expect(unknown).toBeDefined();

    const mystery = expenses.find(e => e.title === 'Mystery');
    expect(mystery?.categoryId).toBe(unknown?.id);
  });

  it('wires expenses and debts to the newly minted ids, not the old ones', async () => {
    const {userId} = await importAllData(backup());

    const categories = await database.get<Category>('categories').query().fetch();
    const debtors = await database.get<Debtor>('debtors').query().fetch();
    const expenses = await database.get<Expense>('expenses').query().fetch();
    const debts = await database.get<Debt>('debts').query().fetch();

    const categoryIds = new Set(categories.map(c => c.id));
    for (const expense of expenses) {
      expect(categoryIds.has(expense.categoryId)).toBe(true);
      expect(expense.userId).toBe(userId);
    }
    expect(debts[0]?.debtorId).toBe(debtors[0]?.id);
    expect(debts[0]?.userId).toBe(userId);
  });

  it('is idempotent — re-importing the same file does not duplicate rows', async () => {
    await importAllData(backup());
    const first = await countAll();

    // The pre-Phase-2 importer left the previously created rows behind, so a
    // retry after a partial sync produced a second user and duplicate
    // categories, and userIdSlice then picked users[0] nondeterministically.
    await importAllData(backup());
    const second = await countAll();

    expect(second).toEqual(first);
    expect(second.users).toBe(1);
  });

  it('replaces existing data rather than appending to it', async () => {
    await importAllData(backup({users: [{username: 'Ada', email: ''}]}));
    await importAllData(
      backup({
        users: [{username: 'Grace', email: ''}],
        expenses: [{title: 'Only one', amount: 1, description: '', category: {name: 'Fuel'}, date: '2026-08-09'}],
      }),
    );

    const users = await database.get<User>('users').query().fetch();
    const expenses = await database.get<Expense>('expenses').query().fetch();

    expect(users).toHaveLength(1);
    expect(users[0]?.username).toBe('Grace');
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.title).toBe('Only one');
  });

  it('throws (and rolls back) on a planned row whose category or debtor has no id, instead of writing an empty reference', async () => {
    await importAllData(backup());
    const before = await countAll();

    const realPlan = planner.buildImportPlan(backup({users: [{username: 'Grace', email: ''}]}));
    const spy = jest.spyOn(planner, 'buildImportPlan').mockReturnValue({
      ...realPlan,
      expenses: [
        ...realPlan.expenses,
        {
          title: 'Orphan',
          amount: 1,
          description: '',
          categoryName: 'No such category',
          date: '2026-08-04',
          accountName: 'Cash',
          createdAt: 0,
          updatedAt: 0,
          refunds: [],
        },
      ],
    });

    try {
      await expect(importAllData(backup({users: [{username: 'Grace', email: ''}]}))).rejects.toThrow(
        'Import plan references a category that was not planned',
      );
    } finally {
      spy.mockRestore();
    }

    expect(await countAll()).toEqual(before);
    const users = await database.get<User>('users').query().fetch();
    expect(users[0]?.username).toBe('Ada');
  });

  it('rolls back completely when the write fails, leaving existing data intact', async () => {
    await importAllData(backup());
    const before = await countAll();
    const usersBefore = await database.get<User>('users').query().fetch();
    expect(usersBefore[0]?.username).toBe('Ada');

    // Fail while preparing the LAST entity type, i.e. after the wipe and after
    // every other prepareCreate has been staged. If the transaction were not
    // atomic, this is exactly the point where the device would be left with
    // its old data destroyed and the new data half-written.
    const budgets = database.get<Budget>('budgets');
    const spy = jest.spyOn(budgets, 'prepareCreate').mockImplementation(() => {
      throw new Error('simulated failure mid-import');
    });

    await expect(importAllData(backup({users: [{username: 'Grace', email: ''}]}))).rejects.toThrow(
      'simulated failure mid-import',
    );

    spy.mockRestore();

    const after = await countAll();
    expect(after).toEqual(before);

    const usersAfter = await database.get<User>('users').query().fetch();
    expect(usersAfter).toHaveLength(1);
    // The original user must still be here — NOT the one from the failed import.
    expect(usersAfter[0]?.username).toBe('Ada');
  });
});
