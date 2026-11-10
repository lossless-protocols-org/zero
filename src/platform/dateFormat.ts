import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localeData from 'dayjs/plugin/localeData';
import {getDeviceLocaleInfo, getFormatLocale} from './locale';
import {appendErrorLog} from './errorLog';
import {parseDate, type DateInput} from '../domain/dates';

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

/** The language dayjs was last switched to; null until the first switch. */
let appliedLanguage: string | null = null;

/**
 * Switches dayjs to `languageCode` and refreshes the cached month/weekday
 * arrays. Call this whenever the app language changes — dayjs.locale() alone
 * leaves the cached arrays (and therefore every calendar header) stale.
 * Switching to the language already applied does nothing: at start this
 * module sets the locale, then i18n's init announces the same language
 * (audit 2026-11-08 §8, "initialised twice at import").
 */
export const setDayjsLocale = (languageCode: string): void => {
  if (languageCode === appliedLanguage) {
    return;
  }
  try {
    const loader = DAYJS_LOCALES[languageCode];
    if (loader) {
      loader();
      dayjs.locale(languageCode);
    } else {
      dayjs.locale('en');
    }
    appliedLanguage = languageCode;
  } catch {
    // Stay on whatever locale is currently active; the next switch to this language tries again.
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

/**
 * Display shapes (M32, v2.7.1). Intl orders them by the user's REGION, which
 * dayjs's per-language locales cannot: en-US "Oct 31, 2026", en-IN
 * "31 Oct 2026". Storage keys keep using formatDate with fixed patterns.
 */
const DISPLAY_DATE_OPTIONS = {
  dayMonth: {day: 'numeric', month: 'short'},
  monthYear: {month: 'short', year: 'numeric'},
  monthYearLong: {month: 'long', year: 'numeric'},
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

// Use cached locale data - no array recreation on each call
export const getMonthNames = (): string[] => MONTHS;
export const getMonthNamesShort = (): string[] => MONTHS_SHORT;
export const getWeekdayNames = (): string[] => WEEKDAYS;
export const getWeekdayShortNames = (): string[] => WEEKDAYS_SHORT;

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
