/**
 * The account-balance SQL (src/data/services/positionSumsQuery.ts) on real
 * SQLite against the 10k seed with positions: for every account, from the
 * beginning and from a day, at many days, its sums equal a plain JS sum of
 * the same rows by the app's rules; every part of it is an index range; and
 * it is quick. jest runs the JavaScript path (LokiJS cannot run SQL); this is
 * what keeps the two the same. Runs under `bun test` only.
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {performance} from 'node:perf_hooks';
import {encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../src/data/database/schema';
import {positionSumsArgs, positionSumsSql} from '../../src/data/services/positionSumsQuery';
import {seedBackup} from '../harness/seed';

interface Row {
  amount: number;
  date: string;
  account?: string;
}
interface Seed {
  data: {
    accounts: Array<{name: string; isDefault: boolean}>;
    expenses: Array<Row & {refunds?: Row[]}>;
    incomes: Row[];
    debts: Array<Row & {type: string}>;
    transfers: Array<{fromAccount: string; toAccount: string; amount: number; date: string}>;
  };
}

const USER = 'u1';
const units = (amount: number) => Math.round(amount * 10_000);
const seed = seedBackup(10000, {accounts: true}) as Seed; // the generator's v6 shape; only these fields are read
const cash = seed.data.accounts.find(a => a.isDefault)?.name ?? 'Cash';

const db = new Database(':memory:');
db.exec(encodeSchema(schema));
/** Every row, as the restore stores it, with its effect in units: the reference. */
const events: Array<{account: string; day: string; units: number}> = [];
let n = 0;
const insert = (table: string, columns: Record<string, string | number | null>) => {
  const names = ['id', '_changed', '_status', 'user_id', ...Object.keys(columns)];
  db.prepare(`insert into ${table} (${names.join(', ')}) values (${names.map(() => '?').join(', ')})`).run(
    `r${n++}`,
    '',
    'created',
    USER,
    ...Object.values(columns),
  );
};
for (const e of seed.data.expenses) {
  const account = e.account ?? cash;
  insert('expenses', {
    title: 't',
    amount: e.amount,
    description: '',
    category_id: 'c',
    date: e.date,
    account_id: account,
  });
  events.push({account, day: e.date.slice(0, 10), units: -units(e.amount)});
  for (const r of e.refunds ?? []) {
    const to = r.account ?? account;
    insert('refunds', {expense_id: 'x', account_id: to, amount: r.amount, date: r.date, note: ''});
    events.push({account: to, day: r.date.slice(0, 10), units: units(r.amount)});
  }
}
for (const i of seed.data.incomes) {
  const to = i.account ?? cash;
  insert('incomes', {category_id: 'c', account_id: to, amount: i.amount, date: i.date, note: ''});
  events.push({account: to, day: i.date, units: units(i.amount)});
}
for (const t of seed.data.transfers) {
  insert('transfers', {
    from_account_id: t.fromAccount,
    to_account_id: t.toAccount,
    amount: t.amount,
    date: t.date,
    note: '',
  });
  events.push({account: t.fromAccount, day: t.date, units: -units(t.amount)});
  events.push({account: t.toAccount, day: t.date, units: units(t.amount)});
}
for (const d of seed.data.debts) {
  insert('debts', {
    amount: d.amount,
    description: '',
    debtor_id: 'p',
    date: d.date,
    type: d.type,
    account_id: d.account ?? null,
  });
  if (d.account) {
    events.push({
      account: d.account,
      day: d.date.slice(0, 10),
      units: (d.type === 'Borrow' ? 1 : -1) * units(d.amount),
    });
  }
}
// A deleted row and another user's row: neither may count.
insert('expenses', {
  title: 'gone',
  amount: 999,
  description: '',
  category_id: 'c',
  date: '2025-01-01',
  account_id: cash,
});
db.exec(`update expenses set _status = 'deleted' where title = 'gone'`);
db.prepare(
  `insert into incomes (id, _changed, _status, user_id, category_id, account_id, amount, date, note) values ('other', '', 'created', 'u2', 'c', ?, 5, '2025-01-01', '')`,
).run(cash);

const sums = (account: string, after: string | null, days: string[]): number[] => {
  const row = db.query(positionSumsSql(days.length)).get(...positionSumsArgs(USER, account, after, days)) as Record<
    string,
    number
  >;
  return days.map((_, i) => Math.round(row[`s${i}`] ?? 0));
};
const reference = (account: string, after: string | null, day: string): number =>
  events
    .filter(e => e.account === account && (after === null || e.day > after) && e.day <= day)
    .reduce((s, e) => s + e.units, 0);

const DAYS = [
  '2021-11-15',
  '2022-03-01',
  '2023-07-31',
  '2024-02-29',
  '2025-12-31',
  '2026-10-31',
  '2026-11-01',
  '2030-01-01',
];

describe('account sums in SQLite', () => {
  it.each(seed.data.accounts.map(a => a.name))('%s: equal the rows added up by the app’s rules', account => {
    for (const after of [null, '2022-06-30', '2026-10-31']) {
      const days = DAYS.filter(day => after === null || day > after);
      expect(sums(account, after, days)).toEqual(days.map(day => reference(account, after, day)));
    }
  });

  it('every part reads an index range, never a whole table', () => {
    const plan = (
      db
        .query(`EXPLAIN QUERY PLAN ${positionSumsSql(2)}`)
        .all(...positionSumsArgs(USER, cash, null, DAYS.slice(0, 2))) as Array<{detail: string}>
    )
      .map(r => r.detail)
      .join(' | ');
    expect(plan).not.toMatch(/\bSCAN (expenses|refunds|incomes|transfers|debts)\b(?! USING)/);
    for (const index of [
      'expenses_user_id_account_id_date',
      'refunds_user_id_account_id_date',
      'incomes_user_id_account_id_date',
      'transfers_user_id_from_account_id_date',
      'transfers_user_id_to_account_id_date',
    ]) {
      expect(plan).toContain(index);
    }
  });

  it('the default account from the beginning (the slowest case) takes a few milliseconds', () => {
    sums(cash, null, ['2026-11-01']);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) sums(cash, null, ['2026-11-01']);
    const ms = (performance.now() - t0) / 20;
    console.log(
      `[P8] default account, all ${events.filter(e => e.account === cash).length} rows, in SQLite: ${ms.toFixed(2)} ms`,
    );
    expect(ms).toBeLessThan(20);
  });
});
