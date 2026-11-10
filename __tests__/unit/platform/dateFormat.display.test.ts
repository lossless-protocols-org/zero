/**
 * M32 (v2.7.1): display dates follow the user's locale — the order of day and
 * month by region — instead of an English literal ('Do MMM YYYY').
 */
import {formatDisplayDate} from '../../../src/platform/dateFormat';
import {clearErrorLog, getErrorLog} from '../../../src/platform/errorLog';

describe('formatDisplayDate', () => {
  it('orders day and month by region, not by language', () => {
    expect(formatDisplayDate('2026-10-31', 'dayMonth', 'en-US')).toBe('Oct 31');
    expect(formatDisplayDate('2026-10-31', 'dayMonth', 'en-GB')).toBe('31 Oct');
  });

  it('shortens a month for the compact month pill', () => {
    expect(formatDisplayDate('2026-10-01', 'monthYear', 'en-US')).toBe('Oct 2026');
    expect(formatDisplayDate('2026-10-01', 'monthYear', 'tr-TR')).toBe('Eki 2026');
  });

  it('adds the year for a full date', () => {
    expect(formatDisplayDate('2026-10-31', 'date', 'en-US')).toBe('Oct 31, 2026');
    expect(formatDisplayDate('2026-10-31', 'date', 'en-IN')).toBe('31 Oct 2026');
  });

  it('adds the time in the locale clock', () => {
    const text = formatDisplayDate('2026-10-31T14:05:00', 'dateTime', 'en-GB');
    expect(text).toContain('31 Oct 2026');
    expect(text).toContain('14:05');
  });

  it('reads a date-only key as that local day', () => {
    // dayjs parses 'YYYY-MM-DD' as local midnight; new Date() would read UTC.
    expect(formatDisplayDate('2026-01-01', 'date', 'en-US')).toBe('Jan 1, 2026');
  });

  it('shows an unparseable date as text instead of throwing', () => {
    expect(formatDisplayDate('garbage', 'dayMonth', 'en-US')).toBe('Invalid Date');
  });

  it('shows a missing date as blank, not as today', () => {
    expect(formatDisplayDate('', 'date', 'en-US')).toBe('');
    expect(formatDisplayDate(null, 'date', 'en-US')).toBe('');
    expect(formatDisplayDate(undefined, 'date', 'en-US')).toBe('');
  });

  it('falls back to en-US for a locale Intl rejects, logging it once', () => {
    clearErrorLog();
    expect(formatDisplayDate('2026-10-31', 'date', 'bad_TAG!')).toBe('Oct 31, 2026');
    expect(formatDisplayDate('2026-10-30', 'date', 'bad_TAG!')).toBe('Oct 30, 2026');
    expect(getErrorLog()).toHaveLength(1);
  });

  it('translates month names', () => {
    expect(formatDisplayDate('2026-10-31', 'date', 'tr-TR')).toContain('Eki');
  });
});
