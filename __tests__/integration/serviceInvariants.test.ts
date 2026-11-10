/**
 * Every service enforces its own invariants, as incomeService and
 * refundService always did (audit 2026-11-08 §4.3, design P8). The forms
 * check first; these are the rules a caller that skips the form (a widget
 * replay, a future screen, a bug) still cannot break.
 */
import {database} from '../../src/data/database/database';
import {seedCategory} from '../harness/seedCategory';
import * as expenses from '../../src/data/services/expenseService';
import * as categories from '../../src/data/services/categoryService';
import * as budgets from '../../src/data/services/budgetService';
import * as incomes from '../../src/data/services/incomeService';

const DATE = '2026-11-05T10:00:00';

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  await seedCategory(database, 'food');
  await seedCategory(database, 'salary', {kind: 'income'});
  await seedCategory(database, 'theirs', {userId: 'u2'});
});

const rule = async (write: Promise<unknown>): Promise<string> => {
  try {
    await write;
  } catch (error) {
    return (error as {rule?: string}).rule ?? String(error); // every rule error carries `rule`
  }
  return 'accepted';
};

describe('expenses', () => {
  it('accepts an amount above zero in one of the user’s expense categories', async () => {
    expect(await rule(expenses.createExpense('u1', 'Tea', 20, '', 'food', DATE))).toBe('accepted');
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, 0.00001])('refuses the amount %p', async amount => {
    expect(await rule(expenses.createExpense('u1', 'Tea', amount, '', 'food', DATE))).toBe('amountNotPositive');
  });

  it('refuses an income category, another user’s category and one that does not exist', async () => {
    for (const categoryId of ['salary', 'theirs', 'nowhere', '']) {
      expect(await rule(expenses.createExpense('u1', 'Tea', 20, '', categoryId, DATE))).toBe('notAnExpenseCategory');
    }
  });

  it('applies the same rules to an edit, and lets an old row keep an archived category', async () => {
    const id = await expenses.createExpense('u1', 'Tea', 20, '', 'food', DATE);
    expect(await rule(expenses.updateExpenseById(id, 'salary'))).toBe('notAnExpenseCategory');
    expect(await rule(expenses.updateExpenseById(id, undefined, undefined, 0))).toBe('amountNotPositive');
    await categories.softDeleteCategoryById('food');
    // The form sends every field back, including the (now archived) category it already had.
    expect(await rule(expenses.updateExpenseById(id, 'food', 'Chai', 25))).toBe('accepted');
  });
});

describe('categories', () => {
  it('refuses a second active category of the same kind with the same name, ignoring case and spaces', async () => {
    expect(await rule(categories.createCategory('  FOOD ', 'u1', null, null, 'expense'))).toBe('duplicateName');
  });

  it('allows the name when the other one is archived, another kind or another user’s', async () => {
    await categories.softDeleteCategoryById('food');
    expect(await rule(categories.createCategory('food', 'u1', null, null, 'expense'))).toBe('accepted');
    expect(await rule(categories.createCategory('theirs', 'u1', null, null, 'expense'))).toBe('accepted');
  });

  it('refuses a rename onto another active name, and allows renaming a category to itself', async () => {
    const fuel = await categories.createCategory('Fuel', 'u1', null, null, 'expense');
    expect(await rule(categories.updateCategoryById(fuel, 'Food'))).toBe('duplicateName');
    expect(await rule(categories.updateCategoryById(fuel, 'fuel'))).toBe('accepted');
  });
});

describe('budgets', () => {
  it('refuses a budget that is not above zero (zero is how a month says "none", written by clear)', async () => {
    expect(await rule(budgets.upsertBudget('u1', 0, {kind: 'month', yearMonth: '2026-11'}))).toBe('amountNotPositive');
  });

  it('refuses a category budget on anything but one of the user’s expense categories', async () => {
    for (const categoryId of ['salary', 'theirs', 'nowhere']) {
      const scope = {budgetType: 'category', categoryId} as const;
      expect(await rule(budgets.upsertBudget('u1', 500, {kind: 'month', yearMonth: '2026-11'}, scope))).toBe(
        'notAnExpenseCategory',
      );
    }
    const food = {budgetType: 'category', categoryId: 'food'} as const;
    expect(await rule(budgets.upsertBudget('u1', 500, {kind: 'month', yearMonth: '2026-11'}, food))).toBe('accepted');
  });
});

describe('money in', () => {
  it('refuses another user’s income category', async () => {
    await seedCategory(database, 'their-salary', {userId: 'u2', kind: 'income'});
    const input = {categoryId: 'their-salary', amount: 100, date: '2026-11-05' as const, note: ''};
    expect(await rule(incomes.createIncome('u1', input))).toBe('notAnIncomeCategory');
  });
});
