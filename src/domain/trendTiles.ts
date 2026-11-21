import type {Insight, TrendPoint} from './trends';

/**
 * What stood out in a month, as tiles (Trends redesign): a figure first, a few
 * words after. The same facts as domain/trends' insights, in another order:
 * shares before amounts, because "kept 18% of what came in" stays true with
 * irregular income and rising prices, where a raw amount does not. Pure
 * arithmetic; the screen words each tile.
 */

type Direction = 'up' | 'down';
type InsightOf<K extends Insight['kind']> = Extract<Insight, {kind: K}>;

/** One tile. `value` is the figure it leads with; `insight` is the fact it shows, for its full sentence. */
export type TrendTile =
  /** Percent of money in that was kept. */
  | {kind: 'keptShare'; value: number; insight: InsightOf<'keptShare'>}
  /** The amount spent beyond what came in (in place of a kept share below zero). */
  | {kind: 'spentMoreThanReceived'; value: number; insight: InsightOf<'spentMoreThanReceived'>}
  /** Points between the month's kept share and `usual`, the average kept share of the months before. */
  | {kind: 'keptShareChange'; value: number; direction: Direction; share: number; usual: number}
  /** Percent of spending that was the biggest category. */
  | {kind: 'biggestCategory'; value: number; categoryId: string; insight: InsightOf<'biggestCategory'>}
  /** Percent above or below the usual spending. */
  | {
      kind: 'spendingAgainstUsual';
      value: number;
      direction: Direction;
      insight: InsightOf<'spentAboveAverage' | 'spentBelowAverage'>;
    }
  /** The lowest or highest spending of `value` months. */
  | {
      kind: 'lowestSpending' | 'highestSpending';
      value: number;
      insight: InsightOf<'lowestOfMonths' | 'highestOfMonths'>;
    }
  /** Percent a category was above or below its own usual. */
  | {
      kind: 'categoryAgainstUsual';
      value: number;
      direction: Direction;
      categoryId: string;
      insight: InsightOf<'categoryAboveAverage' | 'categoryBelowAverage'>;
    };

const MAX_TILES = 6;
/** A usual kept share needs at least this many earlier months with money in. */
const MIN_HISTORY = 2;

/** The share of money in that a month kept, in percent (not rounded). Only for months with money in. */
const keptPercent = (point: TrendPoint): number => (point.kept / point.received) * 100;

/**
 * The tiles for `month` (a finished month), given the months before it
 * (`history`) and the insights already worked out for it. Shares first, then
 * spending against usual, then the rest; at most six.
 */
export const trendTiles = (
  month: TrendPoint,
  history: readonly TrendPoint[],
  insights: readonly Insight[],
): TrendTile[] => {
  const tiles: TrendTile[] = [];

  for (const insight of insights) {
    if (insight.kind === 'keptShare') {
      tiles.push({kind: 'keptShare', value: insight.percent, insight});
    } else if (insight.kind === 'spentMoreThanReceived') {
      tiles.push({kind: 'spentMoreThanReceived', value: insight.over, insight});
    }
  }

  const earlier = history.filter(point => point.received > 0);
  if (month.received > 0 && earlier.length >= MIN_HISTORY) {
    const share = Math.round(keptPercent(month));
    const usual = Math.round(earlier.reduce((total, point) => total + keptPercent(point), 0) / earlier.length);
    if (share !== usual) {
      tiles.push({
        kind: 'keptShareChange',
        value: Math.abs(share - usual),
        direction: share > usual ? 'up' : 'down',
        share,
        usual,
      });
    }
  }

  for (const insight of insights) {
    if (insight.kind === 'biggestCategory') {
      tiles.push({kind: 'biggestCategory', value: insight.percent, categoryId: insight.categoryId, insight});
    }
  }
  for (const insight of insights) {
    if (insight.kind === 'spentAboveAverage' || insight.kind === 'spentBelowAverage') {
      tiles.push({
        kind: 'spendingAgainstUsual',
        value: insight.percent,
        direction: insight.kind === 'spentAboveAverage' ? 'up' : 'down',
        insight,
      });
    }
  }
  for (const insight of insights) {
    if (insight.kind === 'lowestOfMonths' || insight.kind === 'highestOfMonths') {
      tiles.push({
        kind: insight.kind === 'lowestOfMonths' ? 'lowestSpending' : 'highestSpending',
        value: insight.months,
        insight,
      });
    }
  }
  for (const insight of insights) {
    if (insight.kind === 'categoryAboveAverage' || insight.kind === 'categoryBelowAverage') {
      tiles.push({
        kind: 'categoryAgainstUsual',
        value: insight.percent,
        direction: insight.kind === 'categoryAboveAverage' ? 'up' : 'down',
        categoryId: insight.categoryId,
        insight,
      });
    }
  }
  return tiles.slice(0, MAX_TILES);
};
