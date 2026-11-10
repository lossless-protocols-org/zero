/**
 * Schema v5 (2.8 Phase 1): the flow tables and their invariants, run against
 * the real schema, migrations and services on the LokiJS harness
 * (src/testing/lokiDatabase.ts). ZERO_SYSTEM_DESIGN.md §5 is the rulebook:
 * R1 positive amounts, R2 spent nets refunds in the refund's month, R3
 * refunds are not income, R4 kept = received − spent, R5 typed categories,
 * R12 a refund only exists for its expense.
 *
 * Tickets: R11.
 */
import type {Account, Category, Expense} from '../../src/data/database/models';
import {database} from '../../src/data/database/database';
import * as services from '../harness/services';
import * as refunds from '../../src/data/services/refundService';
import * as incomes from '../../src/data/services/incomeService';
import * as summary from '../../src/data/services/periodSummaryService';
import {store} from '../../src/store/store';
import {fetchUserData, selectUserId} from '../../src/store/slices/userIdSlice';
import * as categoryService from '../../src/data/services/categoryService';
import * as slice from '../../src/store/slices/expenseDataSlice';

const {RefundRuleError} = refunds;
const {IncomeRuleError} = incomes;
type RefundRule = import('../../src/data/services/refundService').RefundRule;
type IncomeRule = import('../../src/data/services/incomeService').IncomeRule;

const accountsOf = async (userId: string): Promise<Account[]> =>
  (await database.get<Account>('accounts').query().fetch()).filter(a => a.userId === userId);

const expenseRow = (id: string): Promise<Expense> => database.get<Expense>('expenses').find(id);

/** A user with a currency, one expense category and one income category. */
const setUp = async () => {
  await services.deleteAllData();
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  const shopping = await services.createCategory('Shopping', userId, 'bag', '#222222', 'expense');
  // createUser seeds the income category (defaultIncomeCategory.ts).
  const income = `inc_${userId}`;
  return {userId, food, shopping, income};
};

describe('accounts (v5)', () => {
  it('a new user gets exactly one default account, id acct_<userId>, carrying the currency onboarding picks', async () => {
    const {userId} = await setUp();
    const accounts = await accountsOf(userId);
    expect(accounts.map(a => [a.id, a.name, a.type, a.isDefault, a.currency])).toEqual([
      [`acct_${userId}`, 'Cash', 'cash', true, 'INR'],
    ]);
  });

  it('changing the currency relabels the account too (2.8 is single-currency)', async () => {
    const {userId} = await setUp();
    const currency = await services.getCurrencyByUserId(userId);
    await services.updateCurrencyById(currency?.id ?? '', {code: 'USD', symbol: '$', name: 'US Dollar'});
    expect((await accountsOf(userId)).map(a => a.currency)).toEqual(['USD']);
  });

  it('every expense is recorded on the default account; a missing one is recreated rather than failing the entry', async () => {
    const {userId, food} = await setUp();
    const first = await services.createExpense(userId, 'Chai', 20, '', food, '2026-11-03T08:30:00');
    expect((await expenseRow(first)).accountId).toBe(`acct_${userId}`);

    await database.write(async () => {
      await database.batch((await accountsOf(userId)).map(a => a.prepareDestroyPermanently()));
    });
    const second = await services.createExpense(userId, 'Lunch', 120, '', food, '2026-11-03T13:00:00');
    expect((await expenseRow(second)).accountId).toBe(`acct_${userId}`);
    expect(await accountsOf(userId)).toHaveLength(1);
  });

  it('timestamps are maintained on create and touched on update', async () => {
    const {userId, food} = await setUp();
    const id = await services.createExpense(userId, 'Chai', 20, '', food, '2026-11-03T08:30:00');
    const created = await expenseRow(id);
    expect(created.createdAt.getTime()).toBeGreaterThan(0);
    const before = created.updatedAt.getTime();
    await new Promise<void>(resolve => {
      setTimeout(resolve, 5);
    });
    await services.updateExpenseById(id, undefined, 'Masala chai');
    expect((await expenseRow(id)).updatedAt.getTime()).toBeGreaterThan(before);
  });
});

describe('refunds', () => {
  it('records partial refunds up to the expense, on the expense account, listed oldest first', async () => {
    const {userId, shopping} = await setUp();
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    await refunds.createRefund(shoes, {amount: 1000, date: '2026-11-25T10:00:00', note: 'second'});
    await refunds.createRefund(shoes, {amount: 2000, date: '2026-11-20T12:00:00', note: 'size'});
    const list = await refunds.getRefundsByExpense(shoes);
    expect(list.map(r => [r.amount, r.note, r.accountId])).toEqual([
      [2000, 'size', `acct_${userId}`],
      [1000, 'second', `acct_${userId}`],
    ]);
  });

  it.each<[string, {amount: number; date: string}, RefundRule]>([
    ['more in total than the expense', {amount: 3000.01, date: '2026-11-20T12:00:00'}, 'exceedsExpense'],
    ['on a day before the expense', {amount: 10, date: '2026-11-09T23:59:59'}, 'beforeExpense'],
    ['of zero', {amount: 0, date: '2026-11-20T12:00:00'}, 'amountNotPositive'],
    ['negative', {amount: -5, date: '2026-11-20T12:00:00'}, 'amountNotPositive'],
  ])('refuses a refund %s', async (_label, input, rule) => {
    const {userId, shopping} = await setUp();
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    const attempt = refunds.createRefund(shoes, {...input, note: ''});
    await expect(attempt).rejects.toBeInstanceOf(RefundRuleError);
    await expect(attempt).rejects.toMatchObject({rule});
    expect(await refunds.getRefundsByExpense(shoes)).toEqual([]);
  });

  it('allows a refund on the same day as the expense, earlier in the day (days are compared, not times)', async () => {
    const {userId, shopping} = await setUp();
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    await expect(refunds.createRefund(shoes, {amount: 5, date: '2026-11-10T09:00:00', note: ''})).resolves.toEqual(
      expect.any(String),
    );
  });

  it('compares money exactly: 0.1 + 0.2 of refunds fit a 0.3 expense', async () => {
    const {userId, shopping} = await setUp();
    const tiny = await services.createExpense(userId, 'Tiny', 0.3, '', shopping, '2026-11-10T18:05:00');
    await refunds.createRefund(tiny, {amount: 0.1, date: '2026-11-11T00:00:00', note: ''});
    await expect(refunds.createRefund(tiny, {amount: 0.2, date: '2026-11-11T00:00:00', note: ''})).resolves.toEqual(
      expect.any(String),
    );
  });

  it('an edit of a refund is checked against the others, not against itself', async () => {
    const {userId, shopping} = await setUp();
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    const a = await refunds.createRefund(shoes, {amount: 1000, date: '2026-11-20T12:00:00', note: ''});
    await refunds.createRefund(shoes, {amount: 1000, date: '2026-11-21T12:00:00', note: ''});
    await refunds.updateRefund(a, {amount: 2000});
    await expect(refunds.updateRefund(a, {amount: 2000.5})).rejects.toMatchObject({rule: 'exceedsExpense'});
    await refunds.deleteRefund(a);
    expect((await refunds.getRefundsByExpense(shoes)).map(r => r.amount)).toEqual([1000]);
  });

  it('an expense cannot be edited below what was refunded, or moved after a refund', async () => {
    const {userId, shopping} = await setUp();
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    await refunds.createRefund(shoes, {amount: 1200, date: '2026-11-20T12:00:00', note: ''});
    await expect(services.updateExpenseById(shoes, undefined, undefined, 1199)).rejects.toMatchObject({
      rule: 'expenseBelowRefunds',
    });
    await expect(
      services.updateExpenseById(shoes, undefined, undefined, undefined, undefined, '2026-11-21T00:00:00'),
    ).rejects.toMatchObject({rule: 'expenseAfterRefund'});
    await services.updateExpenseById(shoes, undefined, undefined, 1200);
    expect((await expenseRow(shoes)).amount).toBe(1200);
  });

  it('deleting an expense deletes its refunds in the same batch, and nobody else’s', async () => {
    const {userId, shopping} = await setUp();
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    const bag = await services.createExpense(userId, 'Bag', 900, '', shopping, '2026-11-11T18:05:00');
    await refunds.createRefund(shoes, {amount: 1200, date: '2026-11-20T12:00:00', note: ''});
    await refunds.createRefund(bag, {amount: 100, date: '2026-11-20T12:00:00', note: ''});
    await services.deleteExpenseById(shoes);
    expect(await database.get('refunds').query().fetchCount()).toBe(1);
    expect(await refunds.getRefundsByExpense(bag)).toHaveLength(1);
  });
});

describe('incomes', () => {
  it('records an income on an income category and the default account', async () => {
    const {userId, income} = await setUp();
    await incomes.createIncome(userId, {categoryId: income, amount: 50000, date: '2026-11-07', note: 'Salary'});
    const [row] = await incomes.getIncomesByMonth(userId, '2026-11');
    expect(row).toMatchObject({amount: 50000, date: '2026-11-07', note: 'Salary', accountId: `acct_${userId}`});
  });

  it.each<[string, 'food' | 'income', {amount: number; date: string}, IncomeRule]>([
    ['an expense category', 'food', {amount: 1, date: '2026-11-07'}, 'notAnIncomeCategory'],
    ['a time of day', 'income', {amount: 1, date: '2026-11-07T09:00:00'}, 'notADay'],
    ['a zero amount', 'income', {amount: 0, date: '2026-11-07'}, 'amountNotPositive'],
  ])('refuses %s', async (_label, which, input, rule) => {
    const ids = await setUp();
    const categoryId = which === 'food' ? ids.food : ids.income;
    // the third row's date deliberately is not an IsoDay; the service must refuse it at runtime
    const date = input.date as `${number}-${number}-${number}`;
    const attempt = incomes.createIncome(ids.userId, {categoryId, amount: input.amount, date, note: ''});
    await expect(attempt).rejects.toBeInstanceOf(IncomeRuleError);
    await expect(attempt).rejects.toMatchObject({rule});
  });

  it('lists the month newest day first; "same as last month" copies onto the 1st, once', async () => {
    const {userId, income} = await setUp();
    await incomes.createIncome(userId, {categoryId: income, amount: 3000, date: '2026-10-14', note: 'logo'});
    await incomes.createIncome(userId, {categoryId: income, amount: 50000, date: '2026-10-07', note: 'Salary'});
    expect((await incomes.getIncomesByMonth(userId, '2026-10')).map(i => i.date)).toEqual(['2026-10-14', '2026-10-07']);

    expect(await incomes.copyIncomesFromMonth(userId, '2026-10', '2026-11')).toBe(2);
    expect(await incomes.copyIncomesFromMonth(userId, '2026-10', '2026-11')).toBe(0);
    const november = await incomes.getIncomesByMonth(userId, '2026-11');
    expect(november.map(i => [i.date, i.amount, i.note]).sort()).toEqual([
      ['2026-11-01', 3000, 'logo'],
      ['2026-11-01', 50000, 'Salary'],
    ]);
  });

  it('edits and deletes', async () => {
    const {userId, income} = await setUp();
    const id = await incomes.createIncome(userId, {categoryId: income, amount: 100, date: '2026-11-07', note: ''});
    await incomes.updateIncome(id, {amount: 150, note: 'bonus'});
    expect((await incomes.getIncomesByMonth(userId, '2026-11'))[0]).toMatchObject({amount: 150, note: 'bonus'});
    await expect(incomes.updateIncome(id, {amount: -1})).rejects.toMatchObject({rule: 'amountNotPositive'});
    await incomes.deleteIncome(id);
    expect(await incomes.getIncomesByMonth(userId, '2026-11')).toEqual([]);
  });
});

describe('period summary: the seam', () => {
  it('nets refunds in the month the money came back, never counts them as income, and keeps = received − spent', async () => {
    const {userId, food, shopping, income} = await setUp();
    await services.createExpense(userId, 'Chai', 20, '', food, '2026-11-03T08:30:00');
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    await services.createExpense(userId, 'Groceries', 2400, '', food, '2026-11-05T19:00:00');
    await refunds.createRefund(shoes, {amount: 1200, date: '2026-11-20T12:00:00', note: ''});
    // An October purchase refunded in November lowers November, not October.
    const coat = await services.createExpense(userId, 'Coat', 5000, '', shopping, '2026-10-28T10:00:00');
    await refunds.createRefund(coat, {amount: 500, date: '2026-11-02T10:00:00', note: ''});
    await incomes.createIncome(userId, {categoryId: income, amount: 50000, date: '2026-11-07', note: 'Salary'});
    await incomes.createIncome(userId, {categoryId: income, amount: 8000, date: '2026-11-26', note: ''});

    expect(await summary.getMonthSummary(userId, '2026-11')).toEqual({
      spent: 20 + 3000 + 2400 - 1200 - 500,
      refunded: 1700,
      received: 58000,
      kept: 58000 - 3720,
      count: 3,
    });
    expect(await summary.getMonthSummary(userId, '2026-10')).toEqual({
      spent: 5000,
      refunded: 0,
      received: 0,
      kept: -5000,
      count: 1,
    });
    expect(await summary.getDaySummary(userId, '2026-11-20')).toEqual({
      spent: -1200,
      refunded: 1200,
      received: 0,
      kept: 1200,
      count: 0,
    });
  });

  it('adds money exactly (no 0.30000000000000004)', async () => {
    const {userId, food} = await setUp();
    await services.createExpense(userId, 'a', 0.1, '', food, '2026-11-03T08:30:00');
    await services.createExpense(userId, 'b', 0.2, '', food, '2026-11-03T08:31:00');
    expect((await summary.getMonthSummary(userId, '2026-11')).spent).toBe(0.3);
  });
});

describe('categories are typed', () => {
  it('lists one kind at a time, in sort order; a name taken by income may still be an expense', async () => {
    const {userId} = await setUp();
    await services.createCategory('Income', userId, 'gift', '#444444', 'expense');
    const expense = await services.getAllCategoriesByUserId(userId, 'expense');
    const income = await services.getAllCategoriesByUserId(userId, 'income');
    expect(expense.map(c => [c.name, c.sortOrder])).toEqual([
      ['Food', 10],
      ['Shopping', 20],
      ['Income', 30],
    ]);
    expect(income.map(c => [c.name, c.kind, c.sortOrder])).toEqual([['Income', 'income', 10]]);
  });

  it('Free refuses a second income category (domain/freeTier), archived ones counted', async () => {
    const {userId} = await setUp();
    const refusal = services.createCategory('Bonus', userId, null, null, 'income');
    // The rule error, by its rule (categoryService is loaded further down this file).
    await expect(refusal).rejects.toMatchObject({name: 'CategoryRuleError', rule: 'incomeCategoryLimit'});
    expect(await services.getAllCategoriesByUserId(userId, 'income')).toHaveLength(1);
  });
});

describe('wipe and counts cover the v5 tables', () => {
  it('counts and deletes accounts, refunds and incomes with everything else', async () => {
    const {userId, shopping, income} = await setUp();
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    await refunds.createRefund(shoes, {amount: 1, date: '2026-11-20T12:00:00', note: ''});
    await incomes.createIncome(userId, {categoryId: income, amount: 1, date: '2026-11-07', note: ''});
    expect(await services.countAllRecords()).toMatchObject({accounts: 1, refunds: 1, incomes: 1, expenses: 1});
    await services.deleteAllData();
    expect((await services.countAllRecords()).total).toBe(0);
  });
});

describe('2.8 Phase 2: what the screens read', () => {
  it('lists refunds dated in a month, day or category with their expense’s title and category, and totals per expense', async () => {
    const {userId, food, shopping} = await setUp();
    const coat = await services.createExpense(userId, 'Coat', 5000, '', shopping, '2026-10-28T10:00:00');
    const chai = await services.createExpense(userId, 'Chai', 20, '', food, '2026-11-03T08:30:00');
    await refunds.createRefund(coat, {amount: 500, date: '2026-11-02T10:00:00', note: 'tag'});
    await refunds.createRefund(coat, {amount: 100, date: '2026-12-01T10:00:00', note: ''});
    await refunds.createRefund(chai, {amount: 5, date: '2026-11-03T09:00:00', note: ''});

    const november = await refunds.getRefundRowsByMonth(userId, '2026-11');
    expect(november.map(r => [r.title, r.amount, r.category?.name]).sort()).toEqual([
      ['Chai', 5, 'Food'],
      ['Coat', 500, 'Shopping'],
    ]);
    expect((await refunds.getRefundRowsByDate(userId, '2026-11-03')).map(r => r.title)).toEqual(['Chai']);
    expect(
      (await refunds.getRefundRowsByCategoryAndMonth(userId, shopping, '2026-11')).map(r => [r.title, r.note]),
    ).toEqual([['Coat', 'tag']]);
    // The badge counts every refund of the expense, whatever month it came back in.
    // The coat is October's: November's badges are the chai's only, October's the coat's whole 600.
    expect(await refunds.getRefundedAmountsByMonth(userId, '2026-11')).toEqual({[chai]: 5});
    expect(await refunds.getRefundedAmountsByMonth(userId, '2026-10')).toEqual({[coat]: 600});
    expect(await refunds.getRefundedAmountsByDate(userId, '2026-11-03')).toEqual({[chai]: 5});
    expect(await refunds.getRefundedAmountsByCategoryAndMonth(userId, food, '2026-10')).toEqual({});
    expect(await refunds.getRefundedAmountsByCategoryAndMonth(userId, shopping, '2026-10')).toEqual({[coat]: 600});
    expect(await refunds.getRefundedAmountsByMonth(userId, '2026-09')).toEqual({});
  });

  it('a new user has exactly one Income category from the start; the repair finds nothing to do', async () => {
    const fresh = await services.createUser('Asha', '');
    expect((await services.getAllCategoriesByUserId(fresh, 'income')).map(c => [c.id, c.name, c.icon])).toEqual([
      [`inc_${fresh}`, 'Income', 'coins'],
    ]);
    // Twice at once: the check and the write are one writer, so neither seeds a second.
    expect(
      await Promise.all([categoryService.ensureIncomeCategory(fresh), categoryService.ensureIncomeCategory(fresh)]),
    ).toEqual([false, false]);
    expect(await services.getAllCategoriesByUserId(fresh, 'income')).toHaveLength(1);
    await expect(services.softDeleteCategoryById(`inc_${fresh}`)).rejects.toBeInstanceOf(
      categoryService.CategoryRuleError,
    );
  });

  it('the repair restores a missing or archived-only income category, and says it had to', async () => {
    const fresh = await services.createUser('Asha', '');
    const category = await database.get<Category>('categories').find(`inc_${fresh}`);
    await database.write(async () => {
      await category.update(c => {
        c.categoryStatus = false;
      });
    });
    expect(await categoryService.ensureIncomeCategory(fresh)).toBe(true);
    expect((await services.getAllCategoriesByUserId(fresh, 'income')).map(c => c.categoryStatus)).toEqual([true]);

    await database.write(async () => {
      await (await database.get('categories').find(`inc_${fresh}`)).destroyPermanently();
    });
    expect(await categoryService.ensureIncomeCategory(fresh)).toBe(true);
    expect((await services.getAllCategoriesByUserId(fresh, 'income')).map(c => c.name)).toEqual(['Income']);
  });

  it('stores a new order for one kind and refuses a partial order', async () => {
    const {userId, food, shopping} = await setUp();
    const fuel = await services.createCategory('Fuel', userId, null, null, 'expense');
    await categoryService.reorderCategories(userId, 'expense', [fuel, food, shopping]);
    expect((await services.getAllCategoriesByUserId(userId, 'expense')).map(c => c.name)).toEqual([
      'Fuel',
      'Food',
      'Shopping',
    ]);
    await expect(categoryService.reorderCategories(userId, 'expense', [fuel, food])).rejects.toThrow();
  });

  it('the month thunk carries the month’s refunds and badges, and Home’s totals net them', async () => {
    const {userId, shopping} = await setUp();
    await store.dispatch(fetchUserData());
    expect(selectUserId(store.getState())).toBe(userId);
    const shoes = await services.createExpense(userId, 'Shoes', 3000, '', shopping, '2026-11-10T18:05:00');
    await refunds.createRefund(shoes, {amount: 1200, date: '2026-11-20T12:00:00', note: ''});
    await store.dispatch(slice.fetchExpensesByMonth('2026-11'));
    const state = store.getState();
    expect(slice.selectMonthRefunds(state, '2026-11').map(r => r.amount)).toEqual([1200]);
    expect(slice.selectRefundedByExpense(state, '2026-11')).toEqual({[shoes]: 1200});
    expect(slice.selectMonthTotals(state, '2026-11', '2026-11-20')).toEqual({
      total: 1800,
      count: 1,
      today: -1200,
      refunded: 1200,
    });
    expect(
      slice
        .selectMonthSpendRows(state, '2026-11')
        .map(r => r.amount)
        .sort(),
    ).toEqual([-1200, 3000]);
  });
});
