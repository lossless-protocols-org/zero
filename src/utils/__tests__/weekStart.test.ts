import {leadingBlanks, rotateWeekdays, weekStartOffset} from '../weekStart';

const SUNDAY_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

describe('rotateWeekdays', () => {
  it('leaves Sunday-first untouched for the default', () => {
    expect(rotateWeekdays(SUNDAY_FIRST, 'sunday')).toEqual(SUNDAY_FIRST);
  });

  it('starts with Monday and wraps Sunday to the end', () => {
    expect(rotateWeekdays(SUNDAY_FIRST, 'monday')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('handles an empty array', () => {
    expect(rotateWeekdays([], 'monday')).toEqual([]);
  });
});

describe('weekStartOffset', () => {
  it('is 0 for sunday, 1 for monday', () => {
    expect(weekStartOffset('sunday')).toBe(0);
    expect(weekStartOffset('monday')).toBe(1);
  });
});

describe('leadingBlanks — the calendar grid alignment', () => {
  // dayjs .day(): 0 = Sunday … 6 = Saturday.

  it('month starting on Sunday: 0 blanks under sunday-start, 6 under monday-start', () => {
    expect(leadingBlanks(0, 'sunday')).toBe(0);
    expect(leadingBlanks(0, 'monday')).toBe(6);
  });

  it('month starting on Monday: 1 blank under sunday-start, 0 under monday-start', () => {
    expect(leadingBlanks(1, 'sunday')).toBe(1);
    expect(leadingBlanks(1, 'monday')).toBe(0);
  });

  it('month starting on Saturday: 6 blanks under sunday-start, 5 under monday-start', () => {
    expect(leadingBlanks(6, 'sunday')).toBe(6);
    expect(leadingBlanks(6, 'monday')).toBe(5);
  });

  it('sunday-start blanks equal the raw first-day index (historical behaviour)', () => {
    for (let day = 0; day < 7; day++) {
      expect(leadingBlanks(day, 'sunday')).toBe(day);
    }
  });

  it('always yields a value in 0..6', () => {
    for (let day = 0; day < 7; day++) {
      for (const start of ['sunday', 'monday'] as const) {
        const blanks = leadingBlanks(day, start);
        expect(blanks).toBeGreaterThanOrEqual(0);
        expect(blanks).toBeLessThanOrEqual(6);
      }
    }
  });

  it('the day always lands under its own header column', () => {
    // Column of day-1 in the grid must equal the index of that weekday in the
    // rotated header — the property that keeps the grid from shearing.
    for (let firstDay = 0; firstDay < 7; firstDay++) {
      for (const start of ['sunday', 'monday'] as const) {
        const header = rotateWeekdays(SUNDAY_FIRST, start);
        const column = leadingBlanks(firstDay, start) % 7;
        expect(header[column]).toBe(SUNDAY_FIRST[firstDay]);
      }
    }
  });
});
