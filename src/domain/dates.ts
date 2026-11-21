import dayjs, {type Dayjs} from 'dayjs';
import type {IsoDay} from './types';

/**
 * Dates as zero stores and compares them: local ISO strings, 'YYYY-MM-DD'
 * day keys and 'YYYY-MM' month keys. Pure: no device locale, no storage
 * (audit 2026-11-08 §4.5). Anything that depends on the user's language or
 * region (month and weekday names, display formats, "Today"/"Yesterday")
 * lives in platform/dateFormat.ts. Which days a month covers, and which month
 * a date belongs to, is domain/period.ts's alone (3.0, P11).
 */

export type DateInput = string | number | Date | Dayjs | null | undefined;
type DateUnit = 'day' | 'week' | 'month' | 'year' | 'hour' | 'minute' | 'second';

/** A dayjs of `date`; a missing date is now. */
export const parseDate = (date?: DateInput): Dayjs => {
  return date ? dayjs(date) : dayjs();
};

export const formatDate = (date?: DateInput, format: string = 'YYYY-MM-DD'): string => {
  return parseDate(date).format(format);
};

/**
 * The month is carried as a 0-based index, never as its localised name (M20):
 * the name round trip fell back to the current month when it did not resolve,
 * and `dayjs().month(i)` rolled over from today's date (on the 31st,
 * February became March).
 * @internal Used by toDayKey's date check here; tests check it alone.
 */
export const daysInMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex + 1, 0).getDate();

/** The `YYYY-MM` key the database and the slices use. */
export const toYearMonth = (year: number, monthIndex: number): string =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

/** @internal test */
export const diffDates = (date1: DateInput, date2: DateInput, unit: DateUnit = 'day'): number => {
  return parseDate(date1).diff(parseDate(date2), unit);
};

/** Today, local, as a day key. */
export const todayIsoDay = (): IsoDay => formatDate(undefined) as IsoDay; // formatDate's default shape is YYYY-MM-DD

/** True for a 'YYYY-MM-DD' string, so it can be passed where an IsoDay is expected. */
export const isIsoDay = (value: string): value is IsoDay => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * A 'YYYY-MM-DD' day that is on the calendar: 2026-02-29 and 2026-11-31 are not.
 * What the 3.0 tables (transfers, checkpoints, an account's opening day) store.
 */
export const isCalendarDay = (value: string): value is IsoDay => isIsoDay(value) && shiftIsoDay(value, 0) === value;

/**
 * The day `delta` days from a 'YYYY-MM-DD' day, by the calendar (UTC
 * arithmetic, so no time zone or DST shift can skip or repeat a day).
 */
export const shiftIsoDay = (day: string, delta: number): IsoDay => {
  const [year, month, date] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + delta));
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` as IsoDay; // built from three numbers in YYYY-MM-DD form
};

/** A real month key 'YYYY-MM' (month 01–12): what a link or route param must be before it is used as one. */
export const isYearMonth = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export const getTimestamp = (): string => {
  return dayjs().format('YYYYMMDDHHmmss');
};

export const getISODateTime = (): string => {
  return dayjs().format('YYYY-MM-DDTHH:mm:ss');
};

/**
 * Stored dates are local ISO strings (`YYYY-MM-DDTHH:mm:ss`, or `YYYY-MM-DD`
 * from old imports), which sort chronologically as plain strings. Anything
 * else (UTC/offset suffixes, milliseconds, numbers, Date objects, or parts out
 * of range such as `T24:00` or Feb 30, which dayjs rolls forward) goes through
 * dayjs once, so it lands on the same local day the screen always showed.
 */
const LOCAL_ISO_RE = /^([1-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)?$/;

const isFastPathDate = (date: string): boolean => {
  const m = LOCAL_ISO_RE.exec(date);
  if (!m) {
    return false;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (day <= 28) {
    return true;
  }
  return day <= daysInMonth(year, month - 1);
};

/** Local calendar day (`YYYY-MM-DD`) of a stored date, without parsing in the common case. */
export const toDayKey = (date: DateInput): string =>
  typeof date === 'string' && isFastPathDate(date) ? date.slice(0, 10) : formatDate(date, 'YYYY-MM-DD');

/** Keys that are not a real date ('Invalid Date', or '' for a missing date) sort after every date. */
const VALID_KEY_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Orders date keys in `direction` (1 oldest first, -1 newest first), with
 * keys that are not a real date always last. Code-unit comparison is
 * identical to chronological order for these fixed-width ASCII keys, and
 * unlike localeCompare it never calls into ICU / Java's Collator (Hermes on
 * Android), which would cost more than the dayjs parses it replaces.
 */
export const compareDateKeys = (a: string, b: string, direction: 1 | -1): number => {
  const aValid = VALID_KEY_RE.test(a);
  if (aValid !== VALID_KEY_RE.test(b)) {
    return aValid ? -1 : 1;
  }
  return direction * (a < b ? -1 : a > b ? 1 : 0);
};

/** A string that sorts chronologically, parsed at most once per item; '' when there is no date. */
const toSortKey = (date: DateInput): string => {
  if (typeof date === 'string' && isFastPathDate(date)) {
    return date;
  }
  // parseDate treats a missing date as "now", which would float the row to the top.
  return date === null || date === undefined || date === '' ? '' : formatDate(date, 'YYYY-MM-DDTHH:mm:ss');
};

// Sort keys are computed once per item (S3, v2.7.1); the old comparator
// parsed both dates with dayjs on every comparison and compared whole days,
// so rows 2 s apart across midnight compared equal. Ties keep input order;
// rows without a valid date go last in either direction.
const sortByDate = <T extends {date: DateInput}>(items: T[], direction: 1 | -1): T[] =>
  items
    .map(item => ({item, key: toSortKey(item.date)}))
    .sort((a, b) => compareDateKeys(a.key, b.key, direction))
    .map(({item}) => item);

export const sortByDateDesc = <T extends {date: DateInput}>(items: T[]): T[] => sortByDate(items, -1);

/** @internal test */
export const sortByDateAsc = <T extends {date: DateInput}>(items: T[]): T[] => sortByDate(items, 1);
