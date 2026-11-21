/**
 * Regression tests for month-name resolution.
 *
 * `getMonthNumber` feeds `YYYY-MM` database query keys. It used to return
 * "00" whenever the month name could not be found in the ACTIVE locale's
 * month list — which happens as soon as a name persisted under one language
 * is read back under another. "2026-00" matches no rows, so the month
 * silently rendered empty.
 *
 * Tickets: M20.
 */

import {getMonthNames, setDayjsLocale, formatMonthLabel} from '../../../src/platform/dateFormat';
import {daysInMonth, toYearMonth} from '../../../src/domain/dates';

describe('month names after a locale change', () => {
  afterEach(() => {
    setDayjsLocale('en');
  });

  it('refreshes the cached month list', () => {
    const english = getMonthNames();
    expect(english[0]).toBe('January');

    setDayjsLocale('fr');
    const french = getMonthNames();
    expect(french[0]).not.toBe('January');

    setDayjsLocale('en');
    expect(getMonthNames()[0]).toBe('January');
  });
});

describe('month by index: no localised name round trip', () => {
  afterEach(() => jest.useRealTimers());

  it('counts days without rolling over from today', () => {
    // On the 31st, dayjs().month(1) rolls into March; the old name-based helper did exactly that.
    jest.useFakeTimers({now: new Date(2026, 9, 31, 12)});
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 3)).toBe(30);
    expect(daysInMonth(2026, 11)).toBe(31);
  });

  it('builds the YYYY-MM key from the index', () => {
    expect(toYearMonth(2026, 0)).toBe('2026-01');
    expect(toYearMonth(2026, 11)).toBe('2026-12');
  });
});

describe('a month as the user sees it (P11)', () => {
  const label = (start: string, next: string, thisYear = 2026) =>
    formatMonthLabel({start, next}, 'monthYearLong', thisYear);

  it('is named when it starts on the 1st', () => {
    expect(formatMonthLabel({start: '2026-11-01', next: '2026-12-01'}, 'monthYearLong', 2026, 'en-IN')).toBe(
      'November 2026',
    );
    expect(formatMonthLabel({start: '2026-11-01', next: '2026-12-01'}, 'monthYear', 2026, 'en-IN')).toBe('Nov 2026');
  });

  it('is shown by its first and last day otherwise, in the locale’s order', () => {
    expect(formatMonthLabel({start: '2026-11-07', next: '2026-12-07'}, 'monthYearLong', 2026, 'en-IN')).toBe(
      '7 Nov – 6 Dec',
    );
    expect(formatMonthLabel({start: '2026-11-07', next: '2026-12-07'}, 'monthYearLong', 2026, 'en-US')).toBe(
      'Nov 7 – Dec 6',
    );
    // February's length shows in the month after it.
    expect(formatMonthLabel({start: '2026-02-28', next: '2026-03-28'}, 'monthYear', 2026, 'en-IN')).toBe(
      '28 Feb – 27 Mar',
    );
  });

  it('names the year when it is not this one, and both years across a year end', () => {
    expect(formatMonthLabel({start: '2025-03-07', next: '2025-04-07'}, 'monthYearLong', 2026, 'en-IN')).toBe(
      '7 Mar – 6 Apr 2025',
    );
    expect(formatMonthLabel({start: '2025-12-15', next: '2026-01-15'}, 'monthYearLong', 2026, 'en-IN')).toBe(
      '15 Dec 2025 – 14 Jan 2026',
    );
    expect(label('2026-11-07', '2026-12-07')).toContain('–');
  });
});
