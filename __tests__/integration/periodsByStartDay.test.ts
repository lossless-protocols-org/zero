/**
 * Plan P11's exit test: a month cut on the user's start day reads exactly the
 * rows dated in it. On the seed restored through the real import (expenses,
 * refunds, money in over five years), for start days 1, 7, 15 and 28:
 *
 * - every period's spent, refunded, received, kept and count equal a brute
 *   force over every row (no query, no index: the row's own date);
 * - the periods tile the data: every row is in exactly one, so the periods'
 *   totals add up to the whole;
 * - each row a period read returns belongs to that period by `periodKeyOf`,
 *   the rule the screens use to decide which month to refresh;
 * - the one-read month-and-day summary and the daily-allowance spend agree
 *   with the same brute force.
 *
 * Real LokiJS database.
 */
import type {ExportData} from '../../src/data/backup/export/format';
import {validateExportEnvelope} from '../../src/data/backup/export/validate';
import {upgradeExportData} from '../../src/data/backup/export/upgrader';
import {importAllData} from '../../src/data/services/importService';
import {deleteAllData} from '../../src/data/services/deleteService';
import {database} from '../../src/data/database/database';
import {getAllExpensesByMonth} from '../../src/data/services/expenseService';
import {getIncomesByMonth} from '../../src/data/services/incomeService';
import {getRefundRowsByMonth} from '../../src/data/services/refundService';
import {getAllowanceSpend, getMonthAndDaySummary, getMonthSummary} from '../../src/data/services/periodSummaryService';
import {toDayKey} from '../../src/domain/dates';
import {periodFor, periodHas, periodKeyOf, shiftPeriodKey, type Period} from '../../src/domain/period';
import {seedBackup} from '../harness/seed';

const START_DAYS = [1, 7, 15, 28];
const units = (amount: number) => Math.round(amount * 10_000);

interface Row {
  amount: number;
  date: string;
}

const loadSeed = (): ExportData => {
  const validation = validateExportEnvelope(seedBackup(1500));
  if (!validation.success || !validation.data) {
    throw new Error(validation.error ?? 'seed did not validate');
  }
  return upgradeExportData(validation.data);
};

describe('months cut on a start day', () => {
  jest.setTimeout(240_000);
  let userId = '';
  let expenses: Row[] = [];
  let refunds: Row[] = [];
  let incomes: Row[] = [];
  let firstKey = '';
  let lastKey = '';

  const raw = async (table: string): Promise<Row[]> =>
    ((await database.get(table).query().unsafeFetchRaw()) as Array<Record<string, unknown>>).map(row => ({
      amount: Number(row['amount']),
      date: String(row['date']),
    }));

  const inPeriod = (rows: Row[], period: Period) => rows.filter(row => periodHas(period, toDayKey(row.date)));
  const sum = (rows: Row[]) => rows.reduce((total, row) => total + units(row.amount), 0);

  /** Every key from the month before the first row to the month after the last: start day 28 reaches both. */
  const keys = (): string[] => {
    const all: string[] = [];
    for (let key = shiftPeriodKey(firstKey, -1); key <= shiftPeriodKey(lastKey, 1); key = shiftPeriodKey(key, 1)) {
      all.push(key);
    }
    return all;
  };

  beforeAll(async () => {
    await deleteAllData();
    ({userId} = await importAllData(loadSeed()));
    [expenses, refunds, incomes] = await Promise.all([raw('expenses'), raw('refunds'), raw('incomes')]);
    const days = [...expenses, ...refunds, ...incomes].map(row => toDayKey(row.date)).sort();
    firstKey = (days[0] ?? '').slice(0, 7);
    lastKey = (days.at(-1) ?? '').slice(0, 7);
    expect(expenses.length).toBe(1500);
    expect(refunds.length).toBeGreaterThan(20);
    expect(incomes.length).toBeGreaterThan(100);
  });

  it.each(START_DAYS)('start day %i: every period equals a brute force over every row', async startDay => {
    let spentUnits = 0;
    let receivedUnits = 0;
    let count = 0;
    for (const key of keys()) {
      const period = periodFor(key, startDay);
      const summary = await getMonthSummary(userId, period);
      const mine = {e: inPeriod(expenses, period), r: inPeriod(refunds, period), i: inPeriod(incomes, period)};
      expect({key, spent: units(summary.spent)}).toEqual({key, spent: sum(mine.e) - sum(mine.r)});
      expect({key, refunded: units(summary.refunded)}).toEqual({key, refunded: sum(mine.r)});
      expect({key, received: units(summary.received)}).toEqual({key, received: sum(mine.i)});
      expect({key, kept: units(summary.kept)}).toEqual({key, kept: sum(mine.i) - (sum(mine.e) - sum(mine.r))});
      expect({key, count: summary.count}).toEqual({key, count: mine.e.length});
      spentUnits += units(summary.spent);
      receivedUnits += units(summary.received);
      count += summary.count;
    }
    // The periods tile the data: nothing counted twice, nothing left out.
    expect(spentUnits).toBe(sum(expenses) - sum(refunds));
    expect(receivedUnits).toBe(sum(incomes));
    expect(count).toBe(expenses.length);
  });

  it.each(START_DAYS)('start day %i: the rows a period returns are the rows whose date names it', async startDay => {
    // The three busiest stretches are enough to show the lists and the key rule agree: the newest year.
    for (const key of keys().slice(-13)) {
      const period = periodFor(key, startDay);
      const [listed, listedRefunds, listedIncomes] = await Promise.all([
        getAllExpensesByMonth(userId, period),
        getRefundRowsByMonth(userId, period),
        getIncomesByMonth(userId, period),
      ]);
      expect(listed).toHaveLength(inPeriod(expenses, period).length);
      expect(listedRefunds).toHaveLength(inPeriod(refunds, period).length);
      expect(listedIncomes).toHaveLength(inPeriod(incomes, period).length);
      for (const row of [...listed, ...listedRefunds, ...listedIncomes]) {
        expect(periodKeyOf(row.date, startDay)).toBe(key);
      }
    }
  });

  it.each(START_DAYS)('start day %i: a day inside its period, and the allowance spend up to it', async startDay => {
    // The busiest day of the data, wherever it falls in its period.
    const byDay = new Map<string, number>();
    for (const row of expenses) {
      byDay.set(toDayKey(row.date), (byDay.get(toDayKey(row.date)) ?? 0) + 1);
    }
    const day = [...byDay].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
    const period = periodFor(periodKeyOf(day, startDay), startDay);
    const onDay = (rows: Row[]) => rows.filter(row => toDayKey(row.date) === day);
    const before = (rows: Row[]) => inPeriod(rows, period).filter(row => toDayKey(row.date) < day);

    const both = await getMonthAndDaySummary(userId, period, day);
    expect(both.month).toEqual(await getMonthSummary(userId, period));
    expect(units(both.day.spent)).toBe(sum(onDay(expenses)) - sum(onDay(refunds)));

    const allowance = await getAllowanceSpend(userId, period, day);
    const spentOnDay = Math.max(sum(onDay(expenses)) - sum(onDay(refunds)), 0);
    expect(units(allowance.spentOnDay)).toBe(spentOnDay);
    expect(units(allowance.spentBeforeDay)).toBe(
      sum(before(expenses)) - sum(before(refunds)) + (sum(onDay(expenses)) - sum(onDay(refunds)) - spentOnDay),
    );

    // A day outside the period is refused, never silently read as another month's.
    await expect(getMonthAndDaySummary(userId, period, period.next)).rejects.toThrow('is not in the period');
    await expect(getAllowanceSpend(userId, period, period.next)).rejects.toThrow('is not in the period');
  });
});
