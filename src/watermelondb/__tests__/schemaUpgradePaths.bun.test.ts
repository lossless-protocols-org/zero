/**
 * Every database generation ever shipped must upgrade to the current schema
 * in one step with its rows intact, because Play and the App Store deliver
 * 2.7.1 to all of them at once: schema 1 (2.0: no status indexes), schema 2
 * (2.1–2.4.2: no budgets table) and schema 3 (2.6.x). The test runs exactly
 * what the SQLite adapter runs on a device — `stepsForMigration` encoded by
 * `encodeMigrationSteps` — against a database built from the historic schema,
 * and compares the result with a fresh install. Runs under `bun test` only.
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {appSchema, tableSchema} from '@nozbe/watermelondb';
import {stepsForMigration} from '@nozbe/watermelondb/Schema/migrations/stepsForMigration';
import {encodeMigrationSteps, encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../schema';
import {migrations} from '../migrations';

interface SchemaRow {
  name: string;
  sql: string;
}

/** The tables as they were at `version`, rebuilt from today's definitions. */
const historicSchema = (version: 1 | 2 | 3) =>
  appSchema({
    version,
    tables: Object.values(schema.tables)
      .filter(table => version >= 3 || table.name !== 'budgets')
      .map(table =>
        tableSchema({
          name: table.name,
          columns: Object.values(table.columns).map(column =>
            // 2.0 shipped category_status / debtor_status without indexes.
            version === 1 && (column.name === 'category_status' || column.name === 'debtor_status')
              ? {...column, isIndexed: false}
              : column,
          ),
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

const fresh = new Database(':memory:');
fresh.exec(encodeSchema(schema));
fresh.exec(`pragma user_version = ${schema.version}`);

describe('schema upgrade paths', () => {
  it('covers every shipped generation: migrations start at schema 1 and end at the current version', () => {
    expect(migrations.minVersion).toBe(1);
    expect(migrations.maxVersion).toBe(schema.version);
    expect(schema.version).toBe(4);
  });

  it.each([1, 2, 3] as const)('schema %i → current, with the SQL the adapter runs, keeps every row', from => {
    const db = new Database(':memory:');
    const historic = historicSchema(from);
    db.exec(encodeSchema(historic));
    db.exec(`pragma user_version = ${from}`);
    for (const table of Object.keys(historic.tables)) {
      db.exec(SAMPLE_ROWS[table] ?? '');
    }
    const before = Object.fromEntries(Object.keys(historic.tables).map(t => [t, count(db, t)]));

    const steps = stepsForMigration({migrations, fromVersion: from, toVersion: schema.version});
    expect(steps).not.toBeNull();
    // What `_setUpWithMigrations` hands the native side, then the version it writes.
    db.exec(encodeMigrationSteps(steps ?? []));
    db.exec(`pragma user_version = ${schema.version}`);

    expect(structure(db)).toEqual(structure(fresh));
    expect(db.query<{user_version: number}>('pragma user_version').get()?.user_version).toBe(schema.version);
    for (const [table, n] of Object.entries(before)) {
      expect(count(db, table)).toBe(n);
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

  it('the migration SQL is idempotent: a retried upgrade cannot fail', () => {
    const db = new Database(':memory:');
    db.exec(encodeSchema(historicSchema(3)));
    const sql = encodeMigrationSteps(stepsForMigration({migrations, fromVersion: 3, toVersion: 4}) ?? []);
    db.exec(sql);
    expect(() => db.exec(sql)).not.toThrow();
    db.close();
  });
});
