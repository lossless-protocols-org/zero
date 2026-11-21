import {fromMoneyUnits, toMoneyUnits} from './money';
import {classOf, type AccountType} from './accounts';
import type {RuleTarget} from './recurrence';

/**
 * What is already spoken for (3.0 UX revamp, v2): the recurring entries still
 * to come in a stretch of days, what they add up to, and what that leaves of
 * the money the user can spend. Pure subtraction of things the user entered:
 * nothing is predicted. A bill whose amount varies is named, never guessed.
 */

/** One occurrence still to come, as commitmentsService reads it. */
export interface Due {
  ruleId: string;
  index: number;
  day: string;
  title: string;
  target: RuleTarget;
  /** Null: the amount varies, so it is named and not summed. */
  amount: number | null;
  /**
   * Money that leaves what the user has in hand: an expense paid from money
   * to spend, or a transfer out of it into a card, a loan or savings (a card
   * bill, an EMI, an SIP). Money in, an expense charged to a card (in hand
   * changes only when the bill is paid) and a move between two spend
   * accounts do not.
   */
  leaves: boolean;
}

export interface StillToPay {
  /** The fixed amounts that leave, summed exactly. */
  total: number;
  /** Every occurrence that leaves, soonest first (fixed and varying). */
  items: Due[];
  /** The titles of the ones whose amount varies, each once, in date order. */
  varies: string[];
}

/** The occurrences that take money out of what the user can spend, and their sum. */
export const stillToPay = (upcoming: readonly Due[]): StillToPay => {
  const items = upcoming.filter(due => due.leaves);
  const units = items.reduce((sum, due) => sum + (due.amount === null ? 0 : toMoneyUnits(due.amount)), 0);
  const varies = [...new Set(items.filter(due => due.amount === null).map(due => due.title))];
  return {total: fromMoneyUnits(units), items, varies};
};

/**
 * The recurring expenses still to come, summed: the part of a budget that is
 * not free. Transfers are not spending and never count against a budget (R2).
 */
export const billsInBudget = (upcoming: readonly Due[]): number =>
  fromMoneyUnits(
    upcoming.reduce(
      (sum, due) => sum + (due.target === 'expense' && due.amount !== null ? toMoneyUnits(due.amount) : 0),
      0,
    ),
  );

/** An account type whose balance is money in hand: spend accounts only. Cards, loans and savings are not. */
export const isSpendable = (type: AccountType): boolean => classOf(type) === 'spend';

/**
 * What the user has in hand today: every spend account, an overdrawn one in
 * minus. What is owed on cards and loans is not taken off here: it is owed,
 * on the other side (approved model A2).
 */
export const toSpendOf = (accounts: ReadonlyArray<{type: AccountType; balance: number}>): number =>
  fromMoneyUnits(
    accounts.reduce((sum, account) => sum + (isSpendable(account.type) ? toMoneyUnits(account.balance) : 0), 0),
  );

/** `amount` less `less`, exact. */
export const lessOf = (amount: number, less: number): number =>
  fromMoneyUnits(toMoneyUnits(amount) - toMoneyUnits(less));

/**
 * The oldest day any balance in hand was last set by hand, or null when
 * none was: the statement is only as true as its stalest balance.
 */
export const oldestCheckOf = (
  accounts: ReadonlyArray<{type: AccountType; anchorDate: string | null; active: boolean}>,
): string | null => {
  const days = accounts
    .filter(account => account.active && isSpendable(account.type))
    .map(account => account.anchorDate)
    .filter((day): day is string => day !== null)
    .sort();
  return days[0] ?? null;
};

/** Occurrences of one rule on later days folded into its first: "Milk, 3 more times". */
export interface FoldedDue extends Due {
  /** How many later occurrences of the same rule were folded in. */
  more: number;
  /** The fixed amounts of all of them together; null when it varies. */
  sum: number | null;
}

/** One line per rule, at its first day, carrying the sum of its occurrences. */
export const foldByRule = (items: readonly Due[]): FoldedDue[] => {
  const byRule = new Map<string, FoldedDue>();
  for (const due of items) {
    const first = byRule.get(due.ruleId);
    if (!first) {
      byRule.set(due.ruleId, {...due, more: 0, sum: due.amount});
    } else {
      first.more += 1;
      first.sum = first.sum === null || due.amount === null ? null : lessOf(first.sum, -due.amount);
    }
  }
  return [...byRule.values()];
};
