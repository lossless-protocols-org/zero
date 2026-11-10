/**
 * Per-month slots for data that screens read by month (expenses, money in).
 *
 * One slot per slice used to hold "the" month, so any code that fetched
 * another month (the widget queue replaying a Siri entry, the quick-add sheet,
 * a back-dated add, the Money tab on its own month) replaced the rows under
 * whatever month another screen was showing (audit 2026-11-08 §3.2). Now a
 * fetch for month X writes only X's slot, and a screen reads the month it
 * shows; within a month the newest request still wins. The least recently
 * fetched months beyond MAX_CACHED_MONTHS are dropped, so browsing years of
 * history does not keep every month in memory.
 */
/** @internal test */
export const MAX_CACHED_MONTHS = 6;

interface MonthSlot<T> {
  data: T;
  /** The newest request for this month; an older one that resolves later is dropped. */
  requestId: string | null;
}

export interface MonthCache<T> {
  months: Record<string, MonthSlot<T>>;
  /** Fetch order, oldest first, for eviction. */
  order: string[];
}

export const emptyMonthCache = <T>(): MonthCache<T> => ({months: {}, order: []});

/** Marks a request as the newest for `yearMonth`; creates the slot (holding `empty`) when new. */
export const beginMonth = <T>(cache: MonthCache<T>, yearMonth: string, requestId: string, empty: T): void => {
  const slot = cache.months[yearMonth];
  if (slot) {
    slot.requestId = requestId;
  } else {
    cache.months[yearMonth] = {data: empty, requestId};
  }
  cache.order = [...cache.order.filter(month => month !== yearMonth), yearMonth];
  while (cache.order.length > MAX_CACHED_MONTHS) {
    const oldest = cache.order.shift();
    if (oldest !== undefined) {
      delete cache.months[oldest];
    }
  }
};

/** Stores `data` for `yearMonth` when `requestId` is still that month's newest request. */
export const settleMonth = <T>(cache: MonthCache<T>, yearMonth: string, requestId: string, data: T): void => {
  const slot = cache.months[yearMonth];
  if (slot && slot.requestId === requestId) {
    slot.data = data;
  }
};
