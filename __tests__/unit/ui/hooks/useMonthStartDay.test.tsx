/** The month start day for screens (P11): the day that applies, a month's days, and the month it is now, each redrawn when the day moves. */
import {act} from '@testing-library/react-native';
import {useCurrentPeriod, useMonthPeriod, useMonthStartDay} from '../../../../src/ui/hooks/useMonthStartDay';
import {setStoredMonthStartDay} from '../../../../src/pro/monthStart';
import {periodFor, periodKeyOf} from '../../../../src/domain/period';
import {setEntitlement} from '../../../harness/mocks/entitlement';
import {renderHookInApp} from '../../../harness/render';

jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);

afterAll(() => {
  setStoredMonthStartDay(1);
  setEntitlement();
});

it('follows the day that applies: the user’s with Pro, the 1st without', async () => {
  setEntitlement({state: 'lifetime'});
  setStoredMonthStartDay(1);
  const {result} = await renderHookInApp(() => ({
    day: useMonthStartDay(),
    november: useMonthPeriod('2026-11'),
    now: useCurrentPeriod(),
  }));
  expect(result.current.day).toBe(1);
  expect(result.current.november).toEqual({start: '2026-11-01', next: '2026-12-01'});

  await act(async () => setStoredMonthStartDay(7));
  expect(result.current.day).toBe(7);
  expect(result.current.november).toEqual({start: '2026-11-07', next: '2026-12-07'});
  expect(result.current.now).toEqual(periodFor(periodKeyOf(new Date(), 7), 7));

  await act(async () => setEntitlement({state: 'expired'}));
  expect(result.current.day).toBe(1);
  expect(result.current.november).toEqual({start: '2026-11-01', next: '2026-12-01'});
});

it('gives the same object until the key or the day changes, so a screen can depend on it', async () => {
  setEntitlement({state: 'lifetime'});
  setStoredMonthStartDay(7);
  const {result, rerender} = await renderHookInApp(() => useMonthPeriod('2026-11'));
  const first = result.current;
  await rerender({});
  expect(result.current).toBe(first);
});
