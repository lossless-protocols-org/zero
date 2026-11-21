/**
 * Trends from the database (plan P12), on the seed restored through the real
 * import: each month of a trend equals the one-month summary every other
 * screen reads (so Trends can never disagree with Home or Reports), its
 * categories add up to its spending, and a refund lowers the month it is
 * dated in under its expense's category. For months cut on the 1st and on
 * the 7th. Real LokiJS database (the JS path; the SQL path is
 * __tests__/sqlite/trendSums.bun.test.ts).
 */
import type {ExportData} from '../../../../src/data/backup/export/format';
import {validateExportEnvelope} from '../../../../src/data/backup/export/validate';
import {upgradeExportData} from '../../../../src/data/backup/export/upgrader';
import {importAllData} from '../../../../src/data/services/importService';
import {deleteAllData} from '../../../../src/data/services/deleteService';
import {getMonthSummary} from '../../../../src/data/services/periodSummaryService';
import {getTrends} from '../../../../src/data/services/trendsService';
import {createRefund} from '../../../../src/data/services/refundService';
import {periodFor, periodKeyOf} from '../../../../src/domain/period';
import {trendMonths} from '../../../../src/domain/trends';
import * as services from '../../../harness/services';
import {seedBackup, SEED_ANCHOR} from '../../../harness/seed';

const units = (amount: number) => Math.round(amount * 10_000);

describe('on the seed', () => {
  jest.setTimeout(120_000);
  let userId = '';

  beforeAll(async () => {
    await deleteAllData();
    const validation = validateExportEnvelope(seedBackup(1500));
    if (!validation.success || !validation.data) {
      throw new Error(validation.error ?? 'seed did not validate');
    }
    const data: ExportData = upgradeExportData(validation.data);
    ({userId} = await importAllData(data));
  });

  it.each([
    [12, 1],
    [6, 7],
    [3, 28],
  ])('%i months from day %i: each month equals its own summary, and its categories add up', async (count, day) => {
    const months = trendMonths(periodKeyOf(SEED_ANCHOR, day), count, day);
    const trend = await getTrends(userId, months);
    expect(trend.map(point => point.key)).toEqual(months.map(month => month.key));
    let rows = 0;
    for (const point of trend) {
      const summary = await getMonthSummary(userId, point.period);
      expect({key: point.key, ...summary}).toEqual({
        key: point.key,
        spent: point.spent,
        refunded: point.refunded,
        received: point.received,
        kept: point.kept,
        count: point.count,
      });
      const categories = Object.values(point.byCategory).reduce((sum, amount) => sum + units(amount), 0);
      expect({key: point.key, categories}).toEqual({key: point.key, categories: units(point.spent)});
      rows += point.count;
    }
    expect(rows).toBeGreaterThan(0);
  });

  it('no months is no trend, and months that do not touch are refused', async () => {
    await expect(getTrends(userId, [])).resolves.toEqual([]);
    const gap = [
      {key: '2026-08', period: periodFor('2026-08')},
      {key: '2026-10', period: periodFor('2026-10')},
    ];
    await expect(getTrends(userId, gap)).rejects.toThrow('must be in order and touch');
  });
});

describe('refunds', () => {
  it('lower the month they are dated in, under the category of their expense, whenever that was', async () => {
    await deleteAllData();
    const userId = await services.createUser('Ravi', '');
    await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
    const shoes = await services.createCategory('Shoes', userId, 'pizza', '#111111', 'expense');
    const food = await services.createCategory('Food', userId, 'pizza', '#222222', 'expense');
    const bought = await services.createExpense(userId, 'Boots', 4000, '', shoes, '2026-08-20T10:00:00');
    await services.createExpense(userId, 'Lunch', 300, '', food, '2026-11-03T13:00:00');
    await createRefund(bought, {amount: 1500, date: '2026-11-05T09:00:00', note: ''});

    const [october, november] = await getTrends(userId, trendMonths('2026-11', 2, 1));
    expect(october).toMatchObject({spent: 0, count: 0, byCategory: {}});
    // The boots were August's; the money that came back is November's, under Shoes.
    expect(november).toMatchObject({
      spent: -1200,
      refunded: 1500,
      count: 1,
      byCategory: {[shoes]: -1500, [food]: 300},
    });
  });
});
