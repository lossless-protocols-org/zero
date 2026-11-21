import {createMmkvPreference, oneOf} from './mmkvPreference';

export type WeekStartDay = 'saturday' | 'sunday' | 'monday';

/**
 * User preference for which day the Reports calendar week begins on.
 * Sunday is the default because it is the app's historical behaviour —
 * existing users see no change until they opt in to Monday. Saturday is the
 * week's first day in much of the Middle East and North Africa (world review W6).
 */
export const weekStartPreference = createMmkvPreference<WeekStartDay>(
  'weekStartDay',
  oneOf(['saturday', 'sunday', 'monday']),
  'sunday',
);

/** Where each choice sits in a Sunday-first array of weekday names. */
export const WEEK_START_NAME_INDEX: Record<WeekStartDay, number> = {sunday: 0, monday: 1, saturday: 6};

/** How many positions the Sunday-first weekday arrays shift left. @internal test */
export const weekStartOffset = (start: WeekStartDay): 0 | 1 | 6 =>
  start === 'monday' ? 1 : start === 'saturday' ? 6 : 0;

/** Rotates a Sunday-first weekday-name array to begin on the chosen day. */
export const rotateWeekdays = (names: string[], start: WeekStartDay): string[] => {
  const offset = weekStartOffset(start);
  if (offset === 0 || names.length === 0) {
    return names;
  }
  return [...names.slice(offset), ...names.slice(0, offset)];
};

/**
 * Leading blank cells for a month grid. `firstDayOfMonth` is dayjs's `.day()`
 * (0 = Sunday, always); the preference shifts which column that lands in.
 */
export const leadingBlanks = (firstDayOfMonth: number, start: WeekStartDay): number =>
  (firstDayOfMonth - weekStartOffset(start) + 7) % 7;
