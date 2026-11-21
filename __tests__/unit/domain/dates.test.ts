import {isCalendarDay, shiftIsoDay} from '../../../src/domain/dates';

describe('shiftIsoDay and isCalendarDay (3.0)', () => {
  it('moves by calendar days across months, years and leap days', () => {
    expect(shiftIsoDay('2026-02-28', 1)).toBe('2026-03-01');
    expect(shiftIsoDay('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftIsoDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDay('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('knows a day on the calendar from one that only looks like it', () => {
    expect(isCalendarDay('2028-02-29')).toBe(true);
    expect(isCalendarDay('2026-02-29')).toBe(false);
    expect(isCalendarDay('2026-11-31')).toBe(false);
    expect(isCalendarDay('2026-11')).toBe(false);
  });
});
