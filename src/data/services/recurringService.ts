import {Q, type Model} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {RecurringRule} from '../database/models/RecurringRule';
import {Expense} from '../database/models/Expense';
import {Income} from '../database/models/Income';
import {Transfer} from '../database/models/Transfer';
import {Account} from '../database/models/Account';
import {Category} from '../database/models/Category';
import {assertUserId} from './assertUserId';
import {dayDateClauses} from './expenseDateRange';
import {toCategoryKind} from './categoryKind';
import {isOwedType, toAccountType} from '../../domain/accounts';
import {isSpendable} from '../../domain/commitments';
import {isCalendarDay, shiftIsoDay} from '../../domain/dates';
import {MAX_AMOUNT, MAX_TEXT} from '../../domain/limits';
import {toMoneyUnits} from '../../domain/money';
import {
  CADENCES,
  MAX_DUE_PER_RUN,
  MAX_INTERVAL,
  RULE_TARGETS,
  dueIndexes,
  firstIndexOnOrAfter,
  nextRunOf,
  occurrence,
  toCadence,
  toRuleTarget,
  type Cadence,
  type Recurrence,
  type RuleStatus,
  type RuleTarget,
} from '../../domain/recurrence';
import type {IsoDay} from '../../domain/types';

/**
 * Recurring rules (3.0, plan P9): rent, a salary, an SIP. A rule makes
 * ordinary rows (expenses, money in, transfers) on the days it falls due;
 * each row carries the rule's id (`recurring_id`) and its own day, which is
 * how a run knows an occurrence was already made. Tier-blind like every
 * service: whether rules run is the entitlement's (the materialiser producer,
 * src/pro/producers.ts), never asked here.
 *
 * Rules of the engine (ZERO_3.0_PRO.md §6, ZERO_3.0_ENTITLEMENT.md §5):
 * - A run writes at most one occurrence per rule. A rule more than one
 *   behind (the app was not opened, or Pro was off) is not filled on its
 *   own: the user is asked once, "add the missed entries, or start from today?".
 * - A rule with no amount ("varies") never writes by itself, behind or not:
 *   its oldest due occurrence is offered to confirm (or skip), then the next.
 * - A rule whose category or account was archived or removed waits, paused,
 *   until the user picks again: never repaired silently.
 * - Making a row and moving the rule on are one batch; a row already there
 *   for that rule and day is not made twice.
 */

/** The rule a write broke. The UI maps it to copy; the forms check first. */
type RuleRule =
  | 'notATarget'
  | 'titleNotValid'
  | 'amountNotValid'
  | 'notACadence'
  | 'notAnInterval'
  | 'notADay'
  | 'endBeforeStart'
  | 'notAReminder'
  | 'notACategory'
  | 'notAnAccount'
  | 'sameAccount'
  | 'notWaiting';

export class RecurringRuleError extends Error {
  readonly rule: RuleRule;
  constructor(rule: RuleRule) {
    super(`Recurring rule broken: ${rule}`);
    this.name = 'RecurringRuleError';
    this.rule = rule;
  }
}

/** What the user sets on a rule. */
export interface RuleFields {
  target: RuleTarget;
  /** An expense's title; money in's or a transfer's note. */
  title: string;
  /** The expense or income category; '' for a transfer. */
  categoryId: string;
  /** Paid from, comes into, or a transfer's from. */
  accountId: string;
  /** A transfer's to; null otherwise. */
  toAccountId: string | null;
  /** Null: it varies, and each occurrence asks. */
  amount: number | null;
  cadence: Cadence;
  interval: number;
  startDate: string;
  endDate: string | null;
  /** Days before each occurrence a reminder comes, at 09:00; null: none. */
  remindDaysBefore: number | null;
}

export interface RuleData extends RuleFields {
  id: string;
  /** The next occurrence to make; null once the rule has ended. */
  nextRun: string | null;
  nextIndex: number;
  status: RuleStatus;
}

/** The longest a reminder may come before its day. */
const MAX_REMIND_DAYS = 30;

const recurrenceOf = (rule: Pick<RuleFields, 'cadence' | 'interval' | 'startDate' | 'endDate'>): Recurrence => ({
  cadence: rule.cadence,
  interval: rule.interval,
  startDate: rule.startDate,
  endDate: rule.endDate,
});

const fieldsOf = (rule: RecurringRule): RuleFields => ({
  target: toRuleTarget(rule.target),
  title: rule.title,
  categoryId: rule.categoryId,
  accountId: rule.accountId,
  toAccountId: rule.toAccountId,
  amount: rule.amount,
  cadence: toCadence(rule.cadence),
  interval: rule.interval,
  startDate: rule.startDate,
  endDate: rule.endDate,
  remindDaysBefore: rule.remindDaysBefore,
});

/** The user's categories and accounts, read once for many rules. */
interface Refs {
  categories: Map<string, Category>;
  accounts: Map<string, Account>;
}

const refsOf = async (userId: string): Promise<Refs> => {
  const [categories, accounts] = await Promise.all([
    database.get<Category>('categories').query(Q.where('user_id', userId)).fetch(),
    database.get<Account>('accounts').query(Q.where('user_id', userId)).fetch(),
  ]);
  return {
    categories: new Map(categories.map(category => [category.id, category])),
    accounts: new Map(accounts.map(account => [account.id, account])),
  };
};

const categoryUsable = (refs: Refs, categoryId: string, kind: 'expense' | 'income'): boolean => {
  const category = refs.categories.get(categoryId);
  return !!category && category.categoryStatus && toCategoryKind(category.kind) === kind;
};

const accountUsable = (refs: Refs, accountId: string | null): boolean =>
  accountId !== null && refs.accounts.get(accountId)?.accountStatus === true;

/** Where a rule stands now. A rule whose references went away waits for the user (never repaired). */
const statusOf = (rule: RecurringRule, refs: Refs): RuleStatus => {
  if (rule.nextRun === null) {
    return 'ended';
  }
  const target = toRuleTarget(rule.target);
  if (target !== 'transfer' && !categoryUsable(refs, rule.categoryId, target)) {
    return 'needsCategory';
  }
  if (!accountUsable(refs, rule.accountId) || (target === 'transfer' && !accountUsable(refs, rule.toAccountId))) {
    return 'needsAccount';
  }
  return rule.ruleStatus ? 'active' : 'paused';
};

const toRuleData = (rule: RecurringRule, refs: Refs): RuleData => ({
  ...fieldsOf(rule),
  id: rule.id,
  nextRun: rule.nextRun,
  nextIndex: rule.nextIndex,
  status: statusOf(rule, refs),
});

/**
 * The fields a rule may hold. References are checked only when they change
 * (`current` is the rule as stored): an old rule whose category was archived
 * stays editable, and saving it unchanged leaves it waiting.
 */
const assertRuleFields = async (userId: string, fields: RuleFields, current?: RuleFields): Promise<void> => {
  if (!(RULE_TARGETS as readonly string[]).includes(fields.target)) {
    throw new RecurringRuleError('notATarget');
  }
  const title = fields.title.trim();
  if (title.length > MAX_TEXT || (fields.target === 'expense' && title.length === 0)) {
    throw new RecurringRuleError('titleNotValid');
  }
  if (
    fields.amount !== null &&
    (!Number.isFinite(fields.amount) || toMoneyUnits(fields.amount) <= 0 || fields.amount > MAX_AMOUNT)
  ) {
    throw new RecurringRuleError('amountNotValid');
  }
  if (!(CADENCES as readonly string[]).includes(fields.cadence)) {
    throw new RecurringRuleError('notACadence');
  }
  if (!Number.isInteger(fields.interval) || fields.interval < 1 || fields.interval > MAX_INTERVAL) {
    throw new RecurringRuleError('notAnInterval');
  }
  if (!isCalendarDay(fields.startDate) || (fields.endDate !== null && !isCalendarDay(fields.endDate))) {
    throw new RecurringRuleError('notADay');
  }
  if (fields.endDate !== null && fields.endDate < fields.startDate) {
    throw new RecurringRuleError('endBeforeStart');
  }
  if (
    fields.remindDaysBefore !== null &&
    (!Number.isInteger(fields.remindDaysBefore) ||
      fields.remindDaysBefore < 0 ||
      fields.remindDaysBefore > MAX_REMIND_DAYS)
  ) {
    throw new RecurringRuleError('notAReminder');
  }
  const refs = await refsOf(userId);
  const changed = <K extends keyof RuleFields>(key: K): boolean => !current || current[key] !== fields[key];
  if (fields.target === 'transfer') {
    if (fields.categoryId !== '') {
      throw new RecurringRuleError('notACategory');
    }
    if (fields.toAccountId === null || fields.toAccountId === fields.accountId) {
      throw new RecurringRuleError('sameAccount');
    }
    if (changed('toAccountId') && !accountUsable(refs, fields.toAccountId)) {
      throw new RecurringRuleError('notAnAccount');
    }
  } else {
    if (fields.toAccountId !== null) {
      throw new RecurringRuleError('notAnAccount');
    }
    if ((changed('categoryId') || changed('target')) && !categoryUsable(refs, fields.categoryId, fields.target)) {
      throw new RecurringRuleError('notACategory');
    }
  }
  if (changed('accountId') && !accountUsable(refs, fields.accountId)) {
    throw new RecurringRuleError('notAnAccount');
  }
};

/**
 * Adds a rule. It starts at its first occurrence on or after `today`: a rule
 * dated in the past never makes entries for days before it was set up.
 */
export const createRule = async (userId: string, fields: RuleFields, today: IsoDay): Promise<string> => {
  assertUserId(userId, 'recurring rule');
  let id = '';
  await database.write(async () => {
    await assertRuleFields(userId, fields);
    const recurrence = recurrenceOf(fields);
    const nextIndex = firstIndexOnOrAfter(recurrence, 0, today);
    const rule = await database.get<RecurringRule>('recurring_rules').create(r => {
      r.userId = userId;
      r.target = fields.target;
      r.title = fields.title.trim();
      r.categoryId = fields.categoryId;
      r.accountId = fields.accountId;
      r.toAccountId = fields.toAccountId;
      r.amount = fields.amount;
      r.cadence = fields.cadence;
      r.interval = fields.interval;
      r.startDate = fields.startDate;
      r.endDate = fields.endDate;
      r.nextIndex = nextIndex;
      r.nextRun = nextRunOf(recurrence, nextIndex);
      r.remindDaysBefore = fields.remindDaysBefore;
      r.ruleStatus = true;
    });
    id = rule.id;
  });
  return id;
};

const SCHEDULE_KEYS: ReadonlyArray<keyof RuleFields> = ['cadence', 'interval', 'startDate'];

/**
 * Changes the fields given and no other (law L6). A new schedule (cadence,
 * interval, first day) starts again from `today`; a new end date only moves
 * where the rule stops.
 */
export const updateRule = async (ruleId: string, patch: Partial<RuleFields>, today: IsoDay): Promise<void> => {
  await database.write(async () => {
    const rule = await database.get<RecurringRule>('recurring_rules').find(ruleId);
    const current = fieldsOf(rule);
    const next: RuleFields = {...current, ...patch};
    await assertRuleFields(rule.userId, next, current);
    const reschedule = SCHEDULE_KEYS.some(key => patch[key] !== undefined && patch[key] !== current[key]);
    const recurrence = recurrenceOf(next);
    const nextIndex = reschedule ? firstIndexOnOrAfter(recurrence, 0, today) : rule.nextIndex;
    const nextRun = nextRunOf(recurrence, nextIndex);
    await rule.update(r => {
      if (patch.target !== undefined) r.target = patch.target;
      if (patch.title !== undefined) r.title = patch.title.trim();
      if (patch.categoryId !== undefined) r.categoryId = patch.categoryId;
      if (patch.accountId !== undefined) r.accountId = patch.accountId;
      if (patch.toAccountId !== undefined) r.toAccountId = patch.toAccountId;
      if (patch.amount !== undefined) r.amount = patch.amount;
      if (patch.cadence !== undefined) r.cadence = patch.cadence;
      if (patch.interval !== undefined) r.interval = patch.interval;
      if (patch.startDate !== undefined) r.startDate = patch.startDate;
      if (patch.endDate !== undefined) r.endDate = patch.endDate;
      if (patch.remindDaysBefore !== undefined) r.remindDaysBefore = patch.remindDaysBefore;
      if (reschedule) r.nextIndex = nextIndex;
      if (reschedule || patch.endDate !== undefined) r.nextRun = nextRun;
    });
  });
};

/** Pauses a rule (nothing is made, nothing reminded) or resumes it. Missed occurrences are then asked about. */
export const setRulePaused = async (ruleId: string, paused: boolean): Promise<void> => {
  await database.write(async () => {
    const rule = await database.get<RecurringRule>('recurring_rules').find(ruleId);
    if (rule.ruleStatus !== paused) {
      return;
    }
    await rule.update(r => {
      r.ruleStatus = !paused;
    });
  });
};

const madeFrom = async (ruleId: string): Promise<Model[]> => {
  const [expenses, incomes, transfers] = await Promise.all([
    database.get<Expense>('expenses').query(Q.where('recurring_id', ruleId)).fetch(),
    database.get<Income>('incomes').query(Q.where('recurring_id', ruleId)).fetch(),
    database.get<Transfer>('transfers').query(Q.where('recurring_id', ruleId)).fetch(),
  ]);
  return [...expenses, ...incomes, ...transfers];
};

/**
 * Deletes a rule. The rows it made stay, as ordinary entries: they lose the
 * link to a rule that no longer exists, in the same batch.
 */
export const deleteRule = async (ruleId: string): Promise<void> => {
  await database.write(async () => {
    const rule = await database.get<RecurringRule>('recurring_rules').find(ruleId);
    const rows = (await madeFrom(ruleId)) as Array<Expense | Income | Transfer>;
    await database.batch([
      ...rows.map(row =>
        row.prepareUpdate(made => {
          made.recurringId = null;
        }),
      ),
      rule.prepareDestroyPermanently(),
    ]);
  });
};

/** Every rule of the user, with where it stands, soonest first (ended ones last). */
export const getRules = async (userId: string): Promise<RuleData[]> => {
  const [rules, refs] = await Promise.all([
    database.get<RecurringRule>('recurring_rules').query(Q.where('user_id', userId)).fetch(),
    refsOf(userId),
  ]);
  return rules
    .map(rule => toRuleData(rule, refs))
    .sort((a, b) => (a.nextRun ?? '9999').localeCompare(b.nextRun ?? '9999') || a.title.localeCompare(b.title));
};

/** One rule, or null when it no longer exists. */
export const getRuleById = async (ruleId: string): Promise<RuleData | null> => {
  const [rule] = await database.get<RecurringRule>('recurring_rules').query(Q.where('id', ruleId)).fetch();
  return rule ? toRuleData(rule, await refsOf(rule.userId)) : null;
};

/** Whether the rule already made a row for `day` (a re-run, or a crash before the rule moved on). */
const alreadyMade = async (rule: RecurringRule, day: string): Promise<boolean> => {
  switch (toRuleTarget(rule.target)) {
    case 'expense':
      return (
        (await database
          .get<Expense>('expenses')
          .query(Q.where('recurring_id', rule.id), ...dayDateClauses(day))
          .fetchCount()) > 0
      );
    case 'income':
      return (
        (await database
          .get<Income>('incomes')
          .query(Q.where('recurring_id', rule.id), Q.where('date', day))
          .fetchCount()) > 0
      );
    case 'transfer':
      return (
        (await database
          .get<Transfer>('transfers')
          .query(Q.where('recurring_id', rule.id), Q.where('date', day))
          .fetchCount()) > 0
      );
  }
};

/** The row an occurrence makes, prepared for the caller's batch; null when it is already there. */
const prepareOccurrence = async (rule: RecurringRule, day: IsoDay, amount: number): Promise<Model | null> => {
  if (await alreadyMade(rule, day)) {
    return null;
  }
  switch (toRuleTarget(rule.target)) {
    case 'expense':
      return database.get<Expense>('expenses').prepareCreate(e => {
        e.userId = rule.userId;
        e.title = rule.title;
        e.amount = amount;
        e.description = '';
        e.categoryId = rule.categoryId;
        // Expenses carry a time of day; a made one is placed in the morning of its day.
        e.date = `${day}T09:00:00`;
        e.accountId = rule.accountId;
        e.recurringId = rule.id;
      });
    case 'income':
      return database.get<Income>('incomes').prepareCreate(i => {
        i.userId = rule.userId;
        i.categoryId = rule.categoryId;
        i.accountId = rule.accountId;
        i.amount = amount;
        i.date = day;
        i.note = rule.title;
        i.recurringId = rule.id;
      });
    case 'transfer':
      return database.get<Transfer>('transfers').prepareCreate(t => {
        t.userId = rule.userId;
        t.fromAccountId = rule.accountId;
        // Never null here: only an 'active' rule makes rows, and statusOf requires a transfer's to.
        t.toAccountId = rule.toAccountId ?? '';
        t.amount = amount;
        t.date = day;
        t.note = rule.title;
        t.recurringId = rule.id;
      });
  }
};

/** Prepared: the rule moved on past `index`. */
const prepareAdvance = (rule: RecurringRule, index: number): Model => {
  const recurrence = recurrenceOf(fieldsOf(rule));
  return rule.prepareUpdate(r => {
    r.nextIndex = index + 1;
    r.nextRun = nextRunOf(recurrence, index + 1);
  });
};

/** An occurrence that waits for the user: its amount varies. */
export interface DueAsk {
  ruleId: string;
  index: number;
  day: IsoDay;
  target: RuleTarget;
  title: string;
}

/** A rule more than one occurrence behind: the user decides whether to fill the gap. */
export interface RuleBehind {
  ruleId: string;
  title: string;
  /** How many are due, counted no further than MAX_DUE_PER_RUN + 1. */
  missed: number;
}

export interface MaterialiseResult {
  /** Rows made this run. */
  written: number;
  behind: RuleBehind[];
  asks: DueAsk[];
}

const dueRulesOf = (userId: string, today: string): Promise<RecurringRule[]> =>
  database
    .get<RecurringRule>('recurring_rules')
    .query(Q.where('user_id', userId), Q.where('next_run', Q.lte(today)), Q.where('rule_status', true))
    .fetch();

/**
 * Makes what is due by the end of `today` (plan P9): for each active rule
 * whose next run has come, its one due occurrence, written with the rule's
 * move in one batch. Run on every open, return to the foreground and change
 * of the entitlement (L4), so it must be, and is, safe to run any number of
 * times: an occurrence already made is not made again.
 */
export const materialiseDue = async (userId: string, today: IsoDay): Promise<MaterialiseResult> => {
  const result: MaterialiseResult = {written: 0, behind: [], asks: []};
  await database.write(async () => {
    const [rules, refs] = await Promise.all([dueRulesOf(userId, today), refsOf(userId)]);
    const prepared: Model[] = [];
    for (const rule of rules) {
      if (statusOf(rule, refs) !== 'active') {
        continue;
      }
      const recurrence = recurrenceOf(fieldsOf(rule));
      const due = dueIndexes(recurrence, rule.nextIndex, today, MAX_DUE_PER_RUN + 1);
      const [index] = due;
      if (index === undefined) {
        continue;
      }
      // A rule whose amount varies is never filled, behind or not: its oldest due occurrence waits to
      // be confirmed (or skipped), then the next. "Add the missed entries" could not know the amounts.
      if (due.length > 1 && rule.amount !== null) {
        result.behind.push({ruleId: rule.id, title: rule.title, missed: due.length});
        continue;
      }
      if (rule.amount === null) {
        result.asks.push({
          ruleId: rule.id,
          index,
          day: occurrence(recurrence, index),
          target: toRuleTarget(rule.target),
          title: rule.title,
        });
        continue;
      }
      const row = await prepareOccurrence(rule, occurrence(recurrence, index), rule.amount);
      if (row) {
        prepared.push(row);
        result.written++;
      }
      prepared.push(prepareAdvance(rule, index));
    }
    if (prepared.length > 0) {
      await database.batch(prepared);
    }
  });
  return result;
};

/** The most a user's "add the missed entries" makes for one rule at once: years of a daily rule is a typo. */
const MAX_CATCH_UP = 400;

/**
 * "Add the missed entries": makes every due occurrence of a rule behind, in
 * one batch, oldest first. A rule whose amount varies cannot be filled; its
 * occurrences stay to confirm one by one. Returns how many were made.
 */
export const catchUp = async (ruleId: string, today: IsoDay): Promise<number> => {
  let written = 0;
  await database.write(async () => {
    const rule = await database.get<RecurringRule>('recurring_rules').find(ruleId);
    if (rule.amount === null || statusOf(rule, await refsOf(rule.userId)) !== 'active') {
      return;
    }
    const recurrence = recurrenceOf(fieldsOf(rule));
    const due = dueIndexes(recurrence, rule.nextIndex, today, MAX_CATCH_UP);
    const last = due[due.length - 1];
    if (last === undefined) {
      return;
    }
    const prepared: Model[] = [];
    for (const index of due) {
      const row = await prepareOccurrence(rule, occurrence(recurrence, index), rule.amount);
      if (row) {
        prepared.push(row);
        written++;
      }
    }
    prepared.push(prepareAdvance(rule, last));
    await database.batch(prepared);
  });
  return written;
};

/** "Start from today": skips the occurrences before `today` without making them; today's, if any, is still made. */
export const startFromToday = async (ruleId: string, today: IsoDay): Promise<void> => {
  await database.write(async () => {
    const rule = await database.get<RecurringRule>('recurring_rules').find(ruleId);
    const recurrence = recurrenceOf(fieldsOf(rule));
    const nextIndex = firstIndexOnOrAfter(recurrence, rule.nextIndex, today);
    if (nextIndex === rule.nextIndex) {
      return;
    }
    await rule.update(r => {
      r.nextIndex = nextIndex;
      r.nextRun = nextRunOf(recurrence, nextIndex);
    });
  });
};

/**
 * Confirms the occurrence a "varies" rule is waiting on, with the amount the
 * user typed: the row is made and the rule moves on, in one batch. Refuses
 * (`notWaiting`) an occurrence that is not the one waiting (a stale screen).
 */
export const confirmOccurrence = async (ruleId: string, index: number, amount: number): Promise<void> => {
  if (!Number.isFinite(amount) || toMoneyUnits(amount) <= 0 || amount > MAX_AMOUNT) {
    throw new RecurringRuleError('amountNotValid');
  }
  await database.write(async () => {
    const rule = await database.get<RecurringRule>('recurring_rules').find(ruleId);
    // A stale screen (the rule moved on since): refused, so the screen does not report an entry made.
    if (rule.nextIndex !== index) {
      throw new RecurringRuleError('notWaiting');
    }
    const recurrence = recurrenceOf(fieldsOf(rule));
    const row = await prepareOccurrence(rule, occurrence(recurrence, index), amount);
    await database.batch([...(row ? [row] : []), prepareAdvance(rule, index)]);
  });
};

/** Skips the occurrence a rule is waiting on, making nothing for it. Refuses a stale one, as confirm does. */
export const skipOccurrence = async (ruleId: string, index: number): Promise<void> => {
  await database.write(async () => {
    const rule = await database.get<RecurringRule>('recurring_rules').find(ruleId);
    if (rule.nextIndex !== index) {
      throw new RecurringRuleError('notWaiting');
    }
    await database.batch([prepareAdvance(rule, index)]);
  });
};

/** An occurrence still to come, for the upcoming strip and the reminders. */
export interface Upcoming {
  ruleId: string;
  index: number;
  day: IsoDay;
  target: RuleTarget;
  title: string;
  /** Null: varies. */
  amount: number | null;
  remindDaysBefore: number | null;
  /**
   * It takes money out of what the user can spend (domain/commitments): an
   * expense, or a transfer from a spendable account into an investment.
   */
  leaves: boolean;
  /** A transfer into a card or a loan: a bill or an EMI, paying down what is owed. */
  paysDebt: boolean;
}

/**
 * Whether a rule's occurrences leave what the user has in hand: an expense
 * paid from a spend account, or a transfer out of one into a card, a loan
 * or savings. A rule whose account is gone does not (an expense's falls back
 * to the default, which is money to spend).
 */
const leavesSpendable = (rule: RecurringRule, refs: Refs): boolean => {
  const target = toRuleTarget(rule.target);
  const from = refs.accounts.get(rule.accountId);
  if (target === 'expense') {
    return !from || isSpendable(toAccountType(from.type));
  }
  if (target !== 'transfer') {
    return false;
  }
  const to = rule.toAccountId === null ? undefined : refs.accounts.get(rule.toAccountId);
  return !!from && !!to && isSpendable(toAccountType(from.type)) && !isSpendable(toAccountType(to.type));
};

/** Whether a rule moves money into a card or a loan (a bill, an EMI). */
const paysDownDebt = (rule: RecurringRule, refs: Refs): boolean => {
  if (toRuleTarget(rule.target) !== 'transfer' || rule.toAccountId === null) {
    return false;
  }
  const to = refs.accounts.get(rule.toAccountId);
  return !!to && isOwedType(toAccountType(to.type));
};

/**
 * The occurrences of the user's active rules from `fromDay` to `days` days
 * after it, soonest first. Paused rules, and rules waiting for a category or
 * an account, have none.
 */
export const getUpcoming = async (userId: string, fromDay: IsoDay, days: number): Promise<Upcoming[]> => {
  const until = shiftIsoDay(fromDay, days);
  const [rules, refs] = await Promise.all([
    database
      .get<RecurringRule>('recurring_rules')
      .query(Q.where('user_id', userId), Q.where('rule_status', true), Q.where('next_run', Q.notEq(null)))
      .fetch(),
    refsOf(userId),
  ]);
  const upcoming: Upcoming[] = [];
  for (const rule of rules) {
    if (statusOf(rule, refs) !== 'active') {
      continue;
    }
    const recurrence = recurrenceOf(fieldsOf(rule));
    const leaves = leavesSpendable(rule, refs);
    const paysDebt = paysDownDebt(rule, refs);
    for (let index = firstIndexOnOrAfter(recurrence, rule.nextIndex, fromDay); ; index++) {
      const day = nextRunOf(recurrence, index);
      if (day === null || day > until) {
        break;
      }
      upcoming.push({
        ruleId: rule.id,
        index,
        day,
        target: toRuleTarget(rule.target),
        title: rule.title,
        amount: rule.amount,
        remindDaysBefore: rule.remindDaysBefore,
        leaves,
        paysDebt,
      });
    }
  }
  return upcoming.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.title.localeCompare(b.title)));
};

/**
 * The occurrences still to come from `fromDay` through `lastDay`, both
 * included: what a month (or a pay cycle) still holds. Nothing when the
 * stretch is empty.
 */
export const getDueThrough = async (userId: string, fromDay: IsoDay, lastDay: IsoDay): Promise<Upcoming[]> => {
  if (lastDay < fromDay) {
    return [];
  }
  const days = Math.round((Date.parse(`${lastDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
  return getUpcoming(userId, fromDay, days);
};
