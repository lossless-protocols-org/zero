/**
 * The widget publisher end to end (2.8 Phase 3): real schema and services on
 * the LokiJS harness, the native module mocked. What the widget shows must be
 * the same figures the app shows: net of refunds (R2) for this month and
 * today, the overall budget in force, money in, and nothing at all when the
 * owner hides amounts.
 *
 * Tickets: audit 2026-11-08 §8.1.
 */
import type {WidgetSnapshot} from '../../../../src/features/widgets/snapshot';
import * as services from '../../../harness/services';
import {createRefund} from '../../../../src/data/services/refundService';
import {createIncome} from '../../../../src/data/services/incomeService';
import {publishWidgetSnapshot, startWidgetPublisher} from '../../../../src/features/widgets/publish';
import * as summaries from '../../../../src/data/services/periodSummaryService';
import {markTimeToInteractive} from '../../../../src/platform/startupMarker';
import {getQuickCategories} from '../../../../src/data/services/categoryService';
import {widgetAmountsPreference} from '../../../../src/platform/widgetPreferences';
import {formatAmountWithSymbol} from '../../../../src/platform/numberFormat';

const mockWriteSnapshot = jest.fn<void, [string]>();
jest.mock('../../../../src/native/specs/NativeWidgetBridge', () => ({
  __esModule: true,
  default: {
    // Read at call time: imports are hoisted above this file's const, so the factory runs first.
    writeSnapshot: (json: string) => mockWriteSnapshot(json),
  },
}));

const NOW = new Date(2026, 10, 6, 12, 0, 0); // 6 Nov 2026, local
const inr = (amount: number): string => formatAmountWithSymbol(amount, 'INR');

const lastSnapshot = (): WidgetSnapshot => {
  const call = mockWriteSnapshot.mock.calls.at(-1);
  if (!call) {
    throw new Error('nothing written');
  }
  return JSON.parse(call[0]) as WidgetSnapshot; // the publisher's own JSON.stringify of a WidgetSnapshot
};

beforeEach(async () => {
  mockWriteSnapshot.mockClear();
  widgetAmountsPreference.set(true);
  await services.deleteAllData();
});

it('writes the "open zero" state before onboarding', async () => {
  await publishWidgetSnapshot(NOW);
  expect(lastSnapshot()).toMatchObject({state: 'setup', v: 1});
});

describe('quick-add categories', () => {
  it('most used in the last 90 days first, ties in the user order, deleted ones never', async () => {
    const userId = await services.createUser('Ravi', '');
    await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
    await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
    const fuel = await services.createCategory('Fuel', userId, 'car', '#222222', 'expense');
    const rent = await services.createCategory('Rent', userId, 'home', '#333333', 'expense');
    const gone = await services.createCategory('Gone', userId, 'x', '#444444', 'expense');
    await services.createExpense(userId, 'Fill', 900, '', fuel, '2026-11-01T10:00:00');
    await services.createExpense(userId, 'Fill', 900, '', fuel, '2026-10-20T10:00:00');
    await services.createExpense(userId, 'Old rent', 9000, '', rent, '2026-06-01T10:00:00'); // outside 90 days
    await services.createExpense(userId, 'Thing', 10, '', gone, '2026-11-02T10:00:00');
    await services.softDeleteCategoryById(gone);
    const order = (await getQuickCategories(userId, NOW)).map(c => c.name);
    expect(order).toEqual(['Fuel', 'Food', 'Rent']);
  });
});

describe('with a user', () => {
  const seed = async () => {
    const userId = await services.createUser('Ravi', '');
    await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
    const food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
    const income = `inc_${userId}`; // createUser seeds it
    await services.createExpense(userId, 'Groceries', 3000, '', food, '2026-11-02T10:00:00');
    const shoes = await services.createExpense(userId, 'Shoes', 2000, '', food, '2026-11-06T09:00:00');
    await services.createExpense(userId, 'Last month', 999, '', food, '2026-10-31T21:00:00');
    await createRefund(shoes, {amount: 500, date: '2026-11-06T11:00:00', note: ''});
    await createIncome(userId, {categoryId: income, amount: 40_000, date: '2026-11-01', note: ''});
    await services.upsertBudget(userId, 4000, {kind: 'month', yearMonth: '2026-11'});
    return userId;
  };

  it('shows this month and today net of refunds, the budget and money in', async () => {
    await seed();
    await publishWidgetSnapshot(NOW);
    const s = lastSnapshot();
    expect(s).toMatchObject({
      state: 'ready',
      monthKey: '2026-11',
      todayKey: '2026-11-06',
      monthLabel: 'November',
      spentMonth: inr(4500), // 3000 + 2000 − 500; October's 999 is not this month
      spentToday: inr(1500),
      zero: inr(0),
      budget: {progress: 1, over: true, text: `${inr(500)} over budget`},
    });
    expect(s.incomeLine).toContain(inr(40_000));
    expect(s.incomeLine).toContain(inr(35_500));
    expect(s.labels).toMatchObject({today: 'Today', addExpense: 'Add expense', addIncome: 'Money in'});
    expect(s.quick.map(c => c.name)).toEqual(['Food']);
  });

  it('reads the month and today in one pass, equal to reading them apart', async () => {
    const userId = await seed();
    const both = await summaries.getMonthAndDaySummary(userId, '2026-11', '2026-11-06');
    expect(both.month).toEqual(await summaries.getMonthSummary(userId, '2026-11'));
    expect(both.day).toEqual(await summaries.getDaySummary(userId, '2026-11-06'));
    await expect(summaries.getMonthAndDaySummary(userId, '2026-11', '2026-10-31')).rejects.toThrow('not in month');
  });

  it('offers "add again" from this month and last, entered twice, in active categories only', async () => {
    const userId = await seed();
    const [food] = (await services.getAllCategoriesByUserId(userId, 'expense')).filter(c => c.name === 'Food');
    const foodId = String(food?.id);
    await services.createExpense(userId, 'Chai', 20, '', foodId, '2026-10-20T08:00:00');
    await services.createExpense(userId, 'Chai', 20, '', foodId, '2026-11-05T08:00:00');
    await services.createExpense(userId, 'Bus', 15, '', foodId, '2026-11-04T08:00:00'); // once: not offered
    await services.createExpense(userId, 'Paper', 5, '', foodId, '2026-09-10T08:00:00'); // before last month
    await services.createExpense(userId, 'Paper', 5, '', foodId, '2026-09-11T08:00:00');
    await publishWidgetSnapshot(NOW);
    const s = lastSnapshot();
    expect(s.again.map(a => a.title)).toEqual(['Chai']);
    expect(s.last?.title).toBe('Shoes'); // the latest expense, 6 Nov
  });

  it('with amounts hidden, the JSON handed to the widget holds no amount', async () => {
    await seed();
    widgetAmountsPreference.set(false);
    await publishWidgetSnapshot(NOW);
    const s = lastSnapshot();
    expect([s.spentMonth, s.spentToday, s.budget]).toEqual(['••••', '••••', null]);
    const stored = JSON.stringify({...s, preview: null});
    for (const amount of [4500, 1500, 500, 40_000, 35_500, 4000]) {
      expect({amount, stored: stored.includes(inr(amount))}).toEqual({amount, stored: false});
    }
  });
});

describe('publishing schedule', () => {
  beforeEach(() => jest.useFakeTimers({doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask']}));
  afterEach(() => jest.useRealTimers());

  const settle = async (ms: number) => {
    await jest.advanceTimersByTimeAsync(ms);
  };

  it("waits for first content, then publishes; the table watches' first emission is no change", async () => {
    const userId = await services.createUser('Ravi', '');
    await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
    mockWriteSnapshot.mockClear();
    const stop = startWidgetPublisher();
    try {
      await settle(1000);
      expect(mockWriteSnapshot).not.toHaveBeenCalled(); // not at start-up + 500 ms any more
      // A write before first content schedules nothing either.
      await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
      await settle(1000);
      expect(mockWriteSnapshot).not.toHaveBeenCalled();
      markTimeToInteractive();
      await settle(1000); // idle, then the debounce
      expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);
      // Later writes publish through the table watch, debounced.
      await services.createCategory('Fuel', userId, 'car', '#222222', 'expense');
      await settle(1000);
      expect(mockWriteSnapshot).toHaveBeenCalledTimes(2);
    } finally {
      stop();
    }
  });
});
