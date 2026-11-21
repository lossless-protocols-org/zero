/**
 * The trends SQL (src/data/services/trendSumsQuery.ts) on real SQLite against
 * the 10k seed: for 3, 6 and 12 months, cut on the 1st and on the 7th, every
 * (month, kind, category) sum equals a plain JS sum of the same rows by the
 * app's rules; a refund counts in the month it is dated, under its expense's
 * category, even when the expense is older than the range; each part is an
 * index range; and twelve months are quick (plan P12: 50 ms on the phone).
 * jest runs the JavaScript path (LokiJS cannot run SQL); this keeps the two
 * the same. Runs under `bun test` only.
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {performance} from 'node:perf_hooks';
import {encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../src/data/database/schema';
import {assertContiguous, trendSumsArgs, trendSumsSql, type TrendSumsRow} from '../../src/data/services/trendSumsQuery';
import {trendMonths} from '../../src/domain/trends';
import {periodKeyOf} from '../../src/domain/period';
import {seedBackup, SEED_ANCHOR} from '../harness/seed';

interface Row {
  amount: number;
  date: string;
  category: {name: string};
}
interface Seed {
  data: {expenses: Array<Row & {refunds?: Array<{amount: number; date: string}>}>; incomes: Row[]};
}

const USER = 'u1';
const units = (amount: number) => Math.round(amount * 10_000);
const seed = seedBackup(10000) as Seed; // the generator's shape; only these fields are read

const db = new Database(':memory:');
db.exec(encodeSchema(schema));
/** Every row with its kind, category and date: the reference. */
const events: Array<{kind: 'e' | 'r' | 'i'; category: string; date: string; units: number}> = [];
let n = 0;
const insert = (table: string, columns: Record<string, string | number | null>): string => {
  const id = `r${n++}`;
  const names = ['id', '_changed', '_status', 'user_id', ...Object.keys(columns)];
  db.prepare(`insert into ${table} (${names.join(', ')}) values (${names.map(() => '?').join(', ')})`).run(
    id,
    '',
    'created',
    USER,
    ...Object.values(columns),
  );
  return id;
};
for (const e of seed.data.expenses) {
  const category = e.category.name;
  const id = insert('expenses', {
    title: 't',
    amount: e.amount,
    description: '',
    category_id: category,
    date: e.date,
    account_id: 'a',
  });
  events.push({kind: 'e', category, date: e.date, units: units(e.amount)});
  for (const r of e.refunds ?? []) {
    insert('refunds', {expense_id: id, account_id: 'a', amount: r.amount, date: r.date, note: ''});
    events.push({kind: 'r', category, date: r.date, units: units(r.amount)});
  }
}
for (const i of seed.data.incomes) {
  insert('incomes', {category_id: i.category.name, account_id: 'a', amount: i.amount, date: i.date, note: ''});
  events.push({kind: 'i', category: i.category.name, date: i.date, units: units(i.amount)});
}
// A deleted row and another user's row: neither may count.
insert('expenses', {
  title: 'gone',
  amount: 999,
  description: '',
  category_id: 'Food',
  date: `${SEED_ANCHOR}`,
  account_id: 'a',
});
db.exec(`update expenses set _status = 'deleted' where title = 'gone'`);
db.prepare(
  `insert into incomes (id, _changed, _status, user_id, category_id, account_id, amount, date, note) values ('other', '', 'created', 'u2', 'Income', 'a', 5, ?, '')`,
).run(SEED_ANCHOR);

/** The month the seed's last day falls in, for a start day. */
const lastKey = (startDay: number): string => periodKeyOf(SEED_ANCHOR, startDay);
const LAST_KEY = lastKey(1);
const run = (count: number, startDay: number): TrendSumsRow[] => {
  const periods = trendMonths(lastKey(startDay), count, startDay).map(month => month.period);
  // The statement selects exactly TrendSumsRow's five columns.
  return db.query(trendSumsSql(count)).all(...trendSumsArgs(USER, periods)) as unknown as TrendSumsRow[];
};
const reference = (count: number, startDay: number): Map<string, {units: number; n: number}> => {
  const periods = trendMonths(lastKey(startDay), count, startDay).map(month => month.period);
  const out = new Map<string, {units: number; n: number}>();
  for (const event of events) {
    const bucket = periods.findIndex(period => event.date >= period.start && event.date < period.next);
    if (bucket < 0) {
      continue;
    }
    const key = `${bucket}|${event.kind}|${event.category}`;
    const group = out.get(key) ?? {units: 0, n: 0};
    group.units += event.units;
    group.n += 1;
    out.set(key, group);
  }
  return out;
};

describe('trend sums in SQLite', () => {
  it.each([
    [3, 1],
    [6, 1],
    [12, 1],
    [1, 7],
    [6, 7],
    [12, 28],
  ])('%i months from day %i: equal the rows added up by the app’s rules', (count, startDay) => {
    const got = new Map(
      run(count, startDay).map(row => [
        `${row.bucket}|${row.kind}|${row.category_id}`,
        {units: Math.round(row.units), n: row.n},
      ]),
    );
    const want = reference(count, startDay);
    expect(got.size).toBeGreaterThan(count);
    expect(Object.fromEntries(got)).toEqual(Object.fromEntries(want));
  });

  it('a refund counts where it is dated, under the category of an expense older than the range', () => {
    const old = insert('expenses', {
      title: 'old shoes',
      amount: 4000,
      description: '',
      category_id: 'OnlyHere',
      date: '2019-01-05T10:00:00',
      account_id: 'a',
    });
    insert('refunds', {expense_id: old, account_id: 'a', amount: 150, date: `${SEED_ANCHOR}T09:00:00`, note: ''});
    const rows = run(1, 1).filter(row => row.category_id === 'OnlyHere');
    expect(rows).toEqual([{bucket: 0, kind: 'r', category_id: 'OnlyHere', units: units(150), n: 1}]);
    db.exec(`delete from refunds where expense_id = '${old}'; delete from expenses where id = '${old}'`);
  });

  it('every part reads an index range on (user_id, date), never a whole table', () => {
    const periods = trendMonths(LAST_KEY, 12, 1).map(month => month.period);
    const plan = (
      db.query(`EXPLAIN QUERY PLAN ${trendSumsSql(12)}`).all(...trendSumsArgs(USER, periods)) as Array<{
        detail: string;
      }>
    )
      .map(r => r.detail)
      .join(' | ');
    expect(plan).not.toMatch(/\bSCAN (expenses|refunds|incomes)\b(?! USING)/);
    for (const index of ['expenses_user_id_date', 'refunds_user_id_date', 'incomes_user_id_date']) {
      expect(plan).toContain(index);
    }
  });

  it('refuses months that do not touch or are out of order', () => {
    const [a, b, c] = trendMonths(LAST_KEY, 3, 1).map(month => month.period);
    if (!a || !b || !c) {
      throw new Error('three months expected');
    }
    expect(() => assertContiguous([a, c])).toThrow('must be in order and touch');
    expect(() => assertContiguous([b, a])).toThrow('must be in order and touch');
    expect(() => trendSumsArgs(USER, [a, c])).toThrow();
    expect(trendSumsArgs(USER, [])).toEqual([]);
  });

  it('twelve months of the 10k seed take a few milliseconds', () => {
    run(12, 1);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) run(12, 1);
    const ms = (performance.now() - t0) / 20;
    const rows = events.filter(e => e.date >= trendMonths(LAST_KEY, 12, 1)[0]!.period.start).length; // 12 months asked: the first exists
    console.log(`[P12] 12 months, ${rows} rows, grouped in SQLite: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(25);
  });
});
