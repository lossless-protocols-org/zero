/**
 * The one read point for a month's days (plan P11; entitlement spec §4):
 * the user's day applies with Pro and reads as the 1st without it, the
 * stored day is never changed by the tier, and listeners hear only when the
 * day that applies moves.
 */
import {capsOf} from '../../../src/pro/features';
import {
  currentPeriodFor,
  effectiveMonthStartDay,
  effectivePeriod,
  getMonthStartDay,
  getStoredMonthStartDay,
  monthKeyNow,
  monthKeyOf,
  setStoredMonthStartDay,
  subscribeMonthStartDay,
} from '../../../src/pro/monthStart';
import {setEntitlement} from '../../harness/mocks/entitlement';

jest.mock('../../../src/pro/entitlementStore', () => require('../../harness/mocks/entitlement').entitlementStoreMock());

const pro = () => setEntitlement({state: 'lifetime'});
const free = () => setEntitlement({state: 'expired'});

describe('pure', () => {
  it('the stored day applies with the feature, and reads as the 1st without it', () => {
    expect(effectiveMonthStartDay(7, capsOf(true))).toBe(7);
    expect(effectiveMonthStartDay(7, capsOf(false))).toBe(1);
    expect(effectiveMonthStartDay(null, capsOf(true))).toBe(1);
    expect(effectiveMonthStartDay(31, capsOf(true))).toBe(1);
  });

  it('effectivePeriod is the calendar month without Pro, whatever is stored', () => {
    expect(effectivePeriod('2026-11', 7, capsOf(true))).toEqual({start: '2026-11-07', next: '2026-12-07'});
    expect(effectivePeriod('2026-11', 7, capsOf(false))).toEqual({start: '2026-11-01', next: '2026-12-01'});
  });
});

describe('as the app runs', () => {
  beforeEach(() => {
    pro();
    setStoredMonthStartDay(1);
  });

  it('follows the stored day with Pro', () => {
    setStoredMonthStartDay(7);
    expect(getMonthStartDay()).toBe(7);
    expect(currentPeriodFor('2026-11')).toEqual({start: '2026-11-07', next: '2026-12-07'});
    expect(monthKeyOf('2026-11-06')).toBe('2026-10');
    expect(monthKeyNow(new Date(2026, 10, 6, 12))).toBe('2026-10');
    expect(monthKeyNow(new Date(2026, 10, 7, 0))).toBe('2026-11');
    // With no moment given it is now.
    expect(monthKeyNow()).toBe(monthKeyOf(new Date()));
  });

  it('when Pro ends months are calendar months again, and the stored day is kept for its return', () => {
    setStoredMonthStartDay(15);
    free();
    expect(getMonthStartDay()).toBe(1);
    expect(getStoredMonthStartDay()).toBe(15);
    expect(monthKeyOf('2026-11-06')).toBe('2026-11');
    pro();
    expect(getMonthStartDay()).toBe(15);
  });

  it('tells listeners only when the day that applies moves', () => {
    const heard = jest.fn();
    const stop = subscribeMonthStartDay(heard);
    setStoredMonthStartDay(1); // unchanged
    expect(heard).not.toHaveBeenCalled();
    setStoredMonthStartDay(7);
    expect(heard).toHaveBeenCalledTimes(1);
    free(); // 7 → 1
    expect(heard).toHaveBeenCalledTimes(2);
    setStoredMonthStartDay(20); // stored changes, but without Pro the 1st still applies
    expect(heard).toHaveBeenCalledTimes(2);
    pro(); // 1 → 20
    expect(heard).toHaveBeenCalledTimes(3);
    stop();
    setStoredMonthStartDay(3);
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('a stored value that is not a day reads as the 1st', () => {
    setStoredMonthStartDay(40);
    expect(getMonthStartDay()).toBe(1);
    setStoredMonthStartDay(undefined);
    expect(getStoredMonthStartDay()).toBe(1);
  });
});
