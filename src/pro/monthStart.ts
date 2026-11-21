import {DEFAULT_MONTH_START_DAY, periodFor, periodKeyOf, toMonthStartDay, type Period} from '../domain/period';
import {capsOf, type ProFeature} from './features';
import {getAppliedPro, subscribeAppliedPro} from './proGate';

/**
 * The one read point for "which days is this month?" (3.0, plan P11;
 * ZERO_3.0_ENTITLEMENT.md §4: `effectivePeriod(ym, user, caps)`).
 *
 * The user's month start day is a stored fact (`users.month_start_day`); it
 * applies only while the `monthStart` feature is on. Without Pro every month
 * is the calendar month, whatever is stored, and the stored day is left
 * alone: it applies again the moment Pro returns. Home, Reports, budgets,
 * the heatmap, the daily allowance, the Money tab and the widget all ask
 * here, so they cannot disagree about where a month ends.
 *
 * The stored day is held here, apart from React and the store, so the widget
 * publisher and the thunks read it without a screen. The session sets it
 * when it loads the user (store/bootstrapSession) and the Settings row when
 * it saves a new one.
 */

/** The day that applies, given the stored day and what the tier includes. Pure. */
export const effectiveMonthStartDay = (storedDay: unknown, caps: ReadonlySet<ProFeature>): number =>
  caps.has('monthStart') ? toMonthStartDay(storedDay) : DEFAULT_MONTH_START_DAY;

/**
 * The period `yearMonth` names for a user's stored day and a tier's capabilities. Pure.
 * @internal The entitlement spec's read point in its pure form; `currentPeriodFor` is what the app calls. Tests check it.
 */
export const effectivePeriod = (yearMonth: string, storedDay: unknown, caps: ReadonlySet<ProFeature>): Period =>
  periodFor(yearMonth, effectiveMonthStartDay(storedDay, caps));

let stored = DEFAULT_MONTH_START_DAY;
let applied = DEFAULT_MONTH_START_DAY;
let following = false;
const listeners = new Set<() => void>();

const settle = (): void => {
  const next = effectiveMonthStartDay(stored, capsOf(getAppliedPro()));
  if (next !== applied) {
    applied = next;
    listeners.forEach(listener => listener());
  }
};

const follow = (): void => {
  if (!following) {
    following = true;
    applied = effectiveMonthStartDay(stored, capsOf(getAppliedPro()));
    // Pro turning on or off changes which day applies without the stored day changing.
    subscribeAppliedPro(settle);
  }
};

/** The stored day as the session or Settings read or wrote it. Tells listeners when the day that applies moved. */
export const setStoredMonthStartDay = (day: unknown): void => {
  follow();
  stored = toMonthStartDay(day);
  settle();
};

/** The day the user chose (1 when none), whether or not it applies now: Settings shows it, the Pro-ended notice asks. */
export const getStoredMonthStartDay = (): number => stored;

/** The day months start on now: the user's with Pro, the 1st without. */
export const getMonthStartDay = (): number => {
  follow();
  return applied;
};

/** Called when the day that applies changes: every month's rows are then another month's. */
export const subscribeMonthStartDay = (listener: () => void): (() => void) => {
  follow();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The days the month named `yearMonth` covers now. */
export const currentPeriodFor = (yearMonth: string): Period => periodFor(yearMonth, getMonthStartDay());

/** The key of the month a stored date (or a moment) falls in now. */
export const monthKeyOf = (date: string | Date): string => periodKeyOf(date, getMonthStartDay());

/** The key of the month it is now. */
export const monthKeyNow = (now: Date = new Date()): string => periodKeyOf(now, getMonthStartDay());
