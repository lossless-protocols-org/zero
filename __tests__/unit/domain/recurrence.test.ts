/**
 * The rule engine's calendar (plan P9 exit tests): every cadence, month-end
 * clamping (the 31st falls on the 30th and the 28th and comes back),
 * 29 February, the year roll, an end date, catch-up bounds and "start from
 * today". Run in a zone with a DST change: days are UTC calendar arithmetic,
 * so no change of clocks can skip or repeat one.
 */
process.env['TZ'] = 'America/New_York';

import fc from 'fast-check';
import {
  dueIndexes,
  firstIndexOnOrAfter,
  nextRunOf,
  occurrence,
  toCadence,
  type Recurrence,
} from '../../../src/domain/recurrence';

const rule = (more: Partial<Recurrence>): Recurrence => ({
  cadence: 'monthly',
  interval: 1,
  startDate: '2026-01-31',
  endDate: null,
  ...more,
});
const first = (r: Recurrence, n: number) => Array.from({length: n}, (_, i) => occurrence(r, i));

describe('monthly', () => {
  it('the 31st falls on each month’s last day when it is shorter, and returns to the 31st', () => {
    expect(first(rule({}), 6)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ]);
  });
  it('a leap February takes the 29th', () => {
    expect(occurrence(rule({startDate: '2028-01-30'}), 1)).toBe('2028-02-29');
  });
  it('rolls over the year, every n months', () => {
    expect(first(rule({startDate: '2026-11-15', interval: 2}), 3)).toEqual(['2026-11-15', '2027-01-15', '2027-03-15']);
  });
});

describe('weekly, yearly, every n days', () => {
  it('weekly steps seven days, across a DST change and a year end', () => {
    expect(first(rule({cadence: 'weekly', startDate: '2026-03-01'}), 3)).toEqual([
      '2026-03-01',
      '2026-03-08',
      '2026-03-15',
    ]);
    expect(occurrence(rule({cadence: 'weekly', startDate: '2026-12-28'}), 1)).toBe('2027-01-04');
    expect(occurrence(rule({cadence: 'weekly', startDate: '2026-10-26', interval: 2}), 1)).toBe('2026-11-09');
  });
  it('yearly keeps the date, and 29 February falls on the 28th in other years', () => {
    expect(first(rule({cadence: 'yearly', startDate: '2028-02-29'}), 5)).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
      '2031-02-28',
      '2032-02-29',
    ]);
  });
  it('every n days', () => {
    expect(first(rule({cadence: 'everyNDays', startDate: '2026-11-25', interval: 10}), 3)).toEqual([
      '2026-11-25',
      '2026-12-05',
      '2026-12-15',
    ]);
  });
  it('an unknown stored cadence reads as monthly; a broken interval as 1', () => {
    expect(toCadence('fortnightly')).toBe('monthly');
    expect(occurrence(rule({interval: 0, startDate: '2026-01-10'}), 1)).toBe('2026-02-10');
  });
});

describe('what is due', () => {
  const rent = rule({startDate: '2026-08-01'});

  it('everything on or before today, oldest first, never past the limit', () => {
    expect(dueIndexes(rent, 0, '2026-11-01', 12)).toEqual([0, 1, 2, 3]);
    expect(dueIndexes(rent, 2, '2026-10-31', 12)).toEqual([2]);
    expect(dueIndexes(rent, 0, '2026-11-01', 2)).toEqual([0, 1]);
    expect(dueIndexes(rent, 4, '2026-11-01', 12)).toEqual([]);
  });

  it('nothing after the end date, and no next run once it has passed', () => {
    const ending = {...rent, endDate: '2026-09-15'};
    expect(dueIndexes(ending, 0, '2026-12-31', 12)).toEqual([0, 1]);
    expect(nextRunOf(ending, 1)).toBe('2026-09-01');
    expect(nextRunOf(ending, 2)).toBeNull();
  });

  it('"start from today" skips what is before today and keeps today', () => {
    expect(firstIndexOnOrAfter(rent, 0, '2026-11-01')).toBe(3);
    expect(firstIndexOnOrAfter(rent, 0, '2026-11-02')).toBe(4);
    expect(firstIndexOnOrAfter(rent, 5, '2026-11-01')).toBe(5);
    const daily = rule({cadence: 'everyNDays', startDate: '2020-01-01'});
    expect(occurrence(daily, firstIndexOnOrAfter(daily, 0, '2026-11-11'))).toBe('2026-11-11');
  });

  it('occurrences only move forward, whatever the rule', () => {
    const day = fc
      .integer({min: 0, max: 3000})
      .map(n => occurrence(rule({cadence: 'everyNDays', startDate: '2024-01-01'}), n));
    fc.assert(
      fc.property(
        fc.constantFrom('monthly' as const, 'weekly' as const, 'yearly' as const, 'everyNDays' as const),
        fc.integer({min: 1, max: 12}),
        day,
        fc.integer({min: 0, max: 200}),
        (cadence, interval, startDate, index) => {
          const r = rule({cadence, interval, startDate});
          expect(occurrence(r, index + 1) > occurrence(r, index)).toBe(true);
        },
      ),
    );
  });
});
