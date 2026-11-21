import {Q} from '@nozbe/watermelondb';
import type {Where} from '@nozbe/watermelondb/QueryDescription';
import {shiftIsoDay} from '../../domain/dates';
import type {Period} from '../../domain/period';

/**
 * Lexical date ranges for expense queries (S2, v2.7.1). Dates are ISO strings
 * ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss'), which sort chronologically, so a
 * period is `[its first day, the first day after it)` and a day `[day, next day)`. With
 * the composite (user_id, date) index (schema v4) both are index ranges; the
 * old `LIKE 'YYYY_MM%'` could use no index at all.
 */
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number): string => String(n).padStart(2, '0');

const range = (from: string, to: string): Where[] => [Q.where('date', Q.gte(from)), Q.where('date', Q.lt(to))];

/**
 * The rows dated in a period (domain/period.ts): a month as the user's month
 * start day cuts it, or a range picked on Reports. The period is worked out
 * above the data layer; this only turns it into the index range.
 */
export const periodClauses = (period: Period): Where[] => {
  dayDateClauses(period.start); // real calendar days, or a throw
  dayDateClauses(period.next);
  if (period.next <= period.start) {
    throw new Error(`Invalid period "${period.start}" to "${period.next}": it must end after it starts`);
  }
  return range(period.start, period.next);
};

/**
 * Every row dated after day `after` and on or before day `upTo` ('YYYY-MM-DD'
 * both; `after` null: from the beginning). Rows with a time of day fall on
 * the day their date string starts with, as a month range counts them.
 */
export const dayRangeClauses = (after: string | null, upTo: string): Where[] => {
  dayDateClauses(upTo); // a real calendar day, or a throw
  const end = Q.where('date', Q.lt(shiftIsoDay(upTo, 1)));
  if (after === null) {
    return [end];
  }
  dayDateClauses(after);
  return [Q.where('date', Q.gte(shiftIsoDay(after, 1))), end];
};

export const dayDateClauses = (date: string): Where[] => {
  const m = DAY_RE.exec(date);
  if (!m) {
    throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  // Date.UTC normalises overflow (Feb 30 → Mar 2), so a round-trip check rejects impossible days.
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`Invalid date "${date}", expected a real calendar day`);
  }
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return range(date, `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`);
};
