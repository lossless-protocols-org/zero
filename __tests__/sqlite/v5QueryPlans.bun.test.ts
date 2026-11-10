/**
 * Schema v5: the period queries periodSummaryService and incomeService send
 * for the two new flow tables are index ranges on (user_id, date), like the
 * expense month query (expenseDateRange.bun.test.ts). Exactly the SQL the
 * adapter builds, planned by SQLite. Runs under `bun test` only.
 */
// describe/it/expect are bun globals, typed here through @types/jest.
import {Database} from 'bun:sqlite';
import {Q} from '@nozbe/watermelondb';
import {buildQueryDescription, queryWithoutDeleted} from '@nozbe/watermelondb/QueryDescription';
import encodeQuery from '@nozbe/watermelondb/adapters/sqlite/encodeQuery';
import {encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../src/data/database/schema';
import {monthDateClauses} from '../../src/data/services/expenseDateRange';

const planFor = (db: Database, table: string): string => {
  const description = queryWithoutDeleted(
    buildQueryDescription([Q.where('user_id', 'u1'), ...monthDateClauses('2026-11')]),
  );
  const [sql] = encodeQuery({table, description, associations: []});
  return db
    .query<{detail: string}>(`EXPLAIN QUERY PLAN ${sql}`)
    .all()
    .map(r => r.detail)
    .join(' | ');
};

describe('v5 month queries are index ranges', () => {
  const db = new Database(':memory:');
  db.exec(encodeSchema(schema));

  it.each([
    ['expenses', 'expenses_user_id_date'],
    ['refunds', 'refunds_user_id_date'],
    ['incomes', 'incomes_user_id_date'],
  ])('%s uses %s', (table, index) => {
    expect(planFor(db, table)).toContain(`USING INDEX ${index} (user_id=? AND date>? AND date<?)`);
  });
});

/**
 * The refund badges join refunds onto the expenses a list reads
 * (refundService.refundedAmountsOf, audit 2026-11-08 §8.4). SQLite drives the
 * join from the expense range, through the (user_id, date) index, and finds
 * each expense's refunds through the expense_id index: no scan of either table.
 */
describe('the refund badge join', () => {
  const db = new Database(':memory:');
  db.exec(encodeSchema(schema));

  it('reads expenses by index range and refunds by expense id', () => {
    const description = queryWithoutDeleted(
      buildQueryDescription([
        Q.where('user_id', 'u1'),
        Q.on('expenses', [Q.where('user_id', 'u1'), ...monthDateClauses('2026-11')]),
      ]),
    );
    const [sql] = encodeQuery({
      table: 'refunds',
      description,
      associations: [{from: 'refunds', to: 'expenses', info: {type: 'belongs_to', key: 'expense_id'}}],
    });
    const plan = db
      .query<{detail: string}>(`EXPLAIN QUERY PLAN ${sql}`)
      .all()
      .map(r => r.detail)
      .join(' | ');
    expect(plan).not.toMatch(/SCAN (refunds|expenses)\b(?! USING)/);
    expect(plan).toMatch(/expenses USING (COVERING )?INDEX expenses_user_id_date/);
    expect(plan).toMatch(/refunds USING INDEX refunds_expense_id/);
  });
});
