import {shiftIsoDay, toDayKey} from './dates';
import type {IsoDay} from './types';

/**
 * The one place a month's boundaries are worked out (3.0, plan P11; rule R9).
 *
 * zero's "month" is a period that starts on the same day of every calendar
 * month: day 1 for everyone by default, or the day the user's salary arrives
 * (Pro, `users.month_start_day`, 1 to 28, so every month has that day). A
 * period is named by the 'YYYY-MM' of the month it STARTS in: with day 7,
 * '2026-11' is 7 Nov to 6 Dec. Budgets, the store's month slots, the widget
 * and every link keep using that key; only what the key covers changes.
 *
 * A period is half-open on day strings, `[start, next)`, which is also a
 * range on stored dates ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss' sort as text).
 * A custom range (Reports) is the same shape with any two days.
 *
 * Pure. Whether the user's day applies (Pro) is decided above the data layer
 * (src/pro/monthStart.ts, `effectivePeriod`); nothing below it asks.
 * `__tests__/arch/monthBoundaries.test.ts` keeps every other module from
 * computing a month boundary by itself.
 */
export interface Period {
  /** The first day in the period. */
  start: IsoDay;
  /** The first day after it. */
  next: IsoDay;
}

export const DEFAULT_MONTH_START_DAY = 1;
/** The last day a month can start on: February always has a 28th. */
export const MAX_MONTH_START_DAY = 28;

/** A stored month start day as a usable one: a whole number 1 to 28, anything else is 1. */
export const toMonthStartDay = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_MONTH_START_DAY
    ? value
    : DEFAULT_MONTH_START_DAY;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const pad2 = (n: number): string => String(n).padStart(2, '0');

const parseKey = (yearMonth: string): {year: number; month: number} => {
  const m = MONTH_RE.exec(yearMonth);
  if (!m) {
    throw new Error(`Invalid year-month "${yearMonth}", expected YYYY-MM`);
  }
  return {year: Number(m[1]), month: Number(m[2])};
};

/** The key `delta` months from `yearMonth`, by arithmetic (no Date, no time zone). */
export const shiftPeriodKey = (yearMonth: string, delta: number): string => {
  const {year, month} = parseKey(yearMonth);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
};

/** The period named `yearMonth` when months start on `monthStartDay`. */
export const periodFor = (yearMonth: string, monthStartDay: number = DEFAULT_MONTH_START_DAY): Period => {
  parseKey(yearMonth);
  const day = pad2(toMonthStartDay(monthStartDay));
  // Built from a checked 'YYYY-MM' and a day 01 to 28: always a real calendar day.
  return {start: `${yearMonth}-${day}` as IsoDay, next: `${shiftPeriodKey(yearMonth, 1)}-${day}` as IsoDay};
};

/**
 * The key of the period a stored date falls in: its calendar month, or the
 * month before when its day comes before the start day (the 3rd, with months
 * starting on the 7th, still belongs to last month's period).
 */
export const periodKeyOf = (date: string | Date, monthStartDay: number = DEFAULT_MONTH_START_DAY): string => {
  const day = toDayKey(date);
  const key = day.slice(0, 7);
  return Number(day.slice(8, 10)) < toMonthStartDay(monthStartDay) ? shiftPeriodKey(key, -1) : key;
};

/** A range of days the user picked (Reports): `from` to `to`, both included. */
export const rangePeriod = (from: IsoDay, to: IsoDay): Period => {
  if (to < from) {
    throw new Error(`A range cannot end (${to}) before it starts (${from})`);
  }
  return {start: from, next: shiftIsoDay(to, 1)};
};

/** The last day in the period. */
export const lastDayOf = (period: Period): IsoDay => shiftIsoDay(period.next, -1);

const utcDay = (day: string): number =>
  Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;

/** How many days the period has (28 to 31 for a month; any number for a range). */
export const daysIn = (period: Period): number => utcDay(period.next) - utcDay(period.start);

/** Whether local day `day` is in the period. */
export const periodHas = (period: Period, day: string): boolean => day >= period.start && day < period.next;

/** `day`'s place in the period, 1 for its first day. Days outside give a number below 1 or past `daysIn`. */
export const dayNumberIn = (period: Period, day: string): number => utcDay(day) - utcDay(period.start) + 1;

/** Every day of the period, in order. */
export const daysOf = (period: Period): IsoDay[] =>
  Array.from({length: daysIn(period)}, (_, index) => shiftIsoDay(period.start, index));

/** The year a period key belongs to (the year picker lists these). */
export const yearOfKey = (yearMonth: string): number => parseKey(yearMonth).year;

/** The 0-based month a period key names (the month it starts in). */
export const monthIndexOfKey = (yearMonth: string): number => parseKey(yearMonth).month - 1;
