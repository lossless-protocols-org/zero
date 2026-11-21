import {useCallback, useMemo, useRef, useState} from 'react';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {getTrends} from '../../../data/services/trendsService';
import {insightsOf, isActiveMonth, trendMonths, type Insight, type TrendPoint} from '../../../domain/trends';
import {trendTiles} from '../../../domain/trendTiles';
import {appendErrorLog} from '../../../platform/errorLog';
import {monthKeyNow} from '../../../pro/monthStart';
import {useFreshWhileFocused} from '../../../ui/hooks/useFreshWhileFocused';
import {useMonthStartDay} from '../../../ui/hooks/useMonthStartDay';

/** How many months can be shown at most; one more is read so the first shown month has a month before it. */
export const TREND_CHOICES = [3, 6, 12] as const;
export type TrendLength = (typeof TREND_CHOICES)[number];
const READ_MONTHS = 13;
/** An average is taken over at most this many months before the one described. */
const HISTORY_MONTHS = 6;

/**
 * Trends (3.0 Pro, plan P12): the last thirteen months read once (one SQL
 * statement on the phone), the last 3, 6 or 12 shown. The months are the
 * user's months (their month start day). What "stood out" is said about the
 * last FINISHED month, against up to six months before it: the month in
 * progress compared with whole months would always look low.
 */
export const useTrends = (length: TrendLength) => {
  const userId = useAppSelector(selectUserId);
  const monthStartDay = useMonthStartDay();
  // Read per render: the month it is now moves at midnight on the start day.
  const currentKey = monthKeyNow();
  const [loaded, setLoaded] = useState<{key: string; points: TrendPoint[]} | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const key = `${userId}|${monthStartDay}|${currentKey}`;

  useFreshWhileFocused(
    useCallback(() => {
      if (!userId) {
        return;
      }
      const mine = ++request.current;
      getTrends(userId, trendMonths(currentKey, READ_MONTHS, monthStartDay))
        .then(points => {
          if (mine === request.current) {
            setLoaded({key, points});
            setFailed(false);
          }
        })
        .catch((error: unknown) => {
          appendErrorLog(error, false);
          if (mine === request.current) {
            setFailed(true);
          }
        });
    }, [userId, currentKey, monthStartDay, key]),
    ['expenses', 'refunds', 'incomes'],
  );

  // Never another user's or another month start day's figures.
  const all = loaded?.key === key ? loaded.points : null;
  return useMemo(() => {
    if (!all) {
      return {ready: false as const, failed};
    }
    const shown = all.slice(-length);
    // The last finished month: it always exists in thirteen months.
    const finished = all.at(-2);
    const history = all.slice(0, -2).slice(-HISTORY_MONTHS);
    const insights: Insight[] = finished ? insightsOf(finished, history) : [];
    return {
      ready: true as const,
      failed,
      /** The months shown, oldest first; the last is the month in progress. */
      shown,
      /** The month before the first shown one, for its change. */
      beforeShown: all.at(-length - 1) ?? null,
      finished: finished ?? null,
      insights,
      /** The same facts as tiles, shares first (domain/trendTiles). */
      tiles: finished ? trendTiles(finished, history, insights) : [],
      /** How many finished months have anything entered: a trend needs two. */
      finishedMonths: all.slice(0, -1).filter(isActiveMonth).length,
      /** Whether there is anything to show at all. */
      empty: all.every(point => point.count === 0 && point.received === 0 && point.spent === 0),
    };
  }, [all, length, failed]);
};
