/**
 * The trends statement and its arguments (plan P12). What it returns is
 * proved on real SQLite (__tests__/sqlite/trendSums.bun.test.ts); here, its
 * shape: one placeholder per later month in each part, the arguments in the
 * statement's order, and months that do not touch refused.
 */
import {periodFor} from '../../../../src/domain/period';
import {trendMonths} from '../../../../src/domain/trends';
import {assertContiguous, trendSumsArgs, trendSumsSql} from '../../../../src/data/services/trendSumsQuery';

const periods = (count: number, day = 1) => trendMonths('2026-11', count, day).map(month => month.period);
const placeholders = (sql: string) => (sql.match(/\?/g) ?? []).length;

it('has as many placeholders as arguments, for any number of months', () => {
  for (const count of [1, 2, 3, 6, 12, 13]) {
    expect({count, n: placeholders(trendSumsSql(count))}).toEqual({
      count,
      n: trendSumsArgs('u1', periods(count)).length,
    });
  }
});

it('one month needs no boundary; each later month adds its first day to every part', () => {
  expect(trendSumsSql(1)).toContain('select 0 as bucket');
  expect(trendSumsArgs('u1', periods(1))).toEqual([
    'u1',
    '2026-11-01',
    '2026-12-01',
    'u1',
    '2026-11-01',
    '2026-12-01',
    'u1',
    '2026-11-01',
    '2026-12-01',
  ]);
  const part = ['2026-10-07', '2026-11-07', 'u1', '2026-09-07', '2026-12-07'];
  expect(trendSumsArgs('u1', periods(3, 7))).toEqual([...part, ...part, ...part]);
});

it('reads the three flow tables, nets nothing itself, and never counts a deleted row', () => {
  const sql = trendSumsSql(3);
  for (const table of ['from expenses', 'from refunds', 'from incomes']) {
    expect(sql).toContain(table);
  }
  expect(sql.match(/_status is not 'deleted'/g)).toHaveLength(4); // three parts and the refund's expense
  expect(sql).toContain('group by bucket, kind, category_id');
  expect(sql).not.toMatch(/transfers|accounts|debts|checkpoints/);
});

it('refuses months that are out of order, apart, or empty', () => {
  const [a, b, c] = periods(3);
  if (!a || !b || !c) {
    throw new Error('three months expected');
  }
  expect(() => assertContiguous([a, b, c])).not.toThrow();
  expect(() => assertContiguous([])).not.toThrow();
  expect(() => assertContiguous([a, c])).toThrow('must be in order and touch');
  expect(() => assertContiguous([b, a])).toThrow('must be in order and touch');
  expect(() => assertContiguous([{start: a.next, next: a.start}])).toThrow('must be in order and touch');
  // A custom range next to a month is fine as long as they touch.
  expect(() =>
    assertContiguous([periodFor('2026-10'), {start: periodFor('2026-11').start, next: c.next}]),
  ).not.toThrow();
  expect(trendSumsArgs('u1', [])).toEqual([]);
});
