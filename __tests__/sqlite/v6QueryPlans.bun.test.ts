/**
 * Schema v6 (3.0, plan P8 exit gate): every read an account balance makes is
 * an index range, never a scan. netWorthService reads, per account, each
 * fact table from the anchor's next day up to the day asked; these are
 * exactly the queries it builds (the same clauses, through the adapter's own
 * encoder), planned by SQLite. Runs under `bun test` only.
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {Q} from '@nozbe/watermelondb';
import type {Clause} from '@nozbe/watermelondb/QueryDescription';
import {buildQueryDescription, queryWithoutDeleted} from '@nozbe/watermelondb/QueryDescription';
import encodeQuery from '@nozbe/watermelondb/adapters/sqlite/encodeQuery';
import {encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../src/data/database/schema';
import {dayRangeClauses} from '../../src/data/services/expenseDateRange';

const planFor = (db: Database, table: string, clauses: Clause[]): string => {
  const [sql] = encodeQuery({
    table,
    description: queryWithoutDeleted(buildQueryDescription(clauses)),
    associations: [],
  });
  return db
    .query<{detail: string}>(`EXPLAIN QUERY PLAN ${sql}`)
    .all()
    .map(r => r.detail)
    .join(' | ');
};

const own = (column: string, after: string | null) => [
  Q.where('user_id', 'u1'),
  Q.where(column, 'a1'),
  ...dayRangeClauses(after, '2026-11-30'),
];

describe('an account balance reads index ranges only', () => {
  const db = new Database(':memory:');
  db.exec(encodeSchema(schema));

  // From an anchor (a range on both ends) and from the beginning (an upper bound only).
  for (const after of ['2026-11-05', null]) {
    it.each([
      ['expenses', 'account_id', 'expenses_user_id_account_id_date'],
      ['refunds', 'account_id', 'refunds_user_id_account_id_date'],
      ['incomes', 'account_id', 'incomes_user_id_account_id_date'],
      ['transfers', 'from_account_id', 'transfers_user_id_from_account_id_date'],
      ['transfers', 'to_account_id', 'transfers_user_id_to_account_id_date'],
    ])(`%s by %s uses %s (after ${after ?? 'the beginning'})`, (table, column, index) => {
      const plan = planFor(db, table, own(column, after));
      expect(plan).toContain(`USING INDEX ${index} (user_id=? AND ${column}=? AND date`);
      expect(plan).not.toMatch(/\bSCAN\b/);
    });
  }

  it('the checkpoints of an account use their (user_id, account_id, date) index', () => {
    const plan = planFor(db, 'checkpoints', [Q.where('user_id', 'u1'), Q.where('account_id', 'a1')]);
    expect(plan).toContain('USING INDEX checkpoints_user_id_account_id_date (user_id=? AND account_id=?)');
  });

  it('debts through an account are found by the account, not by scanning the user’s debts', () => {
    const plan = planFor(db, 'debts', own('account_id', '2026-11-05'));
    expect(plan).toMatch(/USING INDEX debts_account_id \(account_id=\?\)/);
    expect(plan).not.toMatch(/\bSCAN\b/);
  });
});
