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

import {getMonthNames, setDayjsLocale} from '../../../src/platform/dateFormat';
import {daysInMonth, toYearMonth, firstWeekdayOfMonth} from '../../../src/domain/dates';

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

  it('builds the YYYY-MM key and the first weekday from the index', () => {
    expect(toYearMonth(2026, 0)).toBe('2026-01');
    expect(toYearMonth(2026, 11)).toBe('2026-12');
    expect(firstWeekdayOfMonth(2026, 9)).toBe(4); // 1 October 2026 is a Thursday
  });
});
