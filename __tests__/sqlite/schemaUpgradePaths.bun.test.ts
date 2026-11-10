/**
 * Every database generation ever shipped must upgrade to the current schema
 * in one step with its rows intact, because Play and the App Store deliver
 * a release to all of them at once: schema 1 (2.0: no status indexes),
 * schema 2 (2.1–2.4.2: no budgets table), schema 3 (2.6.x) and schema 4
 * (2.7.1: composite index). Since v5 (2.8) the backfill is also checked by
 * VALUE: a structure-only comparison passes even when every UPDATE is a
 * silent no-op. The test runs exactly
 * what the SQLite adapter runs on a device — `stepsForMigration` encoded by
 * `encodeMigrationSteps` — against a database built from the historic schema,
 * and compares the result with a fresh install. Runs under `bun test` only.
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {appSchema, tableSchema} from '@nozbe/watermelondb';
import {stepsForMigration} from '@nozbe/watermelondb/Schema/migrations/stepsForMigration';
import {encodeMigrationSteps, encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../src/data/database/schema';
import {migrations} from '../../src/data/database/migrations';
import {V5_TABLES} from '../../src/data/database/v5Tables';
import {EXPENSES_USER_DATE_INDEX_SQL} from '../../src/data/database/indexes';
import {epochFromIsoDate} from '../../src/domain/isoEpoch';

interface SchemaRow {
  name: string;
  sql: string;
}

type Historic = 1 | 2 | 3 | 4;

const V5_TABLE_NAMES = new Set(V5_TABLES.map(t => t.name));
const V5_COLUMNS = new Set(['account_id', 'created_at', 'updated_at', 'kind', 'sort_order']);

/** The tables as they were at `version`, rebuilt from today's definitions. */
const historicSchema = (version: Historic) =>
  appSchema({
    version,
    tables: Object.values(schema.tables)
      .filter(table => !V5_TABLE_NAMES.has(table.name))
      .filter(table => version >= 3 || table.name !== 'budgets')
      .map(table =>
        tableSchema({
          name: table.name,
          columns: Object.values(table.columns)
            .filter(column => !V5_COLUMNS.has(column.name))
            .map(column =>
              // 2.0 shipped category_status / debtor_status without indexes.
              version === 1 && (column.name === 'category_status' || column.name === 'debtor_status')
                ? {...column, isIndexed: false}
                : column,
            ),
          // 2.7.1 (v4) created the composite index on fresh installs.
          unsafeSql: version === 4 && table.name === 'expenses' ? sql => sql + EXPENSES_USER_DATE_INDEX_SQL : undefined,
        }),
      ),
  });

const SAMPLE_ROWS: Record<string, string> = {
  users: "insert into users (id, _changed, _status, username, email) values ('u1', '', 'created', 'Ravi', '')",
  categories:
    "insert into categories (id, _changed, _status, name, category_status, user_id, icon, color) values ('c1', '', 'created', 'Food', 1, 'u1', 'pizza', '#654321')",
  expenses:
    "insert into expenses (id, _changed, _status, title, amount, description, category_id, user_id, date) values ('e1', '', 'created', 'Lunch', 12.5, null, 'c1', 'u1', '2026-10-05T12:00:00')",
  currencies:
    "insert into currencies (id, _changed, _status, code, symbol, name, user_id) values ('cu1', '', 'created', 'INR', '₹', 'Indian Rupee', 'u1')",
  debtors:
    "insert into debtors (id, _changed, _status, title, type, debtor_status, user_id, icon, color) values ('d1', '', 'created', 'Rohit', 'Person', 1, 'u1', 'user', '#3A85B5')",
  debts:
    "insert into debts (id, _changed, _status, description, amount, debtor_id, user_id, date, type) values ('db1', '', 'created', 'Dinner', 500, 'd1', 'u1', '2026-10-05T20:00:00', 'borrow')",
  budgets:
    "insert into budgets (id, _changed, _status, user_id, category_id, amount, month, budget_type) values ('b1', '', 'created', 'u1', null, 40000, 'recurring:2026-10', 'monthly')",
};

const structure = (db: Database): SchemaRow[] =>
  db
    .query<SchemaRow>(
      "select name, sql from sqlite_master where type in ('table', 'index') and name not like 'sqlite_%' order by name",
    )
    .all();

const count = (db: Database, table: string): number =>
  db.query<{n: number}>(`select count(*) as n from ${table}`).get()?.n ?? 0;

/** A historic database with one row in every table it had. */
const historicDb = (from: Historic): Database => {
  const db = new Database(':memory:');
  const historic = historicSchema(from);
  db.exec(encodeSchema(historic));
  db.exec(`pragma user_version = ${from}`);
  for (const table of Object.keys(historic.tables)) {
    db.exec(SAMPLE_ROWS[table] ?? '');
  }
  return db;
};

const upgrade = (db: Database, from: Historic): void => {
  const steps = stepsForMigration({migrations, fromVersion: from, toVersion: schema.version});
  expect(steps).not.toBeNull();
  // What `_setUpWithMigrations` hands the native side, then the version it writes.
  db.exec(encodeMigrationSteps(steps ?? []));
  db.exec(`pragma user_version = ${schema.version}`);
};

const one = <T>(db: Database, sql: string): T => {
  const row = db.query<T>(sql).get();
  if (row === null) {
    throw new Error(`no row for: ${sql}`);
  }
  return row;
};

const fresh = new Database(':memory:');
fresh.exec(encodeSchema(schema));
fresh.exec(`pragma user_version = ${schema.version}`);

describe('schema upgrade paths', () => {
  it('covers every shipped generation: migrations start at schema 1 and end at the current version', () => {
    expect(migrations.minVersion).toBe(1);
    expect(migrations.maxVersion).toBe(schema.version);
    expect(schema.version).toBe(5);
  });

  it.each([1, 2, 3, 4] as const)('schema %i → current, with the SQL the adapter runs, keeps every row', from => {
    const db = historicDb(from);
    const before = Object.fromEntries(Object.keys(historicSchema(from).tables).map(t => [t, count(db, t)]));
    upgrade(db, from);

    expect(structure(db)).toEqual(structure(fresh));
    expect(db.query<{user_version: number}>('pragma user_version').get()?.user_version).toBe(schema.version);
    for (const [table, n] of Object.entries(before)) {
      // v5 adds one row on purpose: each user's income category (defaultIncomeCategory.ts).
      expect(count(db, table)).toBe(table === 'categories' ? n + 1 : n);
    }
    expect(db.query<{title: string}>("select title from expenses where id = 'e1'").get()?.title).toBe('Lunch');
    const plan = db
      .query<{detail: string}>(
        `explain query plan select * from expenses where user_id = 'u1' and date >= '2026-10-01' and date < '2026-11-01' and _status is not 'deleted'`,
      )
      .all()
      .map(r => r.detail)
      .join(' ');
    expect(plan).toContain('USING INDEX expenses_user_id_date');
    db.close();
  });

  it('the v4 migration SQL is idempotent: a retried upgrade cannot fail', () => {
    const db = new Database(':memory:');
    db.exec(encodeSchema(historicSchema(3)));
    const sql = encodeMigrationSteps(stepsForMigration({migrations, fromVersion: 3, toVersion: 4}) ?? []);
    db.exec(sql);
    expect(() => db.exec(sql)).not.toThrow();
    db.close();
  });
});

describe('schema v5 backfill, by value (2.8)', () => {
  it.each([1, 2, 3, 4] as const)('schema %i → 5 gives every row its v5 values', from => {
    const db = historicDb(from);
    upgrade(db, from);

    // One default account per user, deterministic id, the user's currency.
    expect(
      db.query('select id, user_id, name, type, currency, is_default, account_status from accounts').all(),
    ).toEqual([
      {id: 'acct_u1', user_id: 'u1', name: 'Cash', type: 'cash', currency: 'INR', is_default: 1, account_status: 1},
    ]);

    // Every expense on it, stamped from its own date exactly as the JS import rule does.
    const expense = one<{account_id: string; created_at: number; updated_at: number}>(
      db,
      "select account_id, created_at, updated_at from expenses where id = 'e1'",
    );
    expect(expense.account_id).toBe('acct_u1');
    expect(expense.created_at).toBe(epochFromIsoDate('2026-10-05T12:00:00'));
    expect(expense.updated_at).toBe(expense.created_at);

    const category = one<{kind: string; sort_order: number}>(
      db,
      "select kind, sort_order from categories where id = 'c1'",
    );
    expect(category).toEqual({kind: 'expense', sort_order: 10});

    // Every user gets the income category money in lands in, with the id createUser gives it.
    expect(
      db.query("select id, user_id, name, kind, category_status from categories where kind = 'income'").all(),
    ).toEqual([{id: 'inc_u1', user_id: 'u1', name: 'Income', kind: 'income', category_status: 1}]);

    const debt = one<{created_at: number}>(db, "select created_at from debts where id = 'db1'");
    expect(debt.created_at).toBe(epochFromIsoDate('2026-10-05T20:00:00'));

    for (const table of ['users', 'currencies', 'debtors', 'categories', ...(from >= 3 ? ['budgets'] : [])]) {
      const stamps = one<{zeros: number}>(
        db,
        `select count(*) as zeros from ${table} where created_at = 0 or updated_at = 0`,
      );
      expect({table, zeros: stamps.zeros}).toEqual({table, zeros: 0});
    }
    db.close();
  });

  it('runs twice without error and without changing a value (a retried migration is a no-op)', () => {
    const db = historicDb(4);
    const sql = encodeMigrationSteps(stepsForMigration({migrations, fromVersion: 4, toVersion: 5}) ?? []);
    db.exec(sql);
    // A second run re-issues `alter table add`, which SQLite refuses; what the
    // adapter can repeat is the data step, so that is what must be idempotent.
    const dataStep = migrations.sortedMigrations.find(m => m.toVersion === 5)?.steps.find(step => step.type === 'sql');
    if (!dataStep || dataStep.type !== 'sql') {
      throw new Error('no v5 data step');
    }
    const snapshot = (): unknown =>
      ['accounts', 'expenses', 'categories', 'debts'].map(t => db.query(`select * from ${t} order by id`).all());
    db.exec("update expenses set created_at = 123, updated_at = 456 where id = 'e1'");
    const before = snapshot();
    expect(() => db.exec(dataStep.sql)).not.toThrow();
    expect(snapshot()).toEqual(before);
    expect(count(db, 'accounts')).toBe(1);
    db.close();
  });

  it('a user without a currency row still gets an account, with an empty currency; a garbage date gets the upgrade time', () => {
    const db = new Database(':memory:');
    db.exec(encodeSchema(historicSchema(4)));
    db.exec(SAMPLE_ROWS['users'] ?? '');
    db.exec(
      "insert into expenses (id, _changed, _status, title, amount, description, category_id, user_id, date) values ('e9', '', 'created', 'Odd', 1, null, 'c1', 'u1', 'not a date')",
    );
    const started = Date.now() - 1000;
    upgrade(db, 4);
    expect(one<{currency: string}>(db, 'select currency from accounts').currency).toBe('');
    expect(one<{created_at: number}>(db, "select created_at from expenses where id = 'e9'").created_at).toBeGreaterThan(
      started,
    );
    db.close();
  });

  it('the JS timestamp rule equals SQLite strftime for every date shape the app has written', () => {
    const db = new Database(':memory:');
    for (const date of [
      '2026-10-05',
      '2026-10-05T12:00:00',
      '2024-02-29T23:59:59',
      '1999-12-31T00:00:00',
      '2026-11-06T07:05',
    ]) {
      const sql = one<{ms: number}>(
        db,
        `select cast(strftime('%s', substr('${date}', 1, 19)) as integer) * 1000 as ms`,
      ).ms;
      expect({date, ms: epochFromIsoDate(date)}).toEqual({date, ms: sql});
    }
    db.close();
  });
});
