/**
 * Which reminders to have pending (plan P9): each upcoming occurrence of a
 * rule with a reminder, at 09:00 local on its day (or that many days before),
 * only if still ahead, soonest first, never more than iOS holds. The words
 * are the app's; never an amount, which a lock screen would show.
 */
import {PermissionsAndroid, Platform} from 'react-native';
import {
  MAX_PENDING_REMINDERS,
  fireAtOf,
  planReminders,
  reminderPermission,
  requestReminderPermission,
  scheduleReminders,
} from '../../../src/pro/reminders';

/** The native module as this suite sets it: null (none) unless a test gives one. */
const mockNative: {current: Record<string, jest.Mock> | null} = {current: null};
jest.mock('../../../src/native/specs/NativeReminders', () => ({
  __esModule: true,
  get default() {
    return mockNative.current;
  },
}));
import type {Upcoming} from '../../../src/data/services/recurringService';

const item = (day: string, remindDaysBefore: number | null, index = 0): Upcoming => ({
  ruleId: 'rent',
  index,
  day: day as Upcoming['day'], // the tests' days are YYYY-MM-DD
  target: 'expense',
  title: 'Rent',
  amount: 18000,
  remindDaysBefore,
  leaves: true,
  paysDebt: false,
});
const text = ({title, daysBefore}: {title: string; daysBefore: number}) => ({title, body: `in ${daysBefore}`});

it('fires at 09:00 local on the day, or that many days before', () => {
  expect(new Date(fireAtOf('2026-12-01', 0))).toEqual(new Date(2026, 11, 1, 9, 0, 0));
  expect(new Date(fireAtOf('2026-12-01', 1))).toEqual(new Date(2026, 10, 30, 9, 0, 0));
});

it('plans only reminders still ahead, for rules that have one, soonest first, words from the app', () => {
  const now = new Date(2026, 10, 15, 12, 0, 0).getTime();
  const plan = planReminders(
    [item('2026-12-01', 2, 1), item('2026-11-15', 0), item('2026-11-20', null), item('2026-11-16', 0, 2)],
    now,
    text,
  );
  expect(plan).toEqual([
    {id: 'rent:2', title: 'Rent', body: 'in 0', fireAtMs: fireAtOf('2026-11-16', 0)},
    {id: 'rent:1', title: 'Rent', body: 'in 2', fireAtMs: fireAtOf('2026-12-01', 2)},
  ]);
  expect(JSON.stringify(plan)).not.toContain('18000');
});

it('never more than iOS keeps', () => {
  const many = Array.from({length: 100}, (_, i) => item(`2027-01-${String((i % 28) + 1).padStart(2, '0')}`, 0, i));
  expect(planReminders(many, 0, text)).toHaveLength(MAX_PENDING_REMINDERS);
});

it('without the native module (jest, a build without it) scheduling does nothing and does not throw', async () => {
  await expect(scheduleReminders([])).resolves.toBeUndefined();
});

describe('permission', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockNative.current = null;
  });

  it('iOS asks the native side and reads its answer; anything unknown is undetermined', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockNative.current = {
      permission: jest.fn(async () => 'granted'),
      requestPermission: jest.fn(async () => 'odd'),
      replaceAll: jest.fn(async () => undefined),
    };
    expect(await reminderPermission()).toBe('granted');
    expect(await requestReminderPermission()).toBe('undetermined');
    mockNative.current = null;
    expect(await reminderPermission()).toBe('undetermined');
  });

  it('Android 13 and later ask through the system; earlier versions need no asking', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    const version = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    expect(await requestReminderPermission()).toBe('denied');
    request.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    expect(await requestReminderPermission()).toBe('granted');
    version.mockReturnValue(30);
    request.mockClear();
    expect(await requestReminderPermission()).toBe('granted');
    expect(request).not.toHaveBeenCalled();
  });

  it('a native module replaces the pending list with exactly what was planned', async () => {
    const replaceAll = jest.fn(async () => undefined);
    mockNative.current = {permission: jest.fn(), requestPermission: jest.fn(), replaceAll};
    await scheduleReminders([{id: 'a', title: 'Rent', body: 'Due', fireAtMs: 5}]);
    expect(replaceAll).toHaveBeenCalledWith('[{"id":"a","title":"Rent","body":"Due","fireAtMs":5}]');
  });
});
