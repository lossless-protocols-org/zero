/**
 * Every database generation ever shipped must upgrade to the current schema
 * in one step with its rows intact, because Play and the App Store deliver
 * a release to all of them at once: schema 1 (2.0: no status indexes),
 * schema 2 (2.1–2.4.2: no budgets table), schema 3 (2.6.x), schema 4
 * (2.7.1: composite index) and schema 5 (2.8: the exact SQL a fresh 2.8.0
 * install runs, frozen from the tag, md5-checked). Since v5 (2.8) the backfill is also checked by
 * VALUE: a structure-only comparison passes even when every UPDATE is a
 * silent no-op. The test runs exactly
 * what the SQLite adapter runs on a device — `stepsForMigration` encoded by
 * `encodeMigrationSteps` — against a database built from the historic schema,
 * and compares the result with a fresh install. Runs under `bun test` only.
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {appSchema, tableSchema} from '@nozbe/watermelondb';
import {stepsForMigration} from '@nozbe/watermelondb/Schema/migrations/stepsForMigration';
import {encodeMigrationSteps, encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../src/data/database/schema';
import {migrations} from '../../src/data/database/migrations';
import {V5_TABLES} from '../../src/data/database/v5Tables';
import {V6_TABLES} from '../../src/data/database/v6Tables';
import {EXPENSES_USER_DATE_INDEX_SQL} from '../../src/data/database/indexes';
import {epochFromIsoDate} from '../../src/domain/isoEpoch';

interface SchemaRow {
  name: string;
  sql: string;
}

type Historic = 1 | 2 | 3 | 4 | 5;
type Rebuilt = Exclude<Historic, 5>;

const V5_TABLE_NAMES = new Set(V5_TABLES.map(t => t.name));
const V6_TABLE_NAMES = new Set(V6_TABLES.map(t => t.name));
const V5_COLUMNS = new Set(['account_id', 'created_at', 'updated_at', 'kind', 'sort_order']);
/** Columns v6 adds to tables that existed before it (debts' account_id is already above). */
const V6_COLUMNS = new Set(['recurring_id', 'month_start_day']);

/** The tables as they were at `version` (1 to 4), rebuilt from today's definitions. */
const historicSchema = (version: Rebuilt) =>
  appSchema({
    version,
    tables: Object.values(schema.tables)
      .filter(table => !V5_TABLE_NAMES.has(table.name) && !V6_TABLE_NAMES.has(table.name))
      .filter(table => version >= 3 || table.name !== 'budgets')
      .map(table =>
        tableSchema({
          name: table.name,
          columns: Object.values(table.columns)
            .filter(column => !V5_COLUMNS.has(column.name) && !V6_COLUMNS.has(column.name))
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

/**
 * Schema 5 as 2.8.0 shipped it: the SQL a fresh 2.8.0 install runs, frozen from the tag. Not
 * rebuilt from today's files, so a later edit to a shared v5 definition cannot make the test
 * agree with itself. Its checksum guards it against an edit by hand.
 */
const FROZEN_V5 = path.join(__dirname, 'fixtures', 'schema-v5-2.8.0.sql');
const FROZEN_V5_MD5 = '7058c06cb22384587318c2960a10d8c1';

/** The v5 tables' rows, as 2.8 writes them (ids as createUser and the v5 backfill give them). */
const V5_SAMPLE_ROWS: Record<string, string> = {
  accounts:
    "insert into accounts (id, _changed, _status, user_id, name, type, currency, opening_balance, opening_date, is_default, account_status, sort_order, icon, color, created_at, updated_at) values ('acct_u1', '', 'created', 'u1', 'Cash', 'cash', 'INR', 0, null, 1, 1, 0, 'wallet', '#6E8B3D', 1, 1)",
  refunds:
    "insert into refunds (id, _changed, _status, user_id, expense_id, account_id, amount, date, note, created_at, updated_at) values ('r1', '', 'created', 'u1', 'e1', 'acct_u1', 2.5, '2026-10-06T10:00:00', 'cold', 2, 2)",
  incomes:
    "insert into incomes (id, _changed, _status, user_id, category_id, account_id, amount, date, note, created_at, updated_at) values ('i1', '', 'created', 'u1', 'inc_u1', 'acct_u1', 50000, '2026-10-01', 'Salary', 3, 3)",
};

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

/** The table names a database holds, apart from SQLite's and WatermelonDB's own. */
const userTables = (db: Database): string[] =>
  db
    .query<{name: string}>(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name != 'local_storage' order by name",
    )
    .all()
    .map(row => row.name);

/** A historic database with one row in every table it had. */
const historicDb = (from: Historic): Database => {
  const db = new Database(':memory:');
  if (from === 5) {
    const sql = readFileSync(FROZEN_V5, 'utf8');
    expect(createHash('md5').update(sql).digest('hex')).toBe(FROZEN_V5_MD5);
    db.exec(sql);
  } else {
    db.exec(encodeSchema(historicSchema(from)));
  }
  db.exec(`pragma user_version = ${from}`);
  for (const table of userTables(db)) {
    if (from === 5 && table in V5_SAMPLE_ROWS) {
      db.exec(V5_SAMPLE_ROWS[table] ?? '');
    } else if (SAMPLE_ROWS[table]) {
      // Tables older than v5 gained the v5 columns; their sample rows name only the old ones.
      db.exec(SAMPLE_ROWS[table] ?? '');
    }
  }
  if (from === 5) {
    // The v5 columns of the old tables, as 2.8 fills them.
    db.exec(
      "update expenses set account_id = 'acct_u1', created_at = 4, updated_at = 4;" +
        "update categories set kind = 'expense', sort_order = 10, created_at = 5, updated_at = 5;" +
        "insert into categories (id, _changed, _status, name, category_status, user_id, icon, color, kind, sort_order, created_at, updated_at) values ('inc_u1', '', 'created', 'Income', 1, 'u1', 'coins', '#3D9960', 'income', 10, 5, 5);" +
        'update users set created_at = 6, updated_at = 6; update currencies set created_at = 6, updated_at = 6;' +
        'update debtors set created_at = 6, updated_at = 6; update debts set created_at = 7, updated_at = 7;' +
        'update budgets set created_at = 8, updated_at = 8;',
    );
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
    expect(schema.version).toBe(6);
  });

  it.each([1, 2, 3, 4, 5] as const)('schema %i → current, with the SQL the adapter runs, keeps every row', from => {
    const db = historicDb(from);
    const before = Object.fromEntries(userTables(db).map(t => [t, count(db, t)]));
    upgrade(db, from);

    expect(structure(db)).toEqual(structure(fresh));
    expect(db.query<{user_version: number}>('pragma user_version').get()?.user_version).toBe(schema.version);
    for (const [table, n] of Object.entries(before)) {
      // v5 adds one row on purpose: each user's income category (defaultIncomeCategory.ts). v6 adds none.
      expect({table, rows: count(db, table)}).toEqual({table, rows: table === 'categories' && from < 5 ? n + 1 : n});
    }
    // The v6 tables exist and are empty: nothing is moved into them.
    for (const table of V6_TABLE_NAMES) {
      expect({table, rows: count(db, table)}).toEqual({table, rows: 0});
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

describe('schema v6 (3.0): additive only', () => {
  const snapshot = (db: Database, tables: readonly string[], skip: Record<string, string[]> = {}) =>
    Object.fromEntries(
      tables.map(table => [
        table,
        db
          .query<Record<string, unknown>>(`select * from ${table} order by id`)
          .all()
          .map(row =>
            Object.fromEntries(Object.entries(row).filter(([column]) => !(skip[table] ?? []).includes(column))),
          ),
      ]),
    );

  it('upgrading 2.8.0’s database changes no value of any row it held, and adds no row', () => {
    const db = historicDb(5);
    const tables = userTables(db);
    const before = snapshot(db, tables);
    upgrade(db, 5);
    // Every row byte for byte, the new columns aside…
    expect(
      snapshot(db, tables, {
        debts: ['account_id'],
        expenses: ['recurring_id'],
        incomes: ['recurring_id'],
        users: ['month_start_day'],
        accounts: ['kind'],
      }),
    ).toEqual(before);
    // …which are empty: no debt before 3.0 moved money through an account, no row came from a rule.
    expect(db.query('select id, account_id from debts').all()).toEqual([{id: 'db1', account_id: null}]);
    expect(db.query('select recurring_id from expenses where recurring_id is not null').all()).toEqual([]);
    expect(db.query('select recurring_id from incomes where recurring_id is not null').all()).toEqual([]);
    // Held and owed (A2): no account before 3.0 had a kind of the user's own.
    expect(db.query('select kind from accounts where kind is not null').all()).toEqual([]);
    // P11: every user who upgrades keeps calendar months until they choose a day.
    expect(db.query('select month_start_day from users').all()).toEqual([{month_start_day: null}]);
    db.close();
  });

  // The adapter runs a migration and its version stamp in one transaction (WatermelonDB
  // native/shared/Database.cpp, migrate()): one that fails rolls back to schema 5 whole, and the
  // next launch runs every step again from there. So a half-applied v6 cannot exist; what could
  // meet tables that already exist is only the raw SQL, which must therefore be repeatable.
  it('the v6 SQL can run again without error or change', () => {
    const db = historicDb(5);
    upgrade(db, 5);
    const sqlSteps = migrations.sortedMigrations
      .find(m => m.toVersion === 6)
      ?.steps.filter(step => step.type === 'sql');
    expect(sqlSteps?.length).toBeGreaterThan(0);
    const before = structure(db);
    for (const step of sqlSteps ?? []) {
      if (step.type === 'sql') {
        expect(() => db.exec(step.sql)).not.toThrow();
      }
    }
    expect(structure(db)).toEqual(before);
    db.close();
  });

  it.each([
    ['fresh', null],
    ['upgraded from 2.8.0', 5],
  ] as const)('an account balance is an index range on every table it reads (%s)', (_how, from) => {
    const db = from === null ? fresh : historicDb(from);
    if (from !== null) {
      upgrade(db, from);
    }
    const planOf = (sql: string): string =>
      db
        .query<{detail: string}>(`explain query plan ${sql}`)
        .all()
        .map(r => r.detail)
        .join(' ');
    const upTo = "user_id = 'u1' and date <= '2026-11-30' and _status is not 'deleted'";
    expect(planOf(`select amount from expenses where account_id = 'a' and ${upTo}`)).toContain(
      'expenses_user_id_account_id_date',
    );
    expect(planOf(`select amount from incomes where account_id = 'a' and ${upTo}`)).toContain(
      'incomes_user_id_account_id_date',
    );
    expect(planOf(`select amount from refunds where account_id = 'a' and ${upTo}`)).toContain(
      'refunds_user_id_account_id_date',
    );
    expect(planOf(`select amount from transfers where from_account_id = 'a' and ${upTo}`)).toContain(
      'transfers_user_id_from_account_id_date',
    );
    expect(planOf(`select amount from transfers where to_account_id = 'a' and ${upTo}`)).toContain(
      'transfers_user_id_to_account_id_date',
    );
    expect(planOf(`select balance from checkpoints where account_id = 'a' and ${upTo}`)).toContain(
      'checkpoints_user_id_account_id_date',
    );
    if (from !== null) {
      db.close();
    }
  });
});

describe('the schemas as releases shipped them, frozen from their tags', () => {
  /** Fresh-install SQL of each release, encoded from that tag's schema file once, never edited. 2.0's schema 1 has no tag. */
  const FROZEN: ReadonlyArray<{version: 2 | 3 | 4; file: string; md5: string}> = [
    {version: 2, file: 'schema-v2-2.4.2.sql', md5: 'c5632443ad3ed77a0776c4068b00c5d5'},
    {version: 3, file: 'schema-v3-2.6.7.sql', md5: '905844672a66034d0d089f85d9dfa4e1'},
    {version: 4, file: 'schema-v4-2.7.1.sql', md5: 'cb15f692cee1ea805b66f4acd3176d05'},
  ];

  it.each(FROZEN)(
    'schema $version as shipped upgrades to the current schema, every row kept',
    ({version, file, md5}) => {
      const sql = readFileSync(path.join(__dirname, 'fixtures', file), 'utf8');
      expect(createHash('md5').update(sql).digest('hex')).toBe(md5);
      const db = new Database(':memory:');
      db.exec(sql);
      db.exec(`pragma user_version = ${version}`);
      for (const table of userTables(db)) {
        db.exec(SAMPLE_ROWS[table] ?? '');
      }
      const before = Object.fromEntries(userTables(db).map(t => [t, count(db, t)]));
      // The frozen schema is the one this test otherwise rebuilds from today's files.
      expect(structure(db)).toEqual(structure(historicDb(version)));
      upgrade(db, version);
      expect(structure(db)).toEqual(structure(fresh));
      for (const [table, n] of Object.entries(before)) {
        expect({table, rows: count(db, table)}).toEqual({table, rows: table === 'categories' ? n + 1 : n});
      }
      expect(one<{account_id: string}>(db, "select account_id from expenses where id = 'e1'").account_id).toBe(
        'acct_u1',
      );
      db.close();
    },
  );
});
