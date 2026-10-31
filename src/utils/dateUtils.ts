import type {IsoDay} from '../domain/types';
import dayjs, {Dayjs} from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localeData from 'dayjs/plugin/localeData';
import {getDeviceLocaleInfo, getFormatLocale} from './locale';
import {appendErrorLog} from './errorLog';

dayjs.extend(calendar);
dayjs.extend(advancedFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(localeData);

const DAYJS_LOCALES: Record<string, () => void> = {
  ar: () => require('dayjs/locale/ar'),
  bg: () => require('dayjs/locale/bg'),
  bn: () => require('dayjs/locale/bn'),
  cs: () => require('dayjs/locale/cs'),
  da: () => require('dayjs/locale/da'),
  de: () => require('dayjs/locale/de'),
  el: () => require('dayjs/locale/el'),
  es: () => require('dayjs/locale/es'),
  fa: () => require('dayjs/locale/fa'),
  fi: () => require('dayjs/locale/fi'),
  fr: () => require('dayjs/locale/fr'),
  he: () => require('dayjs/locale/he'),
  hi: () => require('dayjs/locale/hi'),
  hr: () => require('dayjs/locale/hr'),
  hu: () => require('dayjs/locale/hu'),
  id: () => require('dayjs/locale/id'),
  it: () => require('dayjs/locale/it'),
  ja: () => require('dayjs/locale/ja'),
  ko: () => require('dayjs/locale/ko'),
  ms: () => require('dayjs/locale/ms'),
  nb: () => require('dayjs/locale/nb'),
  nl: () => require('dayjs/locale/nl'),
  pl: () => require('dayjs/locale/pl'),
  pt: () => require('dayjs/locale/pt'),
  ro: () => require('dayjs/locale/ro'),
  ru: () => require('dayjs/locale/ru'),
  sk: () => require('dayjs/locale/sk'),
  sv: () => require('dayjs/locale/sv'),
  th: () => require('dayjs/locale/th'),
  tr: () => require('dayjs/locale/tr'),
  uk: () => require('dayjs/locale/uk'),
  vi: () => require('dayjs/locale/vi'),
  zh: () => require('dayjs/locale/zh'),
};

// Cached locale data — recomputed by setDayjsLocale(), never per call.
let MONTHS = dayjs.months();
let MONTHS_SHORT = dayjs.monthsShort();
let WEEKDAYS = dayjs.weekdays();
let WEEKDAYS_SHORT = dayjs.weekdaysShort();

const refreshLocaleData = () => {
  MONTHS = dayjs.months();
  MONTHS_SHORT = dayjs.monthsShort();
  WEEKDAYS = dayjs.weekdays();
  WEEKDAYS_SHORT = dayjs.weekdaysShort();
};

/**
 * Switches dayjs to `languageCode` and refreshes the cached month/weekday
 * arrays. Call this whenever the app language changes — dayjs.locale() alone
 * leaves the cached arrays (and therefore every calendar header) stale.
 */
export const setDayjsLocale = (languageCode: string): void => {
  try {
    const loader = DAYJS_LOCALES[languageCode];
    if (loader) {
      loader();
      dayjs.locale(languageCode);
    } else {
      dayjs.locale('en');
    }
  } catch {
    // Stay on whatever locale is currently active
  }
  refreshLocaleData();
};

const initDayjsLocale = () => {
  try {
    // getFormatLocale() honours a user override; falling back to the device
    // locale only would revert the user's choice on every cold start.
    const languageCode = getFormatLocale().split('-')[0] ?? 'en';
    setDayjsLocale(languageCode);
  } catch {
    const {languageCode} = getDeviceLocaleInfo();
    setDayjsLocale(languageCode);
  }
};

initDayjsLocale();

type DateInput = string | number | Date | Dayjs | null | undefined;
type DateUnit = 'day' | 'week' | 'month' | 'year' | 'hour' | 'minute' | 'second';

const parseDate = (date?: DateInput): Dayjs => {
  return date ? dayjs(date) : dayjs();
};

export const now = (): Dayjs => dayjs();

export const formatDate = (date?: DateInput, format: string = 'YYYY-MM-DD'): string => {
  return parseDate(date).format(format);
};

/**
 * Display shapes (M32, v2.7.1). Intl orders them by the user's REGION, which
 * dayjs's per-language locales cannot: en-US "Oct 31, 2026", en-IN
 * "31 Oct 2026". Storage keys keep using formatDate with fixed patterns.
 */
const DISPLAY_DATE_OPTIONS = {
  dayMonth: {day: 'numeric', month: 'short'},
  monthYear: {month: 'short', year: 'numeric'},
  date: {day: 'numeric', month: 'short', year: 'numeric'},
  dateTime: {day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'},
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

type DisplayDateStyle = keyof typeof DISPLAY_DATE_OPTIONS;

// One formatter per locale + shape: the day label runs once per list group.
const displayDateFormatters = new Map<string, Intl.DateTimeFormat>();

export const formatDisplayDate = (
  date: DateInput,
  style: DisplayDateStyle,
  locale: string = getFormatLocale(),
): string => {
  // A missing date is blank: parseDate would read it as now and show today.
  if (date === null || date === undefined || date === '') {
    return '';
  }
  const key = `${locale}|${style}`;
  let formatter = displayDateFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(locale, DISPLAY_DATE_OPTIONS[style]);
    } catch (error) {
      // A tag this engine's Intl rejects (a stale override, say) must not take
      // every list down. Logged once: the fallback is cached under this key.
      appendErrorLog(error, false);
      formatter = new Intl.DateTimeFormat('en-US', DISPLAY_DATE_OPTIONS[style]);
    }
    displayDateFormatters.set(key, formatter);
  }
  // Through dayjs so a 'YYYY-MM-DD' key is that LOCAL day, not UTC midnight.
  const parsed = parseDate(date);
  // Intl throws on an invalid Date; one garbage row from an old import must
  // not take the list down, so it reads "Invalid Date" as its day key does.
  return parsed.isValid() ? formatter.format(parsed.toDate()) : parsed.format();
};

export const getCurrentYear = (): number => dayjs().year();

// Use cached locale data - no array recreation on each call
export const getMonthNames = (): string[] => MONTHS;
export const getMonthNamesShort = (): string[] => MONTHS_SHORT;
export const getWeekdayNames = (): string[] => WEEKDAYS;
export const getWeekdayShortNames = (): string[] => WEEKDAYS_SHORT;

/**
 * The month is carried as a 0-based index, never as its localised name (M20):
 * the name round trip fell back to the current month when it did not resolve,
 * and `dayjs().month(i)` rolled over from today's date (on the 31st,
 * February became March).
 */
export const daysInMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex + 1, 0).getDate();

/** 0 = Sunday, like dayjs's `.day()`. */
export const firstWeekdayOfMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex, 1).getDay();

/** The `YYYY-MM` key the database and the slices use. */
export const toYearMonth = (year: number, monthIndex: number): string =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

/** Days in a month expressed as a `YYYY-MM` key (the DB/query convention). */
export const getDaysInMonthByYearMonth = (yearMonth: string): number => {
  return dayjs(`${yearMonth}-01`).daysInMonth();
};

/** @internal test */
export const diffDates = (date1: DateInput, date2: DateInput, unit: DateUnit = 'day'): number => {
  return parseDate(date1).diff(parseDate(date2), unit);
};

/** Translated by src/i18n on every language change; utils stay free of i18next. */
interface CalendarLabels {
  today: string;
  tomorrow: string;
  yesterday: string;
  /** A dayjs format, e.g. "[Last] dddd". */
  lastWeek: string;
}

let calendarLabels: CalendarLabels = {today: '', tomorrow: '', yesterday: '', lastWeek: 'dddd'};

export const setCalendarLabels = (labels: CalendarLabels): void => {
  calendarLabels = labels;
};

/** True for a 'YYYY-MM-DD' string, so it can be passed where an IsoDay is expected. */
export const isIsoDay = (value: string): value is IsoDay => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const formatCalendar = (date: DateInput): string => {
  const parsed = parseDate(date);
  return parsed.calendar(null, {
    sameDay: '[' + calendarLabels.today + ']',
    nextDay: '[' + calendarLabels.tomorrow + ']',
    nextWeek: 'dddd',
    lastDay: '[' + calendarLabels.yesterday + ']',
    lastWeek: calendarLabels.lastWeek,
    // Bracketed: a literal for dayjs. The locale's own date (M32), not 'Do MMM YYYY'.
    sameElse: '[' + formatDisplayDate(parsed, 'date') + ']',
  });
};

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
