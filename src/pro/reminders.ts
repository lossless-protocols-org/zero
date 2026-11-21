import {PermissionsAndroid, Platform} from 'react-native';
import NativeReminders from '../native/specs/NativeReminders';
import type {Upcoming} from '../data/services/recurringService';

/**
 * Reminders for recurring rules (3.0, plan P9): which to schedule, worked out
 * here, and the one call into the native modules (NativeReminders).
 */

/**
 * iOS keeps at most 64 pending local notifications per app; zero stays under it.
 * @internal Used by planReminders; tests check the cap.
 */
export const MAX_PENDING_REMINDERS = 60;
/** The hour of the day a reminder comes, local time. */
const REMINDER_HOUR = 9;

/** One reminder as the native side schedules it. */
export interface Reminder {
  id: string;
  title: string;
  body: string;
  fireAtMs: number;
}

/** What a reminder says. Built by the app (it has the language); never an amount, which a lock screen would show. */
export type ReminderText = (item: {title: string; daysBefore: number; day: string}) => {title: string; body: string};

/**
 * The local time a reminder `daysBefore` days ahead of `day` fires: 09:00 on that day, in the phone's zone.
 * @internal Used by planReminders; tests check it alone.
 */
export const fireAtOf = (day: string, daysBefore: number): number => {
  // 'YYYY-MM-DD' (a rule's occurrence): fixed positions.
  const [y, m, d] = [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))];
  return new Date(y, m - 1, d - daysBefore, REMINDER_HOUR, 0, 0, 0).getTime();
};

/**
 * The reminders to have pending now: each upcoming occurrence of a rule with
 * a reminder, at its time, if that is still ahead; soonest first, at most
 * MAX_PENDING_REMINDERS. The rest are scheduled on a later open as these fire.
 */
export const planReminders = (upcoming: readonly Upcoming[], nowMs: number, text: ReminderText): Reminder[] =>
  upcoming
    .flatMap(item => {
      if (item.remindDaysBefore === null) {
        return [];
      }
      const fireAtMs = fireAtOf(item.day, item.remindDaysBefore);
      if (fireAtMs <= nowMs) {
        return [];
      }
      const words = text({title: item.title, daysBefore: item.remindDaysBefore, day: item.day});
      return [{id: `${item.ruleId}:${item.index}`, title: words.title, body: words.body, fireAtMs}];
    })
    .sort((a, b) => a.fireAtMs - b.fireAtMs || a.id.localeCompare(b.id))
    .slice(0, MAX_PENDING_REMINDERS);

/** Replaces every pending reminder with `reminders` ([] cancels them all). Nothing without the native module (jest, a build without it). */
export const scheduleReminders = async (reminders: readonly Reminder[]): Promise<void> => {
  await NativeReminders?.replaceAll(JSON.stringify(reminders));
};

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

const toPermission = (value: string | undefined): ReminderPermission =>
  value === 'granted' || value === 'denied' ? value : 'undetermined';

/** Whether reminders can be shown. */
export const reminderPermission = async (): Promise<ReminderPermission> =>
  toPermission(await NativeReminders?.permission());

/**
 * Asks to show reminders: only when the user first saves a rule with one
 * (plan P9), never on launch. Android 13 and later ask through the system
 * dialog; earlier Android versions need no asking.
 */
export const requestReminderPermission = async (): Promise<ReminderPermission> => {
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) {
      return 'granted';
    }
    const answer = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return answer === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  }
  return toPermission(await NativeReminders?.requestPermission());
};
