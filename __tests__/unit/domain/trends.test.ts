/**
 * Trends (plan P12): the months to show, how a figure stands against another,
 * and the facts said about a month, against fixtures. Every fact names the
 * numbers it rests on, and none is said that the numbers do not carry.
 */
import {periodFor} from '../../../src/domain/period';
import {
  averageOf,
  categorySeries,
  changeOf,
  insightsOf,
  topCategories,
  trendColumns,
  trendMonths,
  usualSpending,
  type TrendPoint,
} from '../../../src/domain/trends';

const point = (key: string, spent: number, more: Partial<TrendPoint> = {}): TrendPoint => {
  const received = more.received ?? 0;
  return {
    key,
    period: periodFor(key),
    spent,
    refunded: 0,
    received,
    kept: received - spent,
    count: spent > 0 ? 3 : 0,
    byCategory: {},
    ...more,
  };
};

describe('the months of a trend', () => {
  it('are the last n, oldest first, across a year, cut on the start day', () => {
    expect(trendMonths('2026-02', 3, 1).map(month => month.key)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(trendMonths('2026-11', 2, 7)).toEqual([
      {key: '2026-10', period: {start: '2026-10-07', next: '2026-11-07'}},
      {key: '2026-11', period: {start: '2026-11-07', next: '2026-12-07'}},
    ]);
    expect(trendMonths('2026-11', 12, 1)).toHaveLength(12);
    expect(trendMonths('2026-11', 0, 1)).toEqual([]);
  });
});

describe('comparing figures', () => {
  it('a change is the exact difference and a whole percent of what it is compared with', () => {
    expect(changeOf(1400, 1000)).toEqual({amount: 400, percent: 40});
    expect(changeOf(600, 1000)).toEqual({amount: -400, percent: -40});
    expect(changeOf(0.3, 0.1)).toEqual({amount: 0.2, percent: 200});
    // Nothing to compare against: the amount stands, a percentage would mean nothing.
    expect(changeOf(500, 0)).toEqual({amount: 500, percent: null});
    expect(changeOf(500, -20)).toEqual({amount: 520, percent: null});
  });

  it('an average is to the money unit, and of nothing is 0', () => {
    expect(averageOf([100, 200, 300])).toBe(200);
    expect(averageOf([0.1, 0.2])).toBe(0.15);
    expect(averageOf([])).toBe(0);
  });

  it('a category’s series is 0 where it has no row', () => {
    const october = point('2026-10', 900, {byCategory: {food: 500, fuel: 400}});
    const november = point('2026-11', 1000, {byCategory: {food: 650, rent: 350}});
    expect(categorySeries([october, november], 'fuel')).toEqual([400, 0]);
  });

  it('the top categories are the ones with the most spending over the months, largest first', () => {
    const points = [
      point('2026-09', 900, {byCategory: {food: 500, fuel: 400, '': 50}}),
      point('2026-10', 1000, {byCategory: {food: 100, rent: 900, gift: -20}}),
    ];
    // Uncategorised ('') and a category of refunds alone are not listed.
    expect(topCategories(points, 6)).toEqual(['rent', 'food', 'fuel']);
    expect(topCategories(points, 2)).toEqual(['rent', 'food']);
    expect(topCategories([], 6)).toEqual([]);
  });
});

describe('the chart’s columns', () => {
  it('a column is as tall as the money in, spent from the bottom and kept on top, on one scale', () => {
    const {scale, columns} = trendColumns([
      point('2026-08', 600, {received: 1000}),
      point('2026-09', 500, {received: 2000}),
    ]);
    expect(scale).toBe(2000);
    expect(columns).toEqual([
      {key: '2026-08', spent: 0.3, kept: 0.2, over: 0},
      {key: '2026-09', spent: 0.25, kept: 0.75, over: 0},
    ]);
  });

  it('a month that spent more than came in is all spent up to the money in, with a cap of the excess', () => {
    const {scale, columns} = trendColumns([
      point('2026-08', 1500, {received: 1000}),
      point('2026-09', 0, {received: 3000}),
    ]);
    // The scale is the largest of money in and spending.
    expect(scale).toBe(3000);
    expect(columns[0]).toEqual({key: '2026-08', spent: 1000 / 3000, kept: 0, over: 500 / 3000});
    expect(columns[1]).toEqual({key: '2026-09', spent: 0, kept: 1, over: 0});
  });

  it('a month with no money in is its spending alone; the scale can be a month’s spending', () => {
    const {scale, columns} = trendColumns([point('2026-08', 800), point('2026-09', 100, {received: 400})]);
    expect(scale).toBe(800);
    expect(columns).toEqual([
      {key: '2026-08', spent: 1, kept: 0, over: 0},
      {key: '2026-09', spent: 0.125, kept: 0.375, over: 0},
    ]);
  });

  it('an empty stretch, and a month of refunds alone, draw nothing', () => {
    expect(trendColumns([point('2026-08', 0), point('2026-09', -50)])).toEqual({
      scale: 0,
      columns: [
        {key: '2026-08', spent: 0, kept: 0, over: 0},
        {key: '2026-09', spent: 0, kept: 0, over: 0},
      ],
    });
    expect(trendColumns([])).toEqual({scale: 0, columns: []});
  });

  it('one category: its spending only, with no kept part', () => {
    const {scale, columns} = trendColumns(
      [
        point('2026-08', 600, {received: 1000, byCategory: {food: 200}}),
        point('2026-09', 500, {received: 2000, byCategory: {food: 400, fuel: 100}}),
        point('2026-10', 90, {received: 10, byCategory: {fuel: 90}}),
      ],
      'food',
    );
    expect(scale).toBe(400);
    expect(columns).toEqual([
      {key: '2026-08', spent: 0.5, kept: 0, over: 0},
      {key: '2026-09', spent: 1, kept: 0, over: 0},
      {key: '2026-10', spent: 0, kept: 0, over: 0},
    ]);
  });

  it('the usual spending is the average of the finished months with entries, and needs two of them', () => {
    const months = [
      point('2026-07', 0),
      point('2026-08', 1000, {byCategory: {food: 600}}),
      point('2026-09', 1500, {byCategory: {food: 200}}),
    ];
    // July, before the user started, is in no average.
    expect(usualSpending(months)).toBe(1250);
    expect(usualSpending(months, 'food')).toBe(400);
    expect(usualSpending(months.slice(0, 2))).toBeNull();
    expect(usualSpending([])).toBeNull();
  });
});

describe('what is said about a month', () => {
  const history = [
    point('2026-05', 1000, {byCategory: {food: 500, fuel: 300, rent: 200}}),
    point('2026-06', 1000, {byCategory: {food: 500, fuel: 300, rent: 200}}),
    point('2026-07', 1000, {byCategory: {food: 500, fuel: 300, rent: 200}}),
  ];

  it('a month above its average, with the category that drove it and the one that fell', () => {
    const month = point('2026-08', 1250, {received: 2000, byCategory: {food: 700, fuel: 150, rent: 400}});
    expect(insightsOf(month, history)).toEqual([
      {kind: 'spentAboveAverage', percent: 25, spent: 1250, average: 1000, months: 3},
      // Both food and rent rose by 200; by amount they tie, and the id decides, so the answer never flickers.
      {kind: 'categoryAboveAverage', categoryId: 'food', percent: 40, spent: 700, average: 500, months: 3},
      {kind: 'categoryBelowAverage', categoryId: 'fuel', percent: 50, spent: 150, average: 300, months: 3},
      {kind: 'highestOfMonths', months: 4, spent: 1250},
      {kind: 'biggestCategory', categoryId: 'food', percent: 56, spent: 700},
      {kind: 'keptShare', percent: 38, kept: 750, received: 2000},
    ]);
  });

  it('a month below its average, the lowest of the stretch, that spent more than came in', () => {
    const month = point('2026-08', 800, {received: 500, byCategory: {food: 500, fuel: 300}});
    const kinds = insightsOf(month, history).map(insight => insight.kind);
    expect(kinds).toEqual([
      'spentBelowAverage',
      'categoryBelowAverage',
      'lowestOfMonths',
      'biggestCategory',
      'spentMoreThanReceived',
    ]);
    expect(insightsOf(month, history).at(-1)).toEqual({kind: 'spentMoreThanReceived', over: 300, received: 500});
  });

  it('says nothing a small difference does not carry', () => {
    const month = point('2026-08', 1040, {byCategory: {food: 520, fuel: 310, rent: 210}});
    expect(insightsOf(month, history)).toEqual([
      {kind: 'highestOfMonths', months: 4, spent: 1040},
      {kind: 'biggestCategory', categoryId: 'food', percent: 50, spent: 520},
    ]);
  });

  it('a tiny category that doubled is not news', () => {
    const withCoffee = history.map(month => ({...month, byCategory: {...month.byCategory, coffee: 10}}));
    const month = point('2026-08', 1000, {byCategory: {food: 500, fuel: 280, rent: 200, coffee: 20}});
    expect(insightsOf(month, withCoffee).map(insight => insight.kind)).toEqual(['biggestCategory']);
  });

  it('makes no average from fewer than two months, or from months before the user started', () => {
    const month = point('2026-08', 5000, {byCategory: {food: 5000}});
    const empty = [point('2026-05', 0), point('2026-06', 0), point('2026-07', 1000, {byCategory: {food: 1000}})];
    expect(insightsOf(month, empty)).toEqual([
      {kind: 'biggestCategory', categoryId: 'food', percent: 100, spent: 5000},
    ]);
    expect(insightsOf(month, [])).toHaveLength(1);
  });

  it('an empty month after active ones is only compared with them; with no history nothing is said', () => {
    expect(insightsOf(point('2026-08', 0), history)).toEqual([
      {kind: 'spentBelowAverage', percent: 100, spent: 0, average: 1000, months: 3},
      {kind: 'categoryBelowAverage', categoryId: 'food', percent: 100, spent: 0, average: 500, months: 3},
    ]);
    expect(insightsOf(point('2026-08', 0), [])).toEqual([]);
  });

  it('a month whose refunds outweigh its spending names no biggest category', () => {
    const month = point('2026-08', -50, {count: 1, byCategory: {food: -50}});
    expect(insightsOf(month, []).map(insight => insight.kind)).toEqual([]);
  });
});
