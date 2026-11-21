/**
 * The one place a month's boundaries are worked out (plan P11): a period is
 * named by the month it starts in, runs from the start day to the day before
 * the next one, and every stored date falls in exactly one. Checked by hand
 * for the days the plan names (1, 7, 15, 28) and by property for all of them.
 * The arithmetic is on day strings, so no zone or DST change can move a boundary.
 */

import fc from 'fast-check';
import {
  MAX_MONTH_START_DAY,
  dayNumberIn,
  daysIn,
  daysOf,
  lastDayOf,
  monthIndexOfKey,
  periodFor,
  periodHas,
  periodKeyOf,
  rangePeriod,
  shiftPeriodKey,
  toMonthStartDay,
  yearOfKey,
} from '../../../src/domain/period';
import {shiftIsoDay, toDayKey} from '../../../src/domain/dates';
import type {IsoDay} from '../../../src/domain/types';

const day = (value: string) => value as IsoDay; // the tests' days are written as YYYY-MM-DD

describe('a period by its key', () => {
  it('with day 1 is the calendar month', () => {
    expect(periodFor('2026-11')).toEqual({start: '2026-11-01', next: '2026-12-01'});
    expect(periodFor('2026-12', 1)).toEqual({start: '2026-12-01', next: '2027-01-01'});
    expect(daysIn(periodFor('2028-02'))).toBe(29);
  });

  it('with a salary day starts on it and ends the day before the next', () => {
    expect(periodFor('2026-11', 7)).toEqual({start: '2026-11-07', next: '2026-12-07'});
    expect(lastDayOf(periodFor('2026-11', 7))).toBe('2026-12-06');
    expect(periodFor('2026-12', 15)).toEqual({start: '2026-12-15', next: '2027-01-15'});
    expect(periodFor('2026-01', 28)).toEqual({start: '2026-01-28', next: '2026-02-28'});
    // 28 Jan to 27 Feb, then 28 Feb to 27 Mar: February's own length shows in the period after it.
    expect(daysIn(periodFor('2026-01', 28))).toBe(31);
    expect(daysIn(periodFor('2026-02', 28))).toBe(28);
    expect(daysIn(periodFor('2028-02', 28))).toBe(29);
  });

  it('reads a start day that is not 1 to 28 as 1', () => {
    for (const bad of [0, 29, 31, -3, 1.5, Number.NaN, '7', null, undefined]) {
      expect(toMonthStartDay(bad)).toBe(1);
    }
    expect(toMonthStartDay(28)).toBe(28);
    expect(periodFor('2026-11', 31)).toEqual(periodFor('2026-11', 1));
  });

  it('refuses a key that is not a month', () => {
    for (const bad of ['2026-13', '2026-00', '2026-1', '26-11', '2026-11-07', '']) {
      expect(() => periodFor(bad, 7)).toThrow('Invalid year-month');
    }
  });

  it('steps keys across years', () => {
    expect(shiftPeriodKey('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriodKey('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriodKey('2026-11', -23)).toBe('2024-12');
    expect(yearOfKey('2026-11')).toBe(2026);
    expect(monthIndexOfKey('2026-11')).toBe(10);
  });
});

describe('the period a date falls in', () => {
  it('is its calendar month from the start day on, and the month before until then', () => {
    expect(periodKeyOf('2026-11-07', 7)).toBe('2026-11');
    expect(periodKeyOf('2026-11-06', 7)).toBe('2026-10');
    expect(periodKeyOf('2026-12-06T23:59:59', 7)).toBe('2026-11');
    expect(periodKeyOf('2026-01-03', 7)).toBe('2025-12');
    expect(periodKeyOf('2026-01-03')).toBe('2026-01');
    expect(periodKeyOf('2026-03-27', 28)).toBe('2026-02');
    expect(periodKeyOf('2026-03-28', 28)).toBe('2026-03');
  });

  it('a date with a zone suffix counts on the local day it was seen (as toDayKey)', () => {
    // Whatever zone the suite runs in: the instant's local day decides, exactly as the lists show it.
    const instant = '2026-11-07T03:00:00Z';
    expect(periodKeyOf(instant, 7)).toBe(periodKeyOf(toDayKey(instant), 7));
    expect(periodKeyOf(new Date(2026, 10, 7, 0, 0, 1), 7)).toBe('2026-11');
    expect(periodKeyOf(new Date(2026, 10, 6, 23, 59, 59), 7)).toBe('2026-10');
  });

  it('every day is in exactly the period its key names, for every start day', () => {
    fc.assert(
      fc.property(
        fc.integer({min: 0, max: 4000}),
        fc.integer({min: 1, max: MAX_MONTH_START_DAY}),
        (offset, startDay) => {
          const date = shiftIsoDay('2019-12-25', offset);
          const key = periodKeyOf(date, startDay);
          const period = periodFor(key, startDay);
          expect(periodHas(period, date)).toBe(true);
          // And in neither neighbour: periods tile the calendar with no gap and no overlap.
          expect(periodHas(periodFor(shiftPeriodKey(key, -1), startDay), date)).toBe(false);
          expect(periodHas(periodFor(shiftPeriodKey(key, 1), startDay), date)).toBe(false);
          expect(periodFor(shiftPeriodKey(key, 1), startDay).start).toBe(period.next);
        },
      ),
    );
  });
});

describe('days of a period', () => {
  it('counts and lists them, across a DST change and a year end', () => {
    const march = periodFor('2026-03', 7); // 7 Mar to 6 Apr; clocks change on 8 Mar in the US
    expect(daysIn(march)).toBe(31);
    expect(daysOf(march)).toHaveLength(31);
    expect(daysOf(march)[0]).toBe('2026-03-07');
    expect(daysOf(march).at(-1)).toBe('2026-04-06');
    expect(daysOf(periodFor('2026-12', 15)).at(-1)).toBe('2027-01-14');
  });

  it('numbers a day from 1, and says what is outside', () => {
    const period = periodFor('2026-11', 7);
    expect(dayNumberIn(period, '2026-11-07')).toBe(1);
    expect(dayNumberIn(period, '2026-12-06')).toBe(daysIn(period));
    expect(dayNumberIn(period, '2026-11-06')).toBe(0);
    expect(periodHas(period, '2026-12-07')).toBe(false);
  });
});

describe('a range the user picked', () => {
  it('includes both of its days', () => {
    const range = rangePeriod(day('2026-10-15'), day('2026-11-10'));
    expect(range).toEqual({start: '2026-10-15', next: '2026-11-11'});
    expect(daysIn(range)).toBe(27);
    expect(daysIn(rangePeriod(day('2026-11-10'), day('2026-11-10')))).toBe(1);
  });

  it('cannot end before it starts', () => {
    expect(() => rangePeriod(day('2026-11-10'), day('2026-11-09'))).toThrow('cannot end');
  });
});
