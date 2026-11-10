/**
 * L5 (v2.7.1): the year list is computed by SQLite. Runs under `bun test`
 * only (bun:sqlite). Compares the SQL against the old approach (fetch every
 * row, substr in JS) on the 10k seed plus a soft-deleted row and another
 * user's row, and prints the plan and timings (not asserted).
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {performance} from 'node:perf_hooks';
import {encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../src/data/database/schema';
import {EXPENSE_YEARS_SQL, parseExpenseYears, type ExpenseYearRow} from '../../src/data/services/expenseYearsQuery';
import {seedBackup} from '../harness/seed';

interface SeedFile {
  data: {expenses: Array<{date: string}>};
}

const setup = () => {
  const seed = seedBackup(10000) as SeedFile; // the generator's shape; only the dates are read
  const db = new Database(':memory:');
  db.exec(encodeSchema(schema));
  const insert = db.prepare(
    "insert into expenses (id, _changed, _status, title, amount, description, category_id, user_id, date) values (?, '', ?, 't', 1, '', 'c', ?, ?)",
  );
  db.exec('begin');
  seed.data.expenses.forEach((e, i) => insert.run(`e${i}`, 'created', 'u1', e.date));
  insert.run('deleted-row', 'deleted', 'u1', '1999-06-01T00:00:00'); // soft-deleted: must not count
  insert.run('other-user', 'created', 'u2', '1980-01-01T00:00:00'); // other user: must not count
  db.exec('commit');
  const expected = [...new Set(seed.data.expenses.map(e => Number(e.date.slice(0, 4))))].sort((a, b) => a - b);
  return {db, expected};
};

describe('expense years query', () => {
  const {db, expected} = setup();

  it('returns exactly the years of the live rows of that user', () => {
    const rows = db.query<ExpenseYearRow>(EXPENSE_YEARS_SQL).all('u1');
    expect(parseExpenseYears(rows)).toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(5);
    expect(parseExpenseYears(db.query<ExpenseYearRow>(EXPENSE_YEARS_SQL).all('nobody'))).toEqual([]);
  });

  it('skips malformed years instead of producing NaN', () => {
    expect(parseExpenseYears([{year: 'abcd'}, {year: null}, {year: '20'}, {year: '2024'}])).toEqual([2024]);
  });

  it('plan and timing (informational)', () => {
    const plan = db
      .query<{detail: string}>(`EXPLAIN QUERY PLAN ${EXPENSE_YEARS_SQL}`)
      .all('u1')
      .map(r => r.detail)
      .join(' | ');
    const oldSql = "select * from expenses where user_id is ? and _status is not 'deleted'";
    const time = (fn: () => unknown): number => {
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) {
        fn();
      }
      return (performance.now() - t0) / 20;
    };
    const oldMs = time(() => {
      const years = new Set<number>();
      for (const r of db.query<{date: string}>(oldSql).all('u1')) {
        years.add(Number.parseInt(r.date.substring(0, 4), 10));
      }
      return [...years];
    });
    const newMs = time(() => parseExpenseYears(db.query<ExpenseYearRow>(EXPENSE_YEARS_SQL).all('u1')));
    // Informational only: a wall-clock assertion would flake on a loaded machine.
    console.log(
      `[L5] plan: ${plan}\n[L5] 10k rows — old fetch-all+substr: ${oldMs.toFixed(2)} ms, distinct SQL: ${newMs.toFixed(2)} ms`,
    );
    expect(plan).toContain('expenses');
  });
});
