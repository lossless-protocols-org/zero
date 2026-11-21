/**
 * Every table is in every data path (3.0 law L7,
 * handbook/blueprint/ZERO_3.0_ENTITLEMENT.md). A table that the backup, the
 * restore, the file check or the wipe does not know is silent data loss: the
 * app works until the day a phone is replaced. So this walks the model
 * registry, not a list written here, and a table added to the schema fails
 * until it is exported, validated, imported, counted and wiped.
 *
 * Who is paying plays no part in any of these paths (L1): there is no tier
 * here to test under.
 */
import {database} from '../../src/data/database/database';
import {schema} from '../../src/data/database/schema';
import {MODEL_CLASSES} from '../../src/data/database/models/modelClasses';
import {CURRENT_EXPORT_VERSION, type ExportData} from '../../src/data/backup/export/format';
import {generateUniqueKey} from '../../src/data/backup/export/key';
import {upgradeExportData} from '../../src/data/backup/export/upgrader';
import {validateExportEnvelope} from '../../src/data/backup/export/validate';
import {getAllData} from '../../src/data/services/getService';
import {importAllData} from '../../src/data/services/importService';
import {countAllRecords, deleteAllData} from '../../src/data/services/deleteService';
import type {Account} from '../../src/data/database/models/Account';
import type {Expense} from '../../src/data/database/models/Expense';
import {defaultIncomeCategoryId} from '../../src/data/database/defaultIncomeCategory';
import {defaultAccountId} from '../../src/data/database/defaultAccount';
import {setMonthStartDay, createUser} from '../../src/data/services/userService';
import {createCurrency} from '../../src/data/services/currencyService';
import {createCategory} from '../../src/data/services/categoryService';
import {createExpense} from '../../src/data/services/expenseService';
import {createRefund} from '../../src/data/services/refundService';
import {createIncome} from '../../src/data/services/incomeService';
import {createDebtor} from '../../src/data/services/debtorService';
import {createDebt} from '../../src/data/services/debtService';
import {upsertBudget} from '../../src/data/services/budgetService';
import {getEntitlement, refreshEntitlement} from '../../src/pro/entitlementStore';
import {isPro} from '../../src/pro/entitlement';
import {createFakeBilling, fakeRecord} from '../harness/fakeBilling';
import {createTransfer} from '../../src/data/services/transferService';
import {createCheckpoint} from '../../src/data/services/checkpointService';
import {createRule, materialiseDue} from '../../src/data/services/recurringService';

const TABLES = MODEL_CLASSES.map(model => model.table).sort();

/**
 * Where each table's rows travel in the backup file. A new table gets its
 * line here in the commit that adds its export, validation and import.
 * Refunds are nested in their expense (export v5).
 */
const ROWS_IN_BACKUP: Record<string, (data: ExportData) => unknown[] | undefined> = {
  users: data => data.users,
  currencies: data => data.currencies,
  categories: data => data.categories,
  accounts: data => data.accounts,
  expenses: data => data.expenses,
  refunds: data => data.expenses.find(expense => (expense.refunds?.length ?? 0) > 0)?.refunds,
  incomes: data => data.incomes,
  debtors: data => data.debtors,
  debts: data => data.debts,
  budgets: data => data.budgets,
  transfers: data => data.transfers,
  checkpoints: data => data.checkpoints,
  recurring_rules: data => data.recurring,
};

type Raw = Record<string, unknown>;

/** A column that points at another table's row. A restore mints every id afresh, so these are compared by what they point at. */
const REFERENCES: Record<string, string> = {
  user_id: 'users',
  category_id: 'categories',
  account_id: 'accounts',
  from_account_id: 'accounts',
  to_account_id: 'accounts',
  expense_id: 'expenses',
  debtor_id: 'debtors',
  recurring_id: 'recurring_rules',
};

/**
 * Columns a backup does not carry, each with why. Every other column of every
 * table must come back from a restore exactly as it was: a column added to
 * the schema and forgotten by the export or the import fails here, the day it
 * is added, instead of emptying itself on somebody's new phone.
 */
const SET_UP_ROW_TIMES = {
  created_at: 'a restore makes set-up rows anew; only entries (expenses, refunds, incomes, debts) keep their times',
  updated_at: 'as created_at',
};
const NOT_CARRIED: Record<string, Record<string, string>> = {
  users: SET_UP_ROW_TIMES,
  currencies: SET_UP_ROW_TIMES,
  categories: SET_UP_ROW_TIMES,
  accounts: SET_UP_ROW_TIMES,
  debtors: SET_UP_ROW_TIMES,
  budgets: SET_UP_ROW_TIMES,
};

/** Columns no seeded row fills, each with why; any other column must be filled somewhere, or its survival is unproven. */
const NEVER_FILLED_BY_SEED: Record<string, string[]> = {};

const columnsOf = (table: string): string[] => (schema.tables[table]?.columnArray ?? []).map(column => column.name);

const allRows = async (): Promise<Record<string, Raw[]>> => {
  const fetched = await Promise.all(TABLES.map(table => database.get(table).query().fetch()));
  // A copy of each stored row; `_raw` is the record's own plain object of column values.
  return Object.fromEntries(
    TABLES.map((table, i) => [table, (fetched[i] ?? []).map(r => ({...(r._raw as unknown as Raw)}))]),
  );
};

/** A row as its own values, with each reference replaced by the values of the row it points at. */
const describeRows = (rows: Record<string, Raw[]>): Record<string, string[]> => {
  const byId = new Map<string, {table: string; row: Raw}>();
  for (const table of TABLES) {
    for (const row of rows[table] ?? []) {
      byId.set(`${table}:${String(row['id'])}`, {table, row});
    }
  }
  const own = (table: string, row: Raw): Raw =>
    Object.fromEntries(
      columnsOf(table)
        .filter(c => !(c in REFERENCES) && !(c in (NOT_CARRIED[table] ?? {})))
        .map(c => [c, row[c]]),
    );
  const described = (table: string, row: Raw): Raw => ({
    ...own(table, row),
    ...Object.fromEntries(
      columnsOf(table)
        .filter(c => c in REFERENCES && !(c in (NOT_CARRIED[table] ?? {})))
        .map(c => {
          const target = byId.get(`${REFERENCES[c] ?? ''}:${String(row[c])}`);
          // '' is "no row" (a monthly budget has no category); a dangling id would show as the id itself.
          return [c, target ? own(target.table, target.row) : row[c]];
        }),
    ),
  });
  return Object.fromEntries(
    TABLES.map(table => [table, (rows[table] ?? []).map(row => JSON.stringify(described(table, row))).sort()]),
  );
};

const rowCounts = async (): Promise<Record<string, number>> => {
  const counts = await Promise.all(TABLES.map(table => database.get(table).query().fetchCount()));
  return Object.fromEntries(TABLES.map((table, i) => [table, counts[i] ?? 0]));
};

const validated = (envelope: unknown): ExportData => {
  const validation = validateExportEnvelope(envelope);
  if (!validation.success || !validation.data) {
    throw new Error(validation.error ?? 'the backup did not validate');
  }
  return upgradeExportData(validation.data);
};

/** The backup file the app would write now, as an object. */
const exportNow = async (): Promise<{key: string; version: number; data: ExportData}> => {
  const draft = await getAllData();
  if (!draft) {
    throw new Error('nothing to export');
  }
  // JSON round trip, as a file does: only what survives serialising is in a backup. Every
  // caller passes the result through validateExportEnvelope, which is what checks the shape.
  const data = JSON.parse(JSON.stringify(draft)) as ExportData;
  return {key: generateUniqueKey(), version: CURRENT_EXPORT_VERSION, data};
};

describe('every table is in every data path', () => {
  jest.setTimeout(60_000);

  beforeAll(async () => {
    // Built through the services, not from a backup: the rows below are the truth the
    // export and the restore are then measured against. A fixture that itself came through
    // the import could not show a column the import drops.
    const userId = await createUser('Asha', 'asha@example.com');
    // P11: a month that starts on salary day must come back from a restore.
    await setMonthStartDay(userId, 7);
    await createCurrency('INR', '₹', 'Indian Rupee', userId);
    const food = await createCategory('Food', userId, 'pizza', '#111111', 'expense');
    await createCategory('Travel', userId, 'car', '#222222', 'expense');
    const lunch = await createExpense(userId, 'Lunch', 250, 'with Ravi', food, '2026-11-05T10:00:00');
    const shoes = await createExpense(userId, 'Shoes', 2000, 'online', food, '2026-11-06T18:30:00');
    await createRefund(shoes, {amount: 500, date: '2026-11-07T09:00:00', note: 'wrong size'});
    await createIncome(userId, {
      categoryId: defaultIncomeCategoryId(userId),
      amount: 40_000,
      date: '2026-11-01',
      note: 'November',
    });
    const debtor = await createDebtor('Rohit', userId, 'user', 'Person', '#555555');
    await createDebt(userId, 1800, 'Movie tickets', debtor, '2026-11-03T20:00:00', 'Lend');
    await upsertBudget(userId, 45_000, {kind: 'recurring', start: '2026-11'});
    await upsertBudget(userId, 5000, {kind: 'month', yearMonth: '2026-11'}, {budgetType: 'category', categoryId: food});
    // A second account, and one expense on it: the row a free screen will one day not show.
    // No service makes an account before 3.0 (P8), so it is written directly.
    let savingsId = '';
    await database.write(async () => {
      const savings = await database.get<Account>('accounts').create(account => {
        account.userId = userId;
        account.name = 'Savings';
        account.type = 'bank';
        account.currency = 'INR';
        account.openingBalance = 1500;
        account.openingDate = '2026-01-01';
        account.isDefault = false;
        account.accountStatus = true;
        account.sortOrder = 20;
        account.icon = 'landmark';
        account.color = '#224466';
        account.kind = 'Salary';
      });
      const expense = await database.get<Expense>('expenses').find(lunch);
      await expense.update(e => {
        e.accountId = savings.id;
      });
      savingsId = savings.id;
    });
    // 3.0 (P8): money back to another account than the expense was paid from. A backup must
    // carry the refund's own account, or a restore would move it and change both balances.
    await createRefund(shoes, {amount: 200, date: '2026-11-08T09:00:00', note: 'card credit', accountId: savingsId});
    // v6 (3.0): positions between the accounts, and a debt that moved money through one.
    await createDebt(userId, 2500, 'Rent share', debtor, '2026-11-04T09:00:00', 'Borrow', {accountId: savingsId});
    await createTransfer(userId, {
      fromAccountId: defaultAccountId(userId),
      toAccountId: savingsId,
      amount: 750,
      date: '2026-11-06',
      note: 'to savings',
    });
    await createCheckpoint(userId, {
      accountId: savingsId,
      balance: -120.5,
      date: '2026-11-08',
      gap: -30.25,
      kind: 'adjustment',
      note: 'statement',
    });
    // P9: one rule of each kind, between them every column filled, and the rows they made.
    const rule = {cadence: 'monthly', interval: 1, startDate: '2026-11-02', toAccountId: null} as const;
    await createRule(
      userId,
      {
        ...rule,
        target: 'expense',
        title: 'Gym',
        categoryId: food,
        accountId: savingsId,
        amount: 999,
        endDate: '2027-11-02',
        remindDaysBefore: 2,
      },
      '2026-11-02',
    );
    await createRule(
      userId,
      {
        ...rule,
        target: 'income',
        title: 'Interest',
        categoryId: defaultIncomeCategoryId(userId),
        accountId: savingsId,
        amount: 10,
        endDate: null,
        remindDaysBefore: null,
      },
      '2026-11-02',
    );
    await createRule(
      userId,
      {
        ...rule,
        target: 'transfer',
        title: 'SIP',
        categoryId: '',
        accountId: defaultAccountId(userId),
        toAccountId: savingsId,
        amount: 500,
        endDate: null,
        remindDaysBefore: 1,
      },
      '2026-11-02',
    );
    expect((await materialiseDue(userId, '2026-11-02')).written).toBe(3);
  });

  it('the schema, the model registry and the backup map name the same tables', () => {
    expect(Object.keys(schema.tables).sort()).toEqual(TABLES);
    expect(Object.keys(ROWS_IN_BACKUP).sort()).toEqual(TABLES);
  });

  it('the fixture puts at least one row in every table, or the checks below prove nothing', async () => {
    const empty = Object.entries(await rowCounts())
      .filter(([, count]) => count === 0)
      .map(([table]) => table);
    expect(empty).toEqual([]);
  });

  it('the fixture fills every column in some row, or that column could vanish unnoticed', async () => {
    const rows = await allRows();
    const neverFilled = Object.fromEntries(
      TABLES.map(table => [
        table,
        columnsOf(table).filter(column =>
          (rows[table] ?? []).every(row => row[column] === null || row[column] === undefined || row[column] === ''),
        ),
      ]).filter(([, columns]) => (columns?.length ?? 0) > 0),
    );
    expect(neverFilled).toEqual(NEVER_FILLED_BY_SEED);
  });

  it('the device inventory counts every table', async () => {
    const counts = await rowCounts();
    const inventory = await countAllRecords();
    expect(TABLES.filter(table => inventory.byTable[table] !== counts[table])).toEqual([]);
    expect(inventory.total).toBe(Object.values(counts).reduce((sum, n) => sum + n, 0));
  });

  it('a backup carries every table, the wipe empties every table, and a restore brings each one back', async () => {
    const before = await rowCounts();
    const rowsBefore = describeRows(await allRows());
    const envelope = await exportNow();

    const missing = TABLES.filter(table => (ROWS_IN_BACKUP[table]?.(envelope.data)?.length ?? 0) === 0);
    expect(missing).toEqual([]);

    await deleteAllData();
    const afterWipe = await rowCounts();
    expect(Object.values(afterWipe).every(count => count === 0)).toBe(true);

    await importAllData(validated(envelope));
    expect(await rowCounts()).toEqual(before);
    // Not only as many rows: every column of every row, as it was (ids are new; references are followed).
    const rowsAfter = describeRows(await allRows());
    for (const table of TABLES) {
      expect({table, rows: rowsAfter[table]}).toEqual({table, rows: rowsBefore[table]});
    }
  });

  it.each([
    ['without Pro', []],
    ['with Pro', [fakeRecord('zero_pro_lifetime')]],
  ] as const)(
    '%s, export → restore → export gives the same file: no data path asks who is paying (L1)',
    async (_tier, owned) => {
      const billing = createFakeBilling();
      billing.owns(...owned);
      await refreshEntitlement(billing);
      expect(isPro(getEntitlement().state)).toBe(owned.length > 0);
      const first = await exportNow();
      await importAllData(validated(first));
      const second = await exportNow();
      expect(JSON.stringify(second.data)).toBe(JSON.stringify(first.data));
    },
  );

  it.each(TABLES)('the file check reads the %s rows: a row that is not a row is refused', async table => {
    const envelope = await exportNow();
    const rows = ROWS_IN_BACKUP[table]?.(envelope.data);
    if (!rows || rows.length === 0) {
      throw new Error(`the backup has no ${table} rows to tamper with`);
    }
    // The file is good until this test spoils it, so the refusal below is about this row.
    expect(validateExportEnvelope(envelope).success).toBe(true);
    rows[0] = 42;
    expect(validateExportEnvelope(envelope).success).toBe(false);
  });
});
