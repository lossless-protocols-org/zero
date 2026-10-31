import StorageService from '../../utils/storage';
import {getAvailableExpenseYears} from './expenseService';
import {appendErrorLog} from '../../utils/errorLog';

/**
 * Per-user cache of the years that have expenses, used to populate the
 * month/year picker without querying the whole expenses table.
 *
 * The key is scoped by userId: restoring a backup creates a NEW user id, and
 * a global key would leave the previous user's years on screen (with the
 * key-presence short-circuit below making the stale value permanent).
 */
const CACHE_KEY_PREFIX = 'available-expense-years';

const cacheKey = (userId: string): string => `${CACHE_KEY_PREFIX}:${userId}`;

const ensureCurrentYear = (years: number[]): number[] => {
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) {
    return [...years, currentYear].sort((a, b) => a - b);
  }
  return years;
};

/**
 * The cached list, or null when the key is missing or holds anything but a
 * list of integers. This file is the key's only writer, so an unreadable
 * value is a bug or a storage fault and goes in Diagnostics.
 */
const readCachedYears = (userId: string): number[] | null => {
  const raw = StorageService.getItemSync(cacheKey(userId));
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((year): year is number => Number.isInteger(year))) {
      return parsed;
    }
  } catch {
    // fall through to the log below
  }
  appendErrorLog(new Error(`availableYearsCache: unreadable value for ${cacheKey(userId)}`), false);
  return null;
};

/** @internal test */
export const getCachedYears = (userId: string): number[] => ensureCurrentYear(readCachedYears(userId) ?? []);

const setCachedYears = (userId: string, years: number[]): void => {
  StorageService.setItemSync(cacheKey(userId), JSON.stringify(years));
};

/**
 * The cache key's presence is the "already known" signal (L5, v2.7.1). The
 * old `cached.length > 1` check never held for a user whose expenses all fall
 * in the current year (that year is always injected), so every Home and
 * Reports mount rescanned the table for them.
 */
export const loadAvailableYears = async (userId: string): Promise<number[]> => {
  const cached = readCachedYears(userId);
  if (cached) {
    return ensureCurrentYear(cached);
  }
  try {
    return await refreshYearsCache(userId);
  } catch (error) {
    // Callers `.then()` this from a mount effect; a rejection there would be
    // unhandled and the picker would silently shrink to the current year.
    // Nothing is cached, so the next mount retries.
    appendErrorLog(error, false);
    return ensureCurrentYear([]);
  }
};

/**
 * Called after an expense is saved. With a known list the year is added in
 * place; with no (or an unreadable) list it is NOT written, because a
 * two-entry list would then count as "known" forever — the list is rebuilt
 * from the database instead.
 */
export const ensureYearInCache = (userId: string, year: number): number[] => {
  const cached = readCachedYears(userId);
  if (!cached) {
    refreshYearsCache(userId).catch((error: unknown) => {
      appendErrorLog(error, false);
    });
    return ensureCurrentYear([year]);
  }
  if (!cached.includes(year)) {
    const updated = [...cached, year].sort((a, b) => a - b);
    setCachedYears(userId, updated);
    return ensureCurrentYear(updated);
  }
  return ensureCurrentYear(cached);
};

/** Re-reads the years from the database. Call after an import/restore. */
export const refreshYearsCache = async (userId: string): Promise<number[]> => {
  const years = await getAvailableExpenseYears(userId);
  const withCurrent = ensureCurrentYear(years);
  setCachedYears(userId, withCurrent);
  return withCurrent;
};
