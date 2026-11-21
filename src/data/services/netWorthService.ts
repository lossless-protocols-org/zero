import {Q} from '@nozbe/watermelondb';
import type {Clause} from '@nozbe/watermelondb/QueryDescription';
import {database} from '../database/database';
import {Account} from '../database/models/Account';
import {dayRangeClauses, periodClauses} from './expenseDateRange';
import type {Period} from '../../domain/period';
import {flowSumsAt} from './positionSums';
import {getDayRangeSummary} from './periodSummaryService';
import {isBorrowType} from '../../domain/debtType';
import {fromMoneyUnits, toMoneyUnits} from '../../domain/money';
import {toAccountType, toCheckpointKind, type AccountType} from '../../domain/accounts';
import {
  anchorOn,
  articulationOf,
  balanceOn,
  compareCheckpoints,
  linesOf,
  movementOf,
  netWorthOf,
  type AccountMovement,
  type CheckpointPoint,
  type FlowsBetween,
  type NetWorthLines,
  type Opening,
} from '../../domain/positions';
import {compareDateKeys, shiftIsoDay} from '../../domain/dates';

/**
 * The second seam between the two books (ZERO_SYSTEM_DESIGN.md §2.1, P7):
 * account balances, net worth and the articulation, from the database. With
 * periodSummaryService the only module that reads more than one fact table.
 * The rules are domain/positions'; this reads the rows they need.
 *
 * A balance reads the account's latest checkpoint on or before the day, then
 * every row after it: each fact table is one range on its (user_id,
 * account_id, date) index (schema v6). Tier-blind like every service: a free
 * user's balances exist; whether to show them is the screen's business.
 */

/** One account and its balance at the end of a day. Major units. */
export interface AccountBalance {
  accountId: string;
  name: string;
  type: AccountType;
  balance: number;
  /** The day of the checkpoint the balance starts from; null when it starts from the opening balance. */
  anchorDate: string | null;
  isDefault: boolean;
  /** False when archived: still counted in net worth, no longer offered for new entries. */
  active: boolean;
  sortOrder: number;
  icon: string;
  color: string;
  /** The user's own label, '' when none. No sum reads it. */
  kind: string;
}

export interface NetWorth {
  total: number;
  lines: NetWorthLines;
  accounts: AccountBalance[];
}

/** R16 over the days after `after` up to `upTo`, in major units; `holds` is decided in exact units. */
export interface PeriodArticulation {
  netWorthChange: number;
  kept: number;
  revaluations: number;
  adjustments: number;
  openings: number;
  debtsOutsideAccounts: number;
  holds: boolean;
}

// Raw row shapes (column names; keep in step with schema.ts, v5Tables.ts, v6Tables.ts).
interface AmountRow {
  amount: number;
  date: string;
}
interface RawCheckpointRow {
  id: string;
  balance: number;
  date: string;
  kind: string;
  created_at: number;
}
interface RawDebtRow {
  amount: number;
  date: string;
  type: string;
  debtor_id: string;
  account_id: string | null;
}

const rowsOf = <T>(table: string, ...clauses: Clause[]): Promise<T[]> =>
  // unsafeFetchRaw is typed any[]; each caller names the columns its table has (schema.ts).
  database
    .get(table)
    .query(...clauses)
    .unsafeFetchRaw();

/**
 * `FlowsBetween` over sums read for `(windowAfter, day]` at each breakpoint
 * day. Asking about a range that does not start at the window or at a
 * breakpoint is a programming error, not a zero: it would silently drop
 * money, so it throws.
 */
const flowsAt = async (
  userId: string,
  accountId: string,
  windowAfter: string | null,
  breakpoints: readonly string[],
): Promise<FlowsBetween> => {
  const days = [...new Set(breakpoints)].sort();
  const sums = await flowSumsAt(userId, accountId, windowAfter, days);
  const prefix = new Map(days.map((day, i) => [day, sums[i] ?? 0]));
  const at = (day: string | null): number => {
    if (day === windowAfter) {
      return 0;
    }
    const found = day === null ? undefined : prefix.get(day);
    if (found === undefined) {
      throw new Error(`Flows asked at ${day ?? 'the beginning'}, read only after ${windowAfter ?? 'the beginning'}`);
    }
    return found;
  };
  return (after, upTo) => (after !== null && after >= upTo ? 0 : at(upTo) - at(after));
};

const checkpointsOf = async (userId: string, accountId: string): Promise<CheckpointPoint[]> =>
  (await rowsOf<RawCheckpointRow>('checkpoints', Q.where('user_id', userId), Q.where('account_id', accountId)))
    .map(row => ({
      id: row.id,
      date: row.date,
      balanceUnits: toMoneyUnits(row.balance),
      createdAt: row.created_at,
      kind: toCheckpointKind(row.kind),
    }))
    .sort(compareCheckpoints);

const openingOf = (account: Account): Opening => ({
  units: toMoneyUnits(account.openingBalance),
  date: account.openingDate,
});

/** Balance in units and its anchor, reading only the rows after the anchor. */
const balanceUnitsOf = async (
  userId: string,
  account: Account,
  asOf: string,
): Promise<{units: number; anchorDate: string | null}> => {
  const ordered = await checkpointsOf(userId, account.id);
  const anchorDate = anchorOn(ordered, asOf)?.date ?? null;
  const flows = await flowsAt(userId, account.id, anchorDate, [asOf]);
  return {units: balanceOn(ordered, openingOf(account), flows, asOf), anchorDate};
};

const accountsOf = (userId: string): Promise<Account[]> =>
  database.get<Account>('accounts').query(Q.where('user_id', userId), Q.sortBy('sort_order', Q.asc)).fetch();

const toAccountBalance = (account: Account, units: number, anchorDate: string | null): AccountBalance => ({
  accountId: account.id,
  name: account.name,
  type: toAccountType(account.type),
  balance: fromMoneyUnits(units),
  anchorDate,
  isDefault: account.isDefault,
  active: account.accountStatus,
  sortOrder: account.sortOrder,
  icon: account.icon,
  color: account.color,
  kind: account.kind ?? '',
});

/** One account's balance at the end of `asOf`. Throws when the account is not the user's. */
export const getAccountBalance = async (userId: string, accountId: string, asOf: string): Promise<AccountBalance> => {
  const [account] = await database
    .get<Account>('accounts')
    .query(Q.where('id', accountId), Q.where('user_id', userId))
    .fetch();
  if (!account) {
    throw new Error(`No account ${accountId} for this user`);
  }
  const {units, anchorDate} = await balanceUnitsOf(userId, account, asOf);
  return toAccountBalance(account, units, anchorDate);
};

/** Each person's net debt in units dated on or before `asOf` (positive: you owe them). */
const netDebtUnitsByPerson = (debts: readonly RawDebtRow[], asOf: string): number[] => {
  const byPerson = new Map<string, number>();
  for (const row of debts) {
    if (row.date.slice(0, 10) <= asOf) {
      const units = (isBorrowType(row.type) ? 1 : -1) * toMoneyUnits(row.amount);
      byPerson.set(row.debtor_id, (byPerson.get(row.debtor_id) ?? 0) + units);
    }
  }
  return [...byPerson.values()];
};

const debtsUpTo = (userId: string, asOf: string): Promise<RawDebtRow[]> =>
  rowsOf<RawDebtRow>('debts', Q.where('user_id', userId), ...dayRangeClauses(null, asOf));

const toMajorLines = (lines: NetWorthLines): NetWorthLines => ({
  cashAndBank: fromMoneyUnits(lines.cashAndBank),
  investments: fromMoneyUnits(lines.investments),
  owedToYou: fromMoneyUnits(lines.owedToYou),
  youOwe: fromMoneyUnits(lines.youOwe),
});

/**
 * Net worth at the end of `asOf` (R8): every account's balance, archived ones
 * included (archiving hides an account, it does not spend its money), plus
 * what people owe you, less what you owe. With the four lines and each account.
 */
export const getNetWorth = async (userId: string, asOf: string): Promise<NetWorth> => {
  const [accounts, debts] = await Promise.all([accountsOf(userId), debtsUpTo(userId, asOf)]);
  const balances = await Promise.all(accounts.map(account => balanceUnitsOf(userId, account, asOf)));
  const lines = linesOf(
    accounts.map((account, i) => ({type: toAccountType(account.type), balanceUnits: balances[i]?.units ?? 0})),
    netDebtUnitsByPerson(debts, asOf),
  );
  return {
    total: fromMoneyUnits(netWorthOf(lines)),
    lines: toMajorLines(lines),
    accounts: accounts.map((account, i) =>
      toAccountBalance(account, balances[i]?.units ?? 0, balances[i]?.anchorDate ?? null),
    ),
  };
};

/**
 * R16 for the days `from` to `to` inclusive ('YYYY-MM-DD'): the change in net
 * worth from the end of the day before `from` to the end of `to`, and its
 * causes. Each account is read from its last checkpoint before the period
 * (or from the beginning), once, so the balances at both ends and every gap
 * come from the same rows.
 */
/** One account's movement over `(after, to]`, read from its last checkpoint before the period (or the beginning). */
const movementIn = async (
  userId: string,
  account: Account,
  ordered: CheckpointPoint[],
  after: string,
  to: string,
): Promise<AccountMovement> => {
  // Rows from the start balance's anchor on: every gap in the period and both ends need nothing earlier.
  const windowAfter = anchorOn(ordered, after)?.date ?? null;
  // Every day a balance or a gap is asked at: both ends, and each checkpoint in the period.
  const inPeriod = ordered.filter(c => c.date > after && c.date <= to).map(c => c.date);
  const flows = await flowsAt(userId, account.id, windowAfter, [after, to, ...inPeriod]);
  return movementOf(ordered, openingOf(account), flows, after, to);
};

/**
 * What balances set by hand explained in the days `from` to `to` on cash,
 * bank and every other account but investments: money the entries do not
 * account for (ZERO_3.0_PRO.md §5, Reports' "Unexplained" line). Only the
 * accounts with such a checkpoint in the period are read. Investments'
 * value changes are not here: they are not flows, and never in Reports.
 */
export const getUnexplained = async (userId: string, from: string, to: string): Promise<number> => {
  const after = shiftIsoDay(from, -1);
  const accounts = await accountsOf(userId);
  const parts = await Promise.all(
    accounts.map(async account => {
      const ordered = await checkpointsOf(userId, account.id);
      const touched = ordered.some(c => c.kind === 'adjustment' && c.date > after && c.date <= to);
      return touched ? (await movementIn(userId, account, ordered, after, to)).adjustments : 0;
    }),
  );
  return fromMoneyUnits(parts.reduce((sum, units) => sum + units, 0));
};

export const articulate = async (userId: string, from: string, to: string): Promise<PeriodArticulation> => {
  const after = shiftIsoDay(from, -1);
  const [accounts, debts, summary] = await Promise.all([
    accountsOf(userId),
    debtsUpTo(userId, to),
    getDayRangeSummary(userId, after, to),
  ]);
  const movements = await Promise.all(
    accounts.map(async account => ({
      type: toAccountType(account.type),
      movement: await movementIn(userId, account, await checkpointsOf(userId, account.id), after, to),
    })),
  );
  const debtLines = (asOf: string) => netDebtUnitsByPerson(debts, asOf);
  const startLines = linesOf(
    movements.map(({type, movement}) => ({type, balanceUnits: movement.start})),
    debtLines(after),
  );
  const endLines = linesOf(
    movements.map(({type, movement}) => ({type, balanceUnits: movement.end})),
    debtLines(to),
  );
  // Lent or borrowed through no account: a lending is owed to you (+), a borrowing is owed by you (−).
  const debtsOutsideAccounts = debts
    .filter(row => row.account_id === null && row.date.slice(0, 10) > after)
    .reduce((sum, row) => sum + (isBorrowType(row.type) ? -1 : 1) * toMoneyUnits(row.amount), 0);
  const sum = (pick: (m: (typeof movements)[number]['movement']) => number): number =>
    movements.reduce((total, {movement}) => total + pick(movement), 0);
  const result = articulationOf({
    netWorthChange: netWorthOf(endLines) - netWorthOf(startLines),
    kept: toMoneyUnits(summary.kept),
    revaluations: sum(m => m.revaluations),
    adjustments: sum(m => m.adjustments),
    openings: sum(m => m.opening),
    debtsOutsideAccounts,
  });
  return {
    netWorthChange: fromMoneyUnits(result.netWorthChange),
    kept: fromMoneyUnits(result.kept),
    revaluations: fromMoneyUnits(result.revaluations),
    adjustments: fromMoneyUnits(result.adjustments),
    openings: fromMoneyUnits(result.openings),
    debtsOutsideAccounts: fromMoneyUnits(result.debtsOutsideAccounts),
    holds: result.holds,
  };
};

/** What a row on an account's month list is. */
type AccountEntryKind =
  'expense' | 'refund' | 'income' | 'transferIn' | 'transferOut' | 'lent' | 'borrowed' | 'checkpoint';

/** One row of an account's month: every fact table merged (ZERO_3.0_PRO.md §5, AccountScreen). */
export interface AccountEntry {
  kind: AccountEntryKind;
  id: string;
  date: string;
  /** Its effect on the account, money in positive; for a checkpoint, the balance it set. Major units. */
  amount: number;
  /** The expense's title (a refund: its expense's), the note of money in, the other account, the person. */
  label: string;
  /** A refund's expense, for opening it. */
  expenseId?: string;
}

interface RawIdRow extends AmountRow {
  id: string;
}

/**
 * Every row on one account dated in a period (the user's month), newest first. Names
 * (an expense title, another account, a person) are read here once per
 * month, not per row.
 */
export const getAccountMonth = async (userId: string, accountId: string, period: Period): Promise<AccountEntry[]> => {
  const month = periodClauses(period);
  const own = [Q.where('user_id', userId), Q.where('account_id', accountId), ...month];
  const [expenses, refunds, incomes, sent, received, debts, checkpoints, accounts] = await Promise.all([
    rowsOf<RawIdRow & {title: string}>('expenses', ...own),
    rowsOf<RawIdRow & {expense_id: string}>('refunds', ...own),
    rowsOf<RawIdRow & {note: string | null}>('incomes', ...own),
    rowsOf<RawIdRow & {to_account_id: string}>(
      'transfers',
      Q.where('user_id', userId),
      Q.where('from_account_id', accountId),
      ...month,
    ),
    rowsOf<RawIdRow & {from_account_id: string}>(
      'transfers',
      Q.where('user_id', userId),
      Q.where('to_account_id', accountId),
      ...month,
    ),
    rowsOf<RawIdRow & RawDebtRow>('debts', ...own),
    rowsOf<RawCheckpointRow>('checkpoints', ...own),
    accountsOf(userId),
  ]);
  const accountName = new Map(accounts.map(a => [a.id, a.name]));
  const parentIds = [...new Set(refunds.map(r => r.expense_id))];
  const debtorIds = [...new Set(debts.map(d => d.debtor_id))];
  const [parents, debtors] = await Promise.all([
    parentIds.length === 0
      ? Promise.resolve([])
      : rowsOf<{id: string; title: string}>('expenses', Q.where('id', Q.oneOf(parentIds))),
    debtorIds.length === 0
      ? Promise.resolve([])
      : rowsOf<{id: string; title: string}>('debtors', Q.where('id', Q.oneOf(debtorIds))),
  ]);
  const parentTitle = new Map(parents.map(p => [p.id, p.title]));
  const debtorTitle = new Map(debtors.map(d => [d.id, d.title]));
  const entries: AccountEntry[] = [
    ...expenses.map(r => ({kind: 'expense' as const, id: r.id, date: r.date, amount: -r.amount, label: r.title})),
    ...refunds.map(r => ({
      kind: 'refund' as const,
      id: r.id,
      date: r.date,
      amount: r.amount,
      label: parentTitle.get(r.expense_id) ?? '',
      expenseId: r.expense_id,
    })),
    ...incomes.map(r => ({kind: 'income' as const, id: r.id, date: r.date, amount: r.amount, label: r.note ?? ''})),
    ...sent.map(r => ({
      kind: 'transferOut' as const,
      id: r.id,
      date: r.date,
      amount: -r.amount,
      label: accountName.get(r.to_account_id) ?? '',
    })),
    ...received.map(r => ({
      kind: 'transferIn' as const,
      id: r.id,
      date: r.date,
      amount: r.amount,
      label: accountName.get(r.from_account_id) ?? '',
    })),
    ...debts.map(r =>
      isBorrowType(r.type)
        ? {
            kind: 'borrowed' as const,
            id: r.id,
            date: r.date,
            amount: r.amount,
            label: debtorTitle.get(r.debtor_id) ?? '',
          }
        : {kind: 'lent' as const, id: r.id, date: r.date, amount: -r.amount, label: debtorTitle.get(r.debtor_id) ?? ''},
    ),
    ...checkpoints.map(r => ({kind: 'checkpoint' as const, id: r.id, date: r.date, amount: r.balance, label: ''})),
  ];
  return entries.sort((a, b) => compareDateKeys(a.date, b.date, -1));
};
