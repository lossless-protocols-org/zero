import {
  CHECKPOINTS_ACCOUNT_DATE_INDEX_SQL,
  RECURRING_RULES_NEXT_RUN_INDEX_SQL,
  TRANSFERS_ACCOUNT_DATE_INDEXES_SQL,
} from './indexes';
import {TIMESTAMP_COLUMNS, type TableDefinition} from './v5Tables';

/**
 * The column v6 (plan P9) adds to expenses, incomes and transfers: the
 * recurring rule a row was made from, or none. With the row's date it is
 * how the materialiser knows an occurrence was already written (a re-run, a
 * crash between writing and advancing): one index on it.
 */
export const RECURRING_ID_COLUMN = {name: 'recurring_id', type: 'string', isOptional: true, isIndexed: true} as const;

/**
 * The tables schema v6 (3.0) creates, defined once: schema.ts builds fresh
 * installs from them and migrations.ts creates them on upgraded devices
 * (ZERO_SYSTEM_DESIGN.md §4.4). Transfers and checkpoints are positions, not
 * flows: neither is ever read by spent, received or kept (R14). Recurring
 * rules (P9) make ordinary rows; the rules themselves are never totalled.
 */
export const V6_TABLES: readonly TableDefinition[] = [
  {
    // Money moved between two of the user's accounts. One row, two account columns.
    name: 'transfers',
    columns: [
      {name: 'user_id', type: 'string', isIndexed: true},
      {name: 'from_account_id', type: 'string', isIndexed: true},
      {name: 'to_account_id', type: 'string', isIndexed: true},
      {name: 'amount', type: 'number'},
      // A day, 'YYYY-MM-DD', as incomes and checkpoints: balances are compared by day.
      {name: 'date', type: 'string', isIndexed: true},
      {name: 'note', type: 'string'},
      ...TIMESTAMP_COLUMNS,
      // P9: made by a recurring rule (an SIP), or null.
      RECURRING_ID_COLUMN,
    ],
    unsafeSql: sql => sql + TRANSFERS_ACCOUNT_DATE_INDEXES_SQL,
  },
  {
    // "What does the bank (or broker) say?": an account's balance on a day, as the user read it.
    name: 'checkpoints',
    columns: [
      {name: 'user_id', type: 'string', isIndexed: true},
      {name: 'account_id', type: 'string', isIndexed: true},
      // May be negative: a card's balance is a liability.
      {name: 'balance', type: 'number'},
      {name: 'date', type: 'string', isIndexed: true},
      // Typed balance − derived balance on that day, stored when the user accepted it.
      {name: 'gap', type: 'number'},
      // CheckpointKind: 'revaluation' on an investment account, 'adjustment' on any other.
      {name: 'kind', type: 'string'},
      {name: 'note', type: 'string'},
      ...TIMESTAMP_COLUMNS,
    ],
    unsafeSql: sql => sql + CHECKPOINTS_ACCOUNT_DATE_INDEX_SQL,
  },
  {
    // P9: an expense, money in or transfer that repeats (rent, salary, an SIP).
    name: 'recurring_rules',
    columns: [
      {name: 'user_id', type: 'string', isIndexed: true},
      // 'expense' | 'income' | 'transfer' (domain/recurring RuleTarget).
      {name: 'target', type: 'string'},
      // What the made row is called: an expense's title, money in's note, a transfer's note.
      {name: 'title', type: 'string'},
      // The expense or income category; '' for a transfer.
      {name: 'category_id', type: 'string', isIndexed: true},
      // Paid from / comes into; a transfer's from.
      {name: 'account_id', type: 'string', isIndexed: true},
      // A transfer's to; null otherwise.
      {name: 'to_account_id', type: 'string', isOptional: true},
      // Null: the amount varies, and each occurrence asks for it.
      {name: 'amount', type: 'number', isOptional: true},
      // domain/recurrence Cadence, every `interval` of it, from `start_date`.
      {name: 'cadence', type: 'string'},
      {name: 'interval', type: 'number'},
      {name: 'start_date', type: 'string'},
      {name: 'end_date', type: 'string', isOptional: true},
      // The next occurrence to make, by index from start_date, and its day (null once the rule ended).
      {name: 'next_index', type: 'number'},
      {name: 'next_run', type: 'string', isOptional: true},
      // A reminder that many days before each occurrence, at 09:00; null: none.
      {name: 'remind_days_before', type: 'number', isOptional: true},
      // False: paused by the user. A rule whose category or account is gone pauses itself on read.
      {name: 'rule_status', type: 'boolean'},
      ...TIMESTAMP_COLUMNS,
    ],
    unsafeSql: sql => sql + RECURRING_RULES_NEXT_RUN_INDEX_SQL,
  },
];

/** The column v6 adds to debts: the account a lend or borrow moved money through, or none. */
export const DEBTS_ACCOUNT_COLUMN = {name: 'account_id', type: 'string', isOptional: true, isIndexed: true} as const;

/**
 * The column v6 adds to accounts (approved model A2): the user's own
 * one-word label for the account, or null. A label only: no sum reads it
 * (domain/accounts). Whether it shows is Pro's to say, never the data layer's.
 */
export const ACCOUNT_KIND_COLUMN = {name: 'kind', type: 'string', isOptional: true} as const;

/**
 * The column v6 (plan P11) adds to users: the day of the month the user's
 * month starts on (1 to 28), or null for the 1st. Read only through
 * domain/period.toMonthStartDay; whether it applies is Pro's to say
 * (src/pro/monthStart.ts), never the data layer's.
 */
export const MONTH_START_DAY_COLUMN = {name: 'month_start_day', type: 'number', isOptional: true} as const;
