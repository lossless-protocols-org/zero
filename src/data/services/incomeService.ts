import {Q} from '@nozbe/watermelondb';
import type {Clause} from '@nozbe/watermelondb/QueryDescription';
import {database} from '../database/database';
import {Income} from '../database/models/Income';
import {assertUserId} from './assertUserId';
import {resolveDefaultAccount} from './accountService';
import {isUsersCategoryOfKind} from './categoryKind';
import {monthDateClauses} from './expenseDateRange';
import {compareDateKeys, isIsoDay} from '../../domain/dates';
import {toMoneyUnits} from '../../domain/money';
import type {IncomeData, IsoDay} from '../../domain/types';

/**
 * Money in (schema v5): its own table, never mixed with expenses (R3, R11).
 * Entered from the Money tab, never from the expense plus. Day precision.
 */

export type IncomeRule = 'amountNotPositive' | 'notADay' | 'notAnIncomeCategory';

/**
 * A write refused because it would store an invalid income. The UI maps `rule` to copy.
 */
export class IncomeRuleError extends Error {
  readonly rule: IncomeRule;
  constructor(rule: IncomeRule) {
    super(`Income rule broken: ${rule}`);
    this.name = 'IncomeRuleError';
    this.rule = rule;
  }
}

/** An income row as SQLite holds it (column names; keep in step with v5Tables.ts). */
interface RawIncomeRow {
  id: string;
  user_id: string;
  category_id: string;
  account_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: number;
  updated_at: number;
}

const toIncomeData = (row: RawIncomeRow): IncomeData | null =>
  isIsoDay(row.date)
    ? {
        id: row.id,
        userId: row.user_id,
        categoryId: row.category_id,
        accountId: row.account_id,
        amount: row.amount,
        date: row.date,
        note: row.note ?? '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

// unsafeFetchRaw is typed any[]; the rows are v5Tables.ts's incomes table.
const fetchIncomeRows = (...clauses: Clause[]): Promise<RawIncomeRow[]> =>
  database
    .get<Income>('incomes')
    .query(...clauses)
    .unsafeFetchRaw();

const assertIncomeFields = async (
  userId: string,
  fields: {amount: number; date: string; categoryId: string},
): Promise<void> => {
  if (!Number.isFinite(fields.amount) || toMoneyUnits(fields.amount) <= 0) {
    throw new IncomeRuleError('amountNotPositive');
  }
  if (!isIsoDay(fields.date)) {
    throw new IncomeRuleError('notADay');
  }
  // The user's own income category: never another user's, never an expense one.
  if (!(await isUsersCategoryOfKind(userId, fields.categoryId, 'income'))) {
    throw new IncomeRuleError('notAnIncomeCategory');
  }
};

export const createIncome = async (
  userId: string,
  input: {categoryId: string; amount: number; date: IsoDay; note: string},
  /** A fixed id, as createExpense's: a replayed outside-the-app entry is saved once. */
  options: {id?: string} = {},
): Promise<string> => {
  assertUserId(userId, 'income');
  let id = '';
  await database.write(async () => {
    if (options.id && (await database.get<Income>('incomes').query(Q.where('id', options.id)).fetchCount()) > 0) {
      id = options.id;
      return;
    }
    await assertIncomeFields(userId, input);
    const {accountId, prepared} = await resolveDefaultAccount(userId);
    const income = database.get<Income>('incomes').prepareCreate(i => {
      i.userId = userId;
      i.categoryId = input.categoryId;
      i.accountId = accountId;
      i.amount = input.amount;
      i.date = input.date;
      i.note = input.note;
      if (options.id) {
        i._raw.id = options.id;
      }
    });
    await database.batch([...prepared, income]);
    id = income.id;
  });
  return id;
};

export const updateIncome = async (
  incomeId: string,
  patch: {categoryId?: string; amount?: number; date?: IsoDay; note?: string},
): Promise<void> => {
  await database.write(async () => {
    const income = await database.get<Income>('incomes').find(incomeId);
    await assertIncomeFields(income.userId, {
      amount: patch.amount ?? income.amount,
      date: patch.date ?? income.date,
      categoryId: patch.categoryId ?? income.categoryId,
    });
    await income.update(i => {
      if (patch.categoryId !== undefined) {
        i.categoryId = patch.categoryId;
      }
      if (patch.amount !== undefined) {
        i.amount = patch.amount;
      }
      if (patch.date !== undefined) {
        i.date = patch.date;
      }
      if (patch.note !== undefined) {
        i.note = patch.note;
      }
    });
  });
};

export const deleteIncome = async (incomeId: string): Promise<void> => {
  await database.write(async () => {
    const income = await database.get<Income>('incomes').find(incomeId);
    await income.destroyPermanently();
  });
};

/**
 * The month's incomes, newest day first, then newest entry first. An index
 * range on (user_id, date), like the expense month read.
 */
export const getIncomesByMonth = async (userId: string, yearMonth: string): Promise<IncomeData[]> => {
  const rows = await fetchIncomeRows(Q.where('user_id', userId), ...monthDateClauses(yearMonth));
  return rows
    .map(toIncomeData)
    .filter((income): income is IncomeData => income !== null)
    .sort((a, b) => compareDateKeys(a.date, b.date, -1) || b.createdAt - a.createdAt);
};

/**
 * "Same as last month": copies the incomes of `fromMonth` onto the 1st of
 * `toMonth`, keeping category, amount, account and note. Refuses (returns 0)
 * when `toMonth` already has incomes, so a double tap cannot double a salary.
 */
export const copyIncomesFromMonth = async (userId: string, fromMonth: string, toMonth: string): Promise<number> => {
  assertUserId(userId, 'income');
  const firstOfMonth = `${toMonth}-01`;
  if (!isIsoDay(firstOfMonth)) {
    throw new IncomeRuleError('notADay');
  }
  let copied = 0;
  await database.write(async () => {
    const existing = await fetchIncomeRows(Q.where('user_id', userId), ...monthDateClauses(toMonth));
    if (existing.length > 0) {
      return;
    }
    const source = await fetchIncomeRows(Q.where('user_id', userId), ...monthDateClauses(fromMonth));
    const copies = source.map(row =>
      database.get<Income>('incomes').prepareCreate(i => {
        i.userId = userId;
        i.categoryId = row.category_id;
        i.accountId = row.account_id;
        i.amount = row.amount;
        i.date = firstOfMonth;
        i.note = row.note ?? '';
      }),
    );
    await database.batch(copies);
    copied = copies.length;
  });
  return copied;
};

/** One income, or null when the id no longer exists (M19). */
export const getIncomeById = async (incomeId: string): Promise<IncomeData | null> => {
  const [row] = await fetchIncomeRows(Q.where('id', incomeId));
  return row ? toIncomeData(row) : null;
};
