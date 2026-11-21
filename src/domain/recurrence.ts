import type {IsoDay} from './types';

/**
 * When a recurring rule falls due (3.0, plan P9). Pure calendar arithmetic on
 * 'YYYY-MM-DD' days, done in UTC so no time zone, DST change or clock setting
 * can skip or repeat a day; the time a reminder fires is the platform's.
 *
 * Every occurrence is computed from the rule's FIRST day and its index, never
 * from the previous occurrence: a rule on the 31st falls on 30 April and 28
 * February, and is back on 31 May, instead of drifting to the 28th for good.
 */

export const CADENCES = ['monthly', 'weekly', 'yearly', 'everyNDays'] as const;
export type Cadence = (typeof CADENCES)[number];

/** A stored cadence as the app reads it: anything unknown is monthly, the commonest. */
export const toCadence = (value: string): Cadence =>
  (CADENCES as readonly string[]).includes(value) ? (value as Cadence) : 'monthly';

export interface Recurrence {
  cadence: Cadence;
  /** Every `interval` months, weeks, years or days; at least 1. */
  interval: number;
  /** The first occurrence. */
  startDate: string;
  /** The last day an occurrence may fall on; null: no end. */
  endDate: string | null;
}

/** The longest interval a rule may have: past it, a typo (every 3,000 months), not a schedule. */
export const MAX_INTERVAL = 366;

const parts = (day: string): [number, number, number] => {
  const [y, m, d] = day.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
};

const pad = (n: number): string => String(n).padStart(2, '0');

const fromUtc = (date: Date): IsoDay =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` as IsoDay; // three numbers in YYYY-MM-DD form

const daysIn = (year: number, monthIndex: number): number => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/** The `index`-th occurrence (0 is the first day itself). */
export const occurrence = (rule: Recurrence, index: number): IsoDay => {
  const [y, m, d] = parts(rule.startDate);
  const step = index * Math.max(1, Math.floor(rule.interval));
  switch (rule.cadence) {
    case 'weekly':
      return fromUtc(new Date(Date.UTC(y, m - 1, d + step * 7)));
    case 'everyNDays':
      return fromUtc(new Date(Date.UTC(y, m - 1, d + step)));
    case 'yearly': {
      const year = y + step;
      return fromUtc(new Date(Date.UTC(year, m - 1, Math.min(d, daysIn(year, m - 1)))));
    }
    case 'monthly': {
      const months = m - 1 + step;
      const year = y + Math.floor(months / 12);
      const month = ((months % 12) + 12) % 12;
      return fromUtc(new Date(Date.UTC(year, month, Math.min(d, daysIn(year, month)))));
    }
  }
};

/** Whether the `index`-th occurrence is before the rule's end (or the rule has none). */
const withinEnd = (rule: Recurrence, index: number): boolean =>
  rule.endDate === null || occurrence(rule, index) <= rule.endDate;

/**
 * The occurrences due by the end of `today`, from `fromIndex` on: at most
 * `limit` of them, oldest first. An occurrence after the rule's end never is.
 */
export const dueIndexes = (rule: Recurrence, fromIndex: number, today: string, limit: number): number[] => {
  const due: number[] = [];
  for (let index = fromIndex; due.length < limit; index++) {
    if (!withinEnd(rule, index) || occurrence(rule, index) > today) {
      break;
    }
    due.push(index);
  }
  return due;
};

/**
 * The first index whose occurrence is on or after `day`, from `fromIndex` on
 * ("start from today": the occurrences before it are skipped, today's is not).
 */
export const firstIndexOnOrAfter = (rule: Recurrence, fromIndex: number, day: string): number => {
  let index = fromIndex;
  // Occurrences only move forward, so a walk ends; a skip in large steps first keeps it short
  // for a daily rule years behind.
  for (let jump = 1024; jump >= 1; jump = Math.floor(jump / 2)) {
    while (occurrence(rule, index + jump) < day) {
      index += jump;
    }
  }
  return occurrence(rule, index) < day ? index + 1 : index;
};

/** The rule's next occurrence from `index`, or null when it has ended. */
export const nextRunOf = (rule: Recurrence, index: number): IsoDay | null =>
  withinEnd(rule, index) ? occurrence(rule, index) : null;

/** What a rule makes on the days it falls due. */
export const RULE_TARGETS = ['expense', 'income', 'transfer'] as const;
export type RuleTarget = (typeof RULE_TARGETS)[number];

/** A stored target as the app reads it: anything unknown is an expense. */
export const toRuleTarget = (value: string): RuleTarget =>
  (RULE_TARGETS as readonly string[]).includes(value) ? (value as RuleTarget) : 'expense';

/**
 * Where a rule stands, as the list shows it. `needsCategory` and
 * `needsAccount`: what it makes rows in was archived or removed (a restore,
 * or while Pro was off); the rule waits, paused, until the user picks again,
 * and is never repaired silently (ZERO_3.0_ENTITLEMENT.md §4).
 */
export type RuleStatus = 'active' | 'paused' | 'ended' | 'needsCategory' | 'needsAccount';

/** The most occurrences one automatic run writes for a rule (plan P9: bounded catch-up). */
export const MAX_DUE_PER_RUN = 12;
