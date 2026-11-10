import type {BudgetMonthKey} from './types';
import {keptOf, splitForAllowance} from './periodMath';
import {fromMoneyUnits, toMoneyUnits} from './money';
/**
 * Daily-budget maths, shared by HomeScreen, ReportsScreen and ExpenseEntry —
 * previously three divergent inline copies of `budget / daysInMonth`.
 *
 * The per-day figure is ADAPTIVE for the current month: what is actually left
 * of the monthly budget, spread over the days that remain (including today).
 *
 *   30k budget over 30 days                 → day 1:  (30k − 0)  / 30 = 1000/day
 *   spend 10k on day 2                      → day 3:  (30k − 10k) / 28 ≈  714/day
 *
 * Past (and future) months have no "remaining days", so they keep the plain
 * monthly average — which also means historical screens render exactly as
 * they did before this existed.
 */

interface DailyAllowanceInput {
  monthlyBudget: number;
  /** Spend in this month EXCLUDING the reference day itself. */
  spentBeforeToday: number;
  /** 1-based day of month the allowance is computed for. */
  dayOfMonth: number;
  daysInMonth: number;
  /** False → static monthly average (historical months). */
  isCurrentMonth: boolean;
}

interface DailyAllowance {
  /** Per-day figure to display. Never negative. */
  allowance: number;
  /** The month's budget is already fully spent before the reference day. */
  budgetExhausted: boolean;
}

export const computeDailyAllowance = ({
  monthlyBudget,
  spentBeforeToday,
  dayOfMonth,
  daysInMonth,
  isCurrentMonth,
}: DailyAllowanceInput): DailyAllowance => {
  if (monthlyBudget <= 0 || daysInMonth <= 0) {
    return {allowance: 0, budgetExhausted: monthlyBudget <= 0};
  }

  if (!isCurrentMonth) {
    return {allowance: monthlyBudget / daysInMonth, budgetExhausted: false};
  }

  const remainingBudget = monthlyBudget - spentBeforeToday;
  const remainingDays = Math.max(daysInMonth - dayOfMonth + 1, 1);

  return {
    // Clamped at 0: an overspent month shows "~0/day" and everything spent
    // today reads as "over today" — a negative daily allowance means nothing.
    allowance: Math.max(remainingBudget, 0) / remainingDays,
    budgetExhausted: remainingBudget <= 0,
  };
};

/** How a month stands against its budget: everything Home's and Reports' budget cards show. */
interface BudgetStatus {
  /** The month's budget. */
  amount: number;
  /** Spent past the budget. */
  exceeded: boolean;
  /** What is left (≥ 0, 0 when exceeded) and how far over (≥ 0, 0 when not). Exact. */
  left: number;
  over: number;
  /** Spent as a whole percent of the budget, capped at 999 (the card's figure). */
  percent: number;
  /** The progress bar's fill, 0–100. */
  fill: number;
  /** The daily allowance (adaptive in the current month) and what is left of it today. */
  dailyBudget: number;
  dailyLeft: number;
}

/**
 * One month against its budget (audit 2026-11-08 §5): Home and Reports each
 * computed this in the component, in floats. Money is added in exact units
 * (R10); money back today is spread over the days left (splitForAllowance).
 */
export const budgetStatus = ({
  budget,
  spent,
  spentToday,
  dayOfMonth,
  daysInMonth,
  isCurrentMonth,
}: {
  budget: number;
  /** The month's spending, net of its refunds (R2). */
  spent: number;
  /** The part of it dated today. */
  spentToday: number;
  dayOfMonth: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
}): BudgetStatus => {
  const balance = keptOf(budget, spent);
  const split = splitForAllowance(spent, spentToday);
  const {allowance} = computeDailyAllowance({
    monthlyBudget: budget,
    spentBeforeToday: split.spentBeforeToday,
    dayOfMonth,
    daysInMonth,
    isCurrentMonth,
  });
  const ratio = budget > 0 ? (spent / budget) * 100 : 0;
  return {
    amount: budget,
    exceeded: balance < 0,
    left: Math.max(balance, 0),
    over: Math.max(-balance, 0),
    percent: Math.min(Math.round(ratio), 999),
    fill: Math.min(Math.max(ratio, 0), 100),
    dailyBudget: allowance,
    dailyLeft: fromMoneyUnits(toMoneyUnits(allowance) - toMoneyUnits(split.spentToday)),
  };
};

// ---------------------------------------------------------------------------
// Budget row resolution — which stored row applies to a month.
//
// `month` on a budget row takes one of three forms (see budgetService):
//   '2026-07'            — that month only. An amount of 0 is a TOMBSTONE: the
//                          user removed a recurring budget for this one month.
//   'recurring:2026-07'  — July 2026 and every month after, until a later
//                          recurring row (greater start) takes over. Amount 0
//                          is a STOP marker: no budget from this month on.
//   'recurring'          — legacy, no start month; behaves like start ''.
//
// Several recurring rows with different starts may coexist, which is what
// lets "set 15k from October" keep "10k since July" for July–September
// instead of overwriting history (the pre-2.7.0 behaviour).
// ---------------------------------------------------------------------------

/** Stored-form prefix; only the parser below and budgetService's SQL `like` may use it. */
export const RECURRING_PREFIX = 'recurring:';
const LEGACY_RECURRING = 'recurring';

/**
 * A budget row's month is stored as a string (M16, v2.7.1): it is read here
 * and written by `encodeBudgetMonth`, nowhere else.
 */
export const parseBudgetMonth = (month: string): BudgetMonthKey => {
  if (month === LEGACY_RECURRING) {
    return {kind: 'recurring', start: ''};
  }
  if (month.startsWith(RECURRING_PREFIX)) {
    return {kind: 'recurring', start: month.slice(RECURRING_PREFIX.length)};
  }
  return {kind: 'month', yearMonth: month};
};

export const encodeBudgetMonth = (key: BudgetMonthKey): string => {
  if (key.kind === 'month') {
    return key.yearMonth;
  }
  return key.start ? `${RECURRING_PREFIX}${key.start}` : LEGACY_RECURRING;
};

/** Lexicographic comparison is correct only because months are zero-padded YYYY-MM. */
export const budgetAppliesTo = (key: BudgetMonthKey, yearMonth: string): boolean =>
  key.kind === 'recurring' ? key.start <= yearMonth : key.yearMonth === yearMonth;

/**
 * Picks the row in force for `yearMonth` out of rows that may or may not
 * apply to it, or null when there is no budget (including tombstones/stops).
 * Precedence: the month-specific row, then the recurring row with the
 * greatest start month that is <= yearMonth.
 */
export const resolveBudget = <T extends {amount: number; monthKey: BudgetMonthKey}>(
  rows: readonly T[],
  yearMonth: string,
): T | null => {
  let specific: T | null = null;
  let recurring: {row: T; start: string} | null = null;
  for (const row of rows) {
    const key = row.monthKey;
    if (!budgetAppliesTo(key, yearMonth)) {
      continue;
    }
    if (key.kind === 'month') {
      specific = row;
    } else if (!recurring || key.start > recurring.start) {
      recurring = {row, start: key.start};
    }
  }
  const winner = specific ?? recurring?.row ?? null;
  return winner && winner.amount > 0 ? winner : null;
};
