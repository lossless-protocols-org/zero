import {fromMoneyUnits, toMoneyUnits} from './money';
import {periodFor, shiftPeriodKey, type Period} from './period';

/**
 * Trends over the user's months (3.0, plan P12): the figures of several
 * months side by side, how one compares with another, and the plain facts
 * the screen says about them. Pure arithmetic on the user's own records:
 * every "insight" is a comparison of numbers already on screen, worked out
 * here and worded by the screen. Nothing is predicted and nothing is advised.
 */

/** One month's figures, as trendsService reads them. Money as amounts (exact to 10⁻⁴). */
export interface TrendPoint {
  /** The month's key ('YYYY-MM', the month it starts in). */
  key: string;
  period: Period;
  /** Net of the refunds dated in it (R2). */
  spent: number;
  refunded: number;
  received: number;
  /** received − spent (R4). */
  kept: number;
  /** Expenses dated in it. */
  count: number;
  /** Net spending per expense category id (refunds lower their expense's category). Categories with no row are absent. */
  byCategory: Readonly<Record<string, number>>;
}

/** The `count` months ending at `lastKey`, oldest first, as the month start day cuts them. */
export const trendMonths = (
  lastKey: string,
  count: number,
  monthStartDay: number,
): Array<{key: string; period: Period}> =>
  Array.from({length: Math.max(0, count)}, (_, index) => {
    const key = shiftPeriodKey(lastKey, index - (count - 1));
    return {key, period: periodFor(key, monthStartDay)};
  });

/**
 * The mean of amounts, to the money unit; 0 for none.
 * @internal Used by insightsOf; tests check it alone.
 */
export const averageOf = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : fromMoneyUnits(Math.round(values.reduce((total, value) => total + toMoneyUnits(value), 0) / values.length));

/** How one figure stands against another. `percent` is null when there is nothing to compare against. */
export interface Change {
  /** value − against, exact. */
  amount: number;
  /** Whole percent of `against`, signed; null when `against` is 0 or negative (a ratio would mean nothing). */
  percent: number | null;
}

export const changeOf = (value: number, against: number): Change => ({
  amount: fromMoneyUnits(toMoneyUnits(value) - toMoneyUnits(against)),
  percent: against > 0 ? Math.round(((value - against) / against) * 100) : null,
});

/** One category's spending in each month, in the months' order (0 where it has none). */
export const categorySeries = (points: readonly TrendPoint[], categoryId: string): number[] =>
  points.map(point => point.byCategory[categoryId] ?? 0);

/** Whether anything was entered in a month: a stretch before the user started is not "0 on average". */
export const isActiveMonth = (point: TrendPoint): boolean => point.count > 0 || point.received > 0 || point.spent !== 0;

/** The categories with the most spending over `points`, largest first, at most `max`. */
export const topCategories = (points: readonly TrendPoint[], max: number): string[] => {
  const totals = new Map<string, number>();
  for (const point of points) {
    for (const [id, amount] of Object.entries(point.byCategory)) {
      totals.set(id, (totals.get(id) ?? 0) + toMoneyUnits(amount));
    }
  }
  return [...totals]
    .filter(([id, amount]) => id !== '' && amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([id]) => id);
};

/**
 * One month's column in the chart, as shares (0 to 1) of the tallest column.
 * Read from the bottom: `spent`, then `kept` on it; `over` is the cap of a
 * month that spent more than came in, on top of a column that is all spent.
 */
export interface TrendColumn {
  key: string;
  spent: number;
  kept: number;
  over: number;
}

/**
 * The chart's columns. A column is as tall as the money that came in, split
 * into spent and kept; a month that spent more than came in is all spent with
 * a cap of the excess; a month with no money in is its spending alone. With a
 * `categoryId` each column is that category's spending and nothing else.
 * `scale` is the amount the tallest column stands for (0 for an empty chart).
 */
export const trendColumns = (
  points: readonly TrendPoint[],
  categoryId?: string,
): {scale: number; columns: TrendColumn[]} => {
  const parts = points.map(point => {
    // A month of refunds alone has spending below zero: nothing to draw.
    const spent = Math.max(0, categoryId === undefined ? point.spent : (point.byCategory[categoryId] ?? 0));
    const received = categoryId === undefined ? Math.max(0, point.received) : 0;
    return received === 0
      ? {key: point.key, spent, kept: 0, over: 0}
      : spent > received
        ? {key: point.key, spent: received, kept: 0, over: spent - received}
        : {key: point.key, spent, kept: received - spent, over: 0};
  });
  const scale = Math.max(0, ...parts.map(part => part.spent + part.kept + part.over));
  const share = (amount: number): number => (scale > 0 ? amount / scale : 0);
  return {
    scale,
    columns: parts.map(part => ({
      key: part.key,
      spent: share(part.spent),
      kept: share(part.kept),
      over: share(part.over),
    })),
  };
};

/**
 * The usual spending of `finished` months (all of it, or one category's): the
 * average over the ones with anything entered, or null with fewer than two of
 * them (no average is made up from one month).
 */
export const usualSpending = (finished: readonly TrendPoint[], categoryId?: string): number | null => {
  const active = finished.filter(isActiveMonth);
  return active.length < MIN_HISTORY
    ? null
    : averageOf(active.map(point => (categoryId === undefined ? point.spent : (point.byCategory[categoryId] ?? 0))));
};

/**
 * A plain fact about a month, for the screen to word. Each names the figures
 * it rests on, so the sentence can show them and a reader can check it.
 */
export type Insight =
  | {kind: 'spentAboveAverage' | 'spentBelowAverage'; percent: number; spent: number; average: number; months: number}
  | {
      kind: 'categoryAboveAverage' | 'categoryBelowAverage';
      categoryId: string;
      percent: number;
      spent: number;
      average: number;
      months: number;
    }
  | {kind: 'biggestCategory'; categoryId: string; percent: number; spent: number}
  | {kind: 'highestOfMonths' | 'lowestOfMonths'; months: number; spent: number}
  | {kind: 'keptShare'; percent: number; kept: number; received: number}
  | {kind: 'spentMoreThanReceived'; over: number; received: number};

/** A difference under this share of the average is not worth saying. */
const NOTABLE_PERCENT = 10;
/** A category is compared with its average only when either is at least this share of the month's spending. */
const NOTABLE_SHARE = 0.05;
/** An average needs at least this many earlier months. */
const MIN_HISTORY = 2;

/**
 * What can be said about `month` given the months before it (`history`,
 * oldest first, the months immediately before). Ordered as the screen shows
 * them; at most one line per kind of fact, and none that the numbers do not
 * carry: no average from fewer than two months, no percentage of nothing.
 *
 * `month` should be a finished month: an unfinished one compared with whole
 * months would always look low. The caller picks it (the last finished one).
 */
export const insightsOf = (month: TrendPoint, history: readonly TrendPoint[]): Insight[] => {
  const insights: Insight[] = [];
  const active = history.filter(isActiveMonth);
  const months = active.length;

  if (months >= MIN_HISTORY) {
    const average = averageOf(active.map(point => point.spent));
    const {percent} = changeOf(month.spent, average);
    if (percent !== null && Math.abs(percent) >= NOTABLE_PERCENT) {
      insights.push({
        kind: percent > 0 ? 'spentAboveAverage' : 'spentBelowAverage',
        percent: Math.abs(percent),
        spent: month.spent,
        average,
        months,
      });
    }

    // The category furthest above its own average, and the one furthest below, by amount.
    const floor = Math.max(month.spent, average) * NOTABLE_SHARE;
    const moves = [
      ...new Set([...Object.keys(month.byCategory), ...active.flatMap(point => Object.keys(point.byCategory))]),
    ]
      .map(categoryId => {
        const spent = month.byCategory[categoryId] ?? 0;
        const categoryAverage = averageOf(active.map(point => point.byCategory[categoryId] ?? 0));
        return {categoryId, spent, average: categoryAverage, change: changeOf(spent, categoryAverage)};
      })
      .filter(
        move =>
          move.change.percent !== null &&
          Math.abs(move.change.percent) >= NOTABLE_PERCENT &&
          Math.max(move.spent, move.average) >= floor,
      )
      .sort((a, b) => b.change.amount - a.change.amount || a.categoryId.localeCompare(b.categoryId));
    const up = moves[0];
    const down = moves.at(-1);
    if (up && up.change.amount > 0 && up.change.percent !== null) {
      insights.push({
        kind: 'categoryAboveAverage',
        categoryId: up.categoryId,
        percent: up.change.percent,
        spent: up.spent,
        average: up.average,
        months,
      });
    }
    if (down && down.change.amount < 0 && down.change.percent !== null) {
      insights.push({
        kind: 'categoryBelowAverage',
        categoryId: down.categoryId,
        percent: Math.abs(down.change.percent),
        spent: down.spent,
        average: down.average,
        months,
      });
    }

    if (month.spent > 0 && active.every(point => point.spent < month.spent)) {
      insights.push({kind: 'highestOfMonths', months: months + 1, spent: month.spent});
    } else if (month.count > 0 && active.every(point => point.spent > month.spent)) {
      insights.push({kind: 'lowestOfMonths', months: months + 1, spent: month.spent});
    }
  }

  if (month.spent > 0) {
    const [top] = Object.entries(month.byCategory).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (top && top[1] > 0) {
      insights.push({
        kind: 'biggestCategory',
        categoryId: top[0],
        percent: Math.round((top[1] / month.spent) * 100),
        spent: top[1],
      });
    }
  }

  if (month.received > 0) {
    insights.push(
      month.kept >= 0
        ? {
            kind: 'keptShare',
            percent: Math.round((month.kept / month.received) * 100),
            kept: month.kept,
            received: month.received,
          }
        : {kind: 'spentMoreThanReceived', over: -month.kept, received: month.received},
    );
  }
  return insights;
};
