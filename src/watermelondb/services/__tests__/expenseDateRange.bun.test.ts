/**
 * S2 + schema v4 (v2.7.1): the month/day expense queries moved from
 * `date LIKE 'YYYY_MM%'` (Q.sanitizeLikeString turns '-' into the one-char
 * wildcard '_', which no index can serve) to a lexical range
 * `date >= first AND date < next`, answered by the composite
 * `(user_id, date)` index that schema v4 adds. Without that index SQLite
 * plans through `expenses_user_id`, which on a single-user device matches
 * every row (the 2.7.1 gate measured 15–59 ms per month on the Moto).
 *
 * On the 10k seed both query forms must return the same rows for every month
 * and day; a fresh v4 database and a v3 database migrated to v4 must end with
 * the same indexes and plan. Runs under `bun test` only (bun:sqlite).
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {Q, appSchema, tableSchema} from '@nozbe/watermelondb';
import type {Clause} from '@nozbe/watermelondb/QueryDescription';
import {buildQueryDescription, queryWithoutDeleted} from '@nozbe/watermelondb/QueryDescription';
import encodeQuery from '@nozbe/watermelondb/adapters/sqlite/encodeQuery';
import {encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../schema';
import {migrations} from '../../migrations';
import {monthDateClauses, dayDateClauses} from '../expenseDateRange';

// Node built-ins via require, as the other suites do: the project's tsconfig
// loads only jest's globals, not @types/node. bun defines __dirname for test files.
const {execFileSync} = require('node:child_process');
const {mkdtempSync, readFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {performance} = require('node:perf_hooks');
declare const __dirname: string;

interface SeedFile {
  data: {expenses: Array<{date: string}>};
}
interface IdRow {
  id: string;
}
interface PlanRow {
  detail: string;
}
interface NameRow {
  name: string;
}

const USER = 'u1';

/** Exactly what `collection.query(...clauses).fetch()` sends to the adapter. */
const sqlFor = (clauses: Clause[]): string => {
  const description = queryWithoutDeleted(buildQueryDescription([Q.where('user_id', USER), ...clauses]));
  const [sql] = encodeQuery({table: 'expenses', description, associations: []});
  return sql;
};

/** The pre-S2 form, kept verbatim as the reference. */
const likeClauses = (prefix: string): Clause[] => [Q.where('date', Q.like(`${Q.sanitizeLikeString(prefix)}%`))];

const seedDates = (): string[] => {
  const dir = mkdtempSync(join(tmpdir(), 'zero-s2-'));
  const seedPath = join(dir, 'seed.json');
  execFileSync('node', [
    resolve(__dirname, '../../../../scripts/seed-backup.mjs'),
    '10000',
    '--compact',
    '--out',
    seedPath,
  ]);
  const seed: SeedFile = JSON.parse(readFileSync(seedPath, 'utf8'));
  return seed.data.expenses.map(e => e.date);
};

const fill = (db: Database, dates: readonly string[]): void => {
  const insert = db.prepare(
    "insert into expenses (id, _changed, _status, title, amount, description, category_id, user_id, date) values (?, '', 'created', 't', 1, '', 'c', ?, ?)",
  );
  db.exec('begin');
  dates.forEach((date, i) => insert.run(`e${i}`, USER, date));
  db.exec('commit');
};

const ids = (db: Database, sql: string): string[] =>
  db
    .query<IdRow>(sql)
    .all()
    .map(r => r.id)
    .sort();

const plan = (db: Database, sql: string): string =>
  db
    .query<PlanRow>(`EXPLAIN QUERY PLAN ${sql}`)
    .all()
    .map(r => r.detail)
    .join(' | ');

const indexNames = (db: Database): string[] =>
  db
    .query<NameRow>("select name from sqlite_master where type = 'index' and name not like 'sqlite_%' order by name")
    .all()
    .map(r => r.name);

/** The v3 shape: today's tables without v4's index SQL, as on a device updating from 2.7.0. */
const v3Schema = appSchema({
  version: 3,
  tables: Object.values(schema.tables).map(table =>
    tableSchema({name: table.name, columns: Object.values(table.columns)}),
  ),
});

/** The SQL the v4 migration step runs on an existing database. */
const v4MigrationSql = (): string => {
  const v4 = migrations.sortedMigrations.find(m => m.toVersion === 4);
  if (!v4) {
    throw new Error('no migration to v4');
  }
  return v4.steps.map(step => (step.type === 'sql' ? step.sql : '')).join('');
};

const dates = seedDates();
const months = [...new Set(dates.map(d => d.slice(0, 7)))].sort();
const allDays = [...new Set(dates.map(d => d.slice(0, 10)))].sort();
// Month edges, a leap day, December → January, and a day with no rows.
const days = [
  ...allDays.filter(d => /-(01|28|30|31)$/.test(d)),
  ...allDays.filter(d => ['2024-02-29', '2023-12-31', '2024-01-01'].includes(d)),
  '1999-01-01',
];

describe('schema v4', () => {
  it('is version 4, with a migration to it', () => {
    expect(schema.version).toBe(4);
    expect(migrations.maxVersion).toBe(4);
  });

  it('a fresh install and a v3 database migrated to v4 end with the same indexes', () => {
    const fresh = new Database(':memory:');
    fresh.exec(encodeSchema(schema));
    const upgraded = new Database(':memory:');
    upgraded.exec(encodeSchema(v3Schema));
    // Devices that came from v1 never got these two (the v2 migration was a no-op).
    upgraded.exec('drop index "categories_category_status"; drop index "debtors_debtor_status";');
    upgraded.exec(v4MigrationSql());
    expect(indexNames(fresh)).toContain('expenses_user_id_date');
    expect(indexNames(upgraded)).toEqual(indexNames(fresh));
    fresh.close();
    upgraded.close();
  });

  it('the v4 migration can run twice (a retried migration must not fail)', () => {
    const db = new Database(':memory:');
    db.exec(encodeSchema(schema));
    expect(() => db.exec(v4MigrationSql())).not.toThrow();
    db.close();
  });
});

describe('expense month/day queries: lexical range vs LIKE prefix (10k seed)', () => {
  const db = new Database(':memory:');
  db.exec(encodeSchema(schema));
  fill(db, dates);

  it('month ranges return exactly the LIKE rows for every month', () => {
    expect(months.length).toBeGreaterThanOrEqual(60);
    let total = 0;
    for (const m of [...months, '2031-01']) {
      const expected = ids(db, sqlFor(likeClauses(m)));
      const actual = ids(db, sqlFor(monthDateClauses(m)));
      expect(actual).toEqual(expected);
      total += actual.length;
    }
    expect(total).toBe(10000);
  });

  it('day ranges return exactly the LIKE rows for month edges, the leap day and year boundaries', () => {
    expect(days.length).toBeGreaterThan(100);
    for (const d of days) {
      expect(ids(db, sqlFor(dayDateClauses(d)))).toEqual(ids(db, sqlFor(likeClauses(d))));
    }
  });

  it('rolls December into the next year and the last day into the next month', () => {
    expect(sqlFor(monthDateClauses('2025-12'))).toContain(
      `"date" >= '2025-12-01' and "expenses"."date" < '2026-01-01'`,
    );
    expect(sqlFor(dayDateClauses('2024-02-29'))).toContain(
      `"date" >= '2024-02-29' and "expenses"."date" < '2024-03-01'`,
    );
    expect(sqlFor(dayDateClauses('2025-01-31'))).toContain(
      `"date" >= '2025-01-31' and "expenses"."date" < '2025-02-01'`,
    );
  });

  it('rejects inputs that are not YYYY-MM / YYYY-MM-DD instead of querying a bogus range', () => {
    expect(() => monthDateClauses('2025-1')).toThrow();
    expect(() => monthDateClauses('2025-13')).toThrow();
    expect(() => dayDateClauses('2025-02-30')).toThrow();
    expect(() => dayDateClauses('2025-01-05T10:00:00')).toThrow();
  });

  it('the month and day ranges are an index range on (user_id, date)', () => {
    const month = plan(db, sqlFor(monthDateClauses('2025-06')));
    const day = plan(db, sqlFor(dayDateClauses('2025-06-15')));
    console.log(`[S2] month plan: ${month}\n[S2] like plan:  ${plan(db, sqlFor(likeClauses('2025-06')))}`);
    expect(month).toContain('USING INDEX expenses_user_id_date (user_id=? AND date>? AND date<?)');
    expect(day).toContain('USING INDEX expenses_user_id_date (user_id=? AND date>? AND date<?)');
  });

  it('timing on the 10k seed (informational)', () => {
    const time = (make: (m: string) => Clause[]): number => {
      const sqls = months.map(m => sqlFor(make(m)));
      const t0 = performance.now();
      for (let round = 0; round < 5; round++) {
        for (const sql of sqls) {
          db.query<IdRow>(sql).all();
        }
      }
      return (performance.now() - t0) / (5 * sqls.length);
    };
    console.log(
      `[S2] avg per month query — LIKE: ${time(likeClauses).toFixed(3)} ms, range: ${time(monthDateClauses).toFixed(3)} ms`,
    );
  });
});
