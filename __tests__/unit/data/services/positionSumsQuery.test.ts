/**
 * The account-sums statement's shape (its results are checked on real SQLite
 * in __tests__/sqlite/positionSums.bun.test.ts): one column per day asked,
 * each bounded by the day after it, and every part ranged from the day after
 * the anchor (or from the start) to the last bound.
 */
import {positionSumsArgs, positionSumsSql} from '../../../../src/data/services/positionSumsQuery';

it('one column per day, six parts, deleted rows left out of each', () => {
  const sql = positionSumsSql(3);
  expect(sql.match(/total\(case when date < \? then units end\)/g)).toHaveLength(3);
  expect(sql.match(/union all/g)).toHaveLength(5);
  expect(sql.match(/_status is not 'deleted'/g)).toHaveLength(6);
});

it('bounds each day by the next one, and ranges every part from after the anchor to the last bound', () => {
  const args = positionSumsArgs('u1', 'a1', '2026-10-31', ['2026-11-30', '2026-11-05']);
  expect(args.slice(0, 2)).toEqual(['2026-12-01', '2026-11-06']);
  expect(args.slice(2)).toEqual(Array.from({length: 6}, () => ['u1', 'a1', '2026-11-01', '2026-12-01']).flat());
});

it('from the beginning, the range starts before every date', () => {
  expect(positionSumsArgs('u1', 'a1', null, ['2026-11-01']).slice(1, 5)).toEqual(['u1', 'a1', '', '2026-11-02']);
});
