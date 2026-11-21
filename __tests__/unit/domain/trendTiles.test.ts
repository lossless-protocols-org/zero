/**
 * What stood out, as tiles (Trends redesign): the insights' facts in another
 * order, shares first, plus the kept share against its usual; at most six,
 * and none that the numbers do not carry.
 */
import {periodFor} from '../../../src/domain/period';
import {insightsOf, type TrendPoint} from '../../../src/domain/trends';
import {trendTiles} from '../../../src/domain/trendTiles';

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
const tilesOf = (month: TrendPoint, history: readonly TrendPoint[]) =>
  trendTiles(month, history, insightsOf(month, history));

const history = [
  point('2026-05', 1000, {received: 1250, byCategory: {food: 500, fuel: 300, rent: 200}}),
  point('2026-06', 1000, {received: 1250, byCategory: {food: 500, fuel: 300, rent: 200}}),
  point('2026-07', 1000, {received: 1250, byCategory: {food: 500, fuel: 300, rent: 200}}),
];

it('shares come first: kept, kept against its usual, the biggest category; then spending against usual', () => {
  const month = point('2026-08', 1250, {received: 2000, byCategory: {food: 700, fuel: 150, rent: 400}});
  const tiles = tilesOf(month, history);
  expect(tiles.map(tile => tile.kind)).toEqual([
    'keptShare',
    'keptShareChange',
    'biggestCategory',
    'spendingAgainstUsual',
    'highestSpending',
    'categoryAgainstUsual',
  ]);
  // 750 of 2000 kept is 38%; the months before kept 250 of 1250, 20%.
  expect(tiles[0]).toMatchObject({kind: 'keptShare', value: 38});
  expect(tiles[1]).toEqual({kind: 'keptShareChange', value: 18, direction: 'up', share: 38, usual: 20});
  expect(tiles[2]).toMatchObject({kind: 'biggestCategory', value: 56, categoryId: 'food'});
  expect(tiles[3]).toMatchObject({kind: 'spendingAgainstUsual', value: 25, direction: 'up'});
  expect(tiles[4]).toMatchObject({kind: 'highestSpending', value: 4});
  // Six at most: the category that fell (fuel) is the seventh fact and is left out.
  expect(tiles[5]).toMatchObject({kind: 'categoryAgainstUsual', value: 40, direction: 'up', categoryId: 'food'});
  expect(tiles).toHaveLength(6);
});

it('every tile but the kept change carries the insight it shows, for its sentence', () => {
  const month = point('2026-08', 1250, {received: 2000, byCategory: {food: 700, fuel: 150, rent: 400}});
  const insights = insightsOf(month, history);
  const tiles = trendTiles(month, history, insights);
  for (const tile of tiles) {
    if (tile.kind !== 'keptShareChange') {
      expect(insights).toContain(tile.insight);
    }
  }
});

it('a month that spent more than came in leads with the excess; its share is still set against the usual', () => {
  const month = point('2026-08', 800, {received: 500, byCategory: {food: 500, fuel: 300}});
  const tiles = tilesOf(month, history);
  expect(tiles.map(tile => tile.kind)).toEqual([
    'spentMoreThanReceived',
    'keptShareChange',
    'biggestCategory',
    'spendingAgainstUsual',
    'lowestSpending',
    'categoryAgainstUsual',
  ]);
  expect(tiles[0]).toMatchObject({value: 300});
  // -300 of 500 is -60%, against a usual 20%.
  expect(tiles[1]).toEqual({kind: 'keptShareChange', value: 80, direction: 'down', share: -60, usual: 20});
  expect(tiles[3]).toMatchObject({value: 20, direction: 'down'});
  expect(tiles[5]).toMatchObject({direction: 'down', categoryId: 'rent', value: 100});
});

it('no kept change without money in, with fewer than two earlier months of money in, or when it is the same', () => {
  const kept = (month: TrendPoint, before: readonly TrendPoint[]) =>
    tilesOf(month, before)
      .map(tile => tile.kind)
      .filter(kind => kind === 'keptShare' || kind === 'keptShareChange' || kind === 'spentMoreThanReceived');
  // No money in this month: no share at all.
  expect(kept(point('2026-08', 1000, {byCategory: {food: 1000}}), history)).toEqual([]);
  // One earlier month with money in is no "usual".
  const thin = [point('2026-06', 1000), point('2026-07', 1000, {received: 1250})];
  expect(kept(point('2026-08', 1000, {received: 2000}), thin)).toEqual(['keptShare']);
  // The same share as usual (20%) is not news.
  expect(kept(point('2026-08', 1000, {received: 1250}), history)).toEqual(['keptShare']);
  expect(kept(point('2026-08', 1000, {received: 2000}), history)).toEqual(['keptShare', 'keptShareChange']);
});

it('a month with nothing to say has no tiles', () => {
  // The same month again, with no money in: only its biggest category is a fact.
  const same = point('2026-08', 1000, {byCategory: {food: 500, fuel: 300, rent: 200}});
  expect(tilesOf(same, history).map(tile => tile.kind)).toEqual(['biggestCategory']);
  expect(tilesOf(point('2026-08', 0), [])).toEqual([]);
});
