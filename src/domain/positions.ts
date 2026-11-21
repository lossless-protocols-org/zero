import type {CheckpointKind} from './types';
import {positionLineOf, type AccountType} from './accounts';

/**
 * Positions (ZERO_SYSTEM_DESIGN.md §2.1, R8, R15, R16): what an account
 * holds on a day, net worth, and the articulation that ties net worth to the
 * period's flows. Pure, in money units (domain/money: exact integers), on
 * numbers the caller has already read. netWorthService reads the rows; this
 * decides what they add up to, so the service and the tests' brute force
 * cannot disagree about a rule.
 *
 * Days are 'YYYY-MM-DD' and compare as strings. A day range `(after, upTo]`
 * is every row dated after `after` and on or before `upTo`; `after: null`
 * means from the beginning.
 *
 * The balance rule, one sentence each:
 * - A checkpoint is the balance at the END of its day, as the user read it.
 * - The anchor is the last checkpoint on or before the day asked for
 *   (same day: the one made last). Without one, the opening balance.
 * - The opening balance counts from its opening date; no date means from the beginning.
 * - Every row of the account counts on its own day after the anchor.
 */

/** An account's opening balance and the day it applies from (null: from the beginning). */
export interface Opening {
  units: number;
  date: string | null;
}

/** A checkpoint as the position rules need it. */
export interface CheckpointPoint {
  id: string;
  date: string;
  balanceUnits: number;
  /** Epoch ms; orders two checkpoints of one day (the later one is the anchor). */
  createdAt: number;
  kind: CheckpointKind;
}

/** Net money into one account over `(after, upTo]`, in units: money in positive, money out negative. */
export type FlowsBetween = (after: string | null, upTo: string) => number;

/** Oldest first: by day, then by when it was made, then by id (so the order is total). */
export const compareCheckpoints = (a: CheckpointPoint, b: CheckpointPoint): number => {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** The anchor for `asOf` among checkpoints already in `compareCheckpoints` order. */
export const anchorOn = (ordered: readonly CheckpointPoint[], asOf: string): CheckpointPoint | undefined => {
  let anchor: CheckpointPoint | undefined;
  for (const checkpoint of ordered) {
    if (checkpoint.date > asOf) {
      break;
    }
    anchor = checkpoint;
  }
  return anchor;
};

/**
 * The opening balance if it is brought in during `(after, upTo]`. An opening
 * with no date belongs to the very beginning, so only a range from the
 * beginning holds it; an anchor after it has already taken it in.
 * @internal Used by the functions below; tests check it alone.
 */
export const openingBetween = (opening: Opening, after: string | null, upTo: string): number => {
  if (opening.date === null) {
    return after === null ? opening.units : 0;
  }
  return (after === null || opening.date > after) && opening.date <= upTo ? opening.units : 0;
};

/** An account's balance at the end of `asOf` (the anchor plus everything after it). */
export const balanceOn = (
  ordered: readonly CheckpointPoint[],
  opening: Opening,
  flows: FlowsBetween,
  asOf: string,
): number => {
  const anchor = anchorOn(ordered, asOf);
  const after = anchor?.date ?? null;
  return (anchor?.balanceUnits ?? 0) + openingBetween(opening, after, asOf) + flows(after, asOf);
};

/**
 * What a checkpoint changed, as things stand now: its balance minus the
 * balance the rows gave on its day without it. Equal to the gap stored when
 * it was accepted until an entry is added, edited or removed on or before
 * that day; from then on this one is the true gap, so the articulation stays
 * exact while the stored gap stays the record of what the user was shown.
 * @internal Used by movementOf; tests check it alone.
 */
export const effectiveGap = (
  ordered: readonly CheckpointPoint[],
  index: number,
  opening: Opening,
  flows: FlowsBetween,
): number => {
  const checkpoint = ordered[index];
  if (!checkpoint) {
    return 0;
  }
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const after = previous?.date ?? null;
  const without =
    (previous?.balanceUnits ?? 0) + openingBetween(opening, after, checkpoint.date) + flows(after, checkpoint.date);
  return checkpoint.balanceUnits - without;
};

/** One account's movement over `(after, upTo]`, split by cause. `end − start` is always the sum of the rest. */
export interface AccountMovement {
  start: number;
  end: number;
  /** Rows: entries, transfers and debts through the account. */
  flows: number;
  /** The opening balance, when its date falls in the period. */
  opening: number;
  revaluations: number;
  adjustments: number;
}

export const movementOf = (
  ordered: readonly CheckpointPoint[],
  opening: Opening,
  flows: FlowsBetween,
  after: string,
  upTo: string,
): AccountMovement => {
  let revaluations = 0;
  let adjustments = 0;
  ordered.forEach((checkpoint, index) => {
    if (checkpoint.date > after && checkpoint.date <= upTo) {
      const gap = effectiveGap(ordered, index, opening, flows);
      if (checkpoint.kind === 'revaluation') {
        revaluations += gap;
      } else {
        adjustments += gap;
      }
    }
  });
  return {
    start: balanceOn(ordered, opening, flows, after),
    end: balanceOn(ordered, opening, flows, upTo),
    flows: flows(after, upTo),
    opening: openingBetween(opening, after, upTo),
    revaluations,
    adjustments,
  };
};

/** Net worth's four lines (design §2.1), each a non-negative reading except where an account itself is below zero. */
export interface NetWorthLines {
  cashAndBank: number;
  investments: number;
  /** What people owe you (lendings not yet paid back, by person). */
  owedToYou: number;
  /** What you owe: borrowings not yet paid back, and cards below zero. Positive. */
  youOwe: number;
}

/** Net worth from its lines: what you hold and are owed, less what you owe. */
export const netWorthOf = (lines: NetWorthLines): number =>
  lines.cashAndBank + lines.investments + lines.owedToYou - lines.youOwe;

/**
 * The four lines from each account's balance and each person's net debt
 * (units; positive = you owe them, as domain/debtType's netDebt).
 */
export const linesOf = (
  accounts: ReadonlyArray<{type: AccountType; balanceUnits: number}>,
  netDebtByPerson: Iterable<number>,
): NetWorthLines => {
  const lines: NetWorthLines = {cashAndBank: 0, investments: 0, owedToYou: 0, youOwe: 0};
  for (const {type, balanceUnits} of accounts) {
    const line = positionLineOf(type, balanceUnits);
    lines[line] += line === 'youOwe' ? -balanceUnits : balanceUnits;
  }
  for (const net of netDebtByPerson) {
    if (net > 0) {
      lines.youOwe += net;
    } else {
      lines.owedToYou -= net;
    }
  }
  return lines;
};

/**
 * R16 for a period: the change in net worth on one side, its causes on the
 * other. `holds` is exact equality in units; anything else means a row sits
 * outside every account (an orphaned reference) and Diagnostics says so.
 */
export interface Articulation {
  netWorthChange: number;
  kept: number;
  revaluations: number;
  adjustments: number;
  openings: number;
  /** Lent or borrowed without an account: the person's debt changed, no account did. */
  debtsOutsideAccounts: number;
  explained: number;
  holds: boolean;
}

export const articulationOf = (parts: {
  netWorthChange: number;
  kept: number;
  revaluations: number;
  adjustments: number;
  openings: number;
  debtsOutsideAccounts: number;
}): Articulation => {
  const explained = parts.kept + parts.revaluations + parts.adjustments + parts.openings + parts.debtsOutsideAccounts;
  return {...parts, explained, holds: explained === parts.netWorthChange};
};
