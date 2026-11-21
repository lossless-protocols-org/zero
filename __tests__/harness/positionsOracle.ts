/**
 * Test-only: balances, net worth and Kept worked out the slow, obvious way,
 * from every row in the database, by replaying each account's history in
 * order with a running balance. Written apart from src/domain/positions on
 * purpose: the services are checked against a second reading of the rules,
 * not against their own code.
 *
 * The rules it replays (ZERO_SYSTEM_DESIGN.md §2.1): money in is incomes,
 * refunds, transfers in and borrowings through the account; money out is
 * expenses, transfers out and lendings; an opening balance arrives on its
 * day (no day: at the start); a checkpoint replaces the running balance at
 * the end of its day (two on a day: the one made last).
 */
import {database} from '../../src/data/database/database';

type Raw = Record<string, unknown>;

const all = async (table: string): Promise<Raw[]> => database.get(table).query().unsafeFetchRaw();

const units = (amount: unknown): number => Math.round(Number(amount) * 10_000);
const dayOf = (date: unknown): string => String(date).slice(0, 10);
const isBorrow = (type: unknown): boolean => String(type).trim().toLowerCase().startsWith('borrow');

export interface OracleData {
  accounts: Raw[];
  /** Per account: [day, units] events (money in positive). */
  events: Map<string, Array<{day: string; units: number}>>;
  checkpoints: Map<string, Raw[]>;
  debts: Raw[];
  flows: {expenses: Raw[]; refunds: Raw[]; incomes: Raw[]};
}

export const readOracle = async (): Promise<OracleData> => {
  const [accounts, expenses, refunds, incomes, transfers, debts, checkpoints] = await Promise.all(
    ['accounts', 'expenses', 'refunds', 'incomes', 'transfers', 'debts', 'checkpoints'].map(all),
  );
  const events = new Map<string, Array<{day: string; units: number}>>();
  const push = (accountId: unknown, date: unknown, value: number) => {
    const key = String(accountId);
    events.set(key, [...(events.get(key) ?? []), {day: dayOf(date), units: value}]);
  };
  for (const row of expenses ?? []) push(row['account_id'], row['date'], -units(row['amount']));
  for (const row of refunds ?? []) push(row['account_id'], row['date'], units(row['amount']));
  for (const row of incomes ?? []) push(row['account_id'], row['date'], units(row['amount']));
  for (const row of transfers ?? []) {
    push(row['from_account_id'], row['date'], -units(row['amount']));
    push(row['to_account_id'], row['date'], units(row['amount']));
  }
  for (const row of debts ?? []) {
    if (row['account_id'])
      push(row['account_id'], row['date'], (isBorrow(row['type']) ? 1 : -1) * units(row['amount']));
  }
  const byAccount = new Map<string, Raw[]>();
  for (const row of checkpoints ?? []) {
    const key = String(row['account_id']);
    byAccount.set(key, [...(byAccount.get(key) ?? []), row]);
  }
  return {
    accounts: accounts ?? [],
    events,
    checkpoints: byAccount,
    debts: debts ?? [],
    flows: {expenses: expenses ?? [], refunds: refunds ?? [], incomes: incomes ?? []},
  };
};

/** Units at the end of `asOf`, by replay. */
export const oracleBalance = (data: OracleData, account: Raw, asOf: string): number => {
  const id = String(account['id']);
  const openingDay = account['opening_date'] ? String(account['opening_date']) : null;
  const openingUnits = units(account['opening_balance']);
  const events = (data.events.get(id) ?? []).filter(e => e.day <= asOf);
  const checkpoints = (data.checkpoints.get(id) ?? []).filter(c => dayOf(c['date']) <= asOf);
  const days = [...new Set([...events.map(e => e.day), ...checkpoints.map(c => dayOf(c['date']))])].sort();
  let running = openingDay === null ? openingUnits : 0;
  let openingIn = openingDay === null;
  for (const day of days) {
    if (!openingIn && openingDay !== null && openingDay <= day) {
      running += openingUnits;
      openingIn = true;
    }
    running += events.filter(e => e.day === day).reduce((s, e) => s + e.units, 0);
    const last = checkpoints
      .filter(c => dayOf(c['date']) === day)
      .sort(
        (a, b) => Number(a['created_at']) - Number(b['created_at']) || String(a['id']).localeCompare(String(b['id'])),
      )
      .pop();
    if (last) {
      running = units(last['balance']);
    }
  }
  if (!openingIn && openingDay !== null && openingDay <= asOf) {
    running += openingUnits;
  }
  return running;
};

/** Units: every account's balance, less what is owed (borrowings), plus what is owed to you (lendings). */
export const oracleNetWorth = (data: OracleData, asOf: string): number =>
  data.accounts.reduce((sum, account) => sum + oracleBalance(data, account, asOf), 0) -
  data.debts
    .filter(d => dayOf(d['date']) <= asOf)
    .reduce((sum, d) => sum + (isBorrow(d['type']) ? 1 : -1) * units(d['amount']), 0);

/** Units: money in − (expenses − refunds) dated after `after` up to `upTo`. */
export const oracleKept = (data: OracleData, after: string, upTo: string): number => {
  const inRange = (rows: Raw[]) => rows.filter(r => dayOf(r['date']) > after && dayOf(r['date']) <= upTo);
  const sum = (rows: Raw[]) => rows.reduce((s, r) => s + units(r['amount']), 0);
  return sum(inRange(data.flows.incomes)) - sum(inRange(data.flows.expenses)) + sum(inRange(data.flows.refunds));
};
