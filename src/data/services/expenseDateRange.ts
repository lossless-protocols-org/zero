import {Q} from '@nozbe/watermelondb';
import type {Where} from '@nozbe/watermelondb/QueryDescription';

/**
 * Lexical date ranges for expense queries (S2, v2.7.1). Dates are ISO strings
 * ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss'), which sort chronologically, so a
 * month is `[YYYY-MM-01, next month's 01)` and a day `[day, next day)`. With
 * the composite (user_id, date) index (schema v4) both are index ranges; the
 * old `LIKE 'YYYY_MM%'` could use no index at all.
 */
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number): string => String(n).padStart(2, '0');

const range = (from: string, to: string): Where[] => [Q.where('date', Q.gte(from)), Q.where('date', Q.lt(to))];

export const monthDateClauses = (yearMonth: string): Where[] => {
  const m = MONTH_RE.exec(yearMonth);
  const month = m ? Number(m[2]) : 0;
  if (!m || month < 1 || month > 12) {
    throw new Error(`Invalid year-month "${yearMonth}", expected YYYY-MM`);
  }
  const year = Number(m[1]);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad2(month + 1)}`;
  return range(`${yearMonth}-01`, `${next}-01`);
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
