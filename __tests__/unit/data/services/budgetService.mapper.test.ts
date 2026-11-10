/**
 * M16 (v2.7.1): budget rows reach the app with the month parsed and the scope
 * as a union — `categoryId` only on category budgets. Rows no screen can show
 * (an imported 'weekly', a category row without an id) are left out, as the
 * selectors already ignored them. LokiJS harness as in userRow.test.ts.
 */
import type {Budget as BudgetModel} from '../../../../src/data/database/models/Budget';
import {database} from '../../../../src/data/database/database';
import {seedCategory} from '../../../harness/seedCategory';
import * as budgets from '../../../../src/data/services/budgetService';

it('parses month keys and scopes, and leaves out rows no screen shows', async () => {
  await seedCategory(database, 'food');
  await budgets.upsertBudget('u1', 10000, {kind: 'recurring', start: '2026-07'});
  await budgets.upsertBudget(
    'u1',
    2000,
    {kind: 'month', yearMonth: '2026-10'},
    {budgetType: 'category', categoryId: 'food'},
  );
  await database.write(async () => {
    await database.get<BudgetModel>('budgets').create(b => {
      b.userId = 'u1';
      b.amount = 1;
      b.month = '2026-10';
      b.budgetType = 'weekly';
      b.categoryId = '';
    });
  });
  const rows = await budgets.getBudgetsByMonth('u1', '2026-10');
  const shapes = rows.map(({amount, monthKey, ...scope}) => ({
    amount,
    monthKey,
    ...scope,
    id: undefined,
    userId: undefined,
  }));
  expect(shapes).toEqual(
    expect.arrayContaining([
      {
        amount: 10000,
        monthKey: {kind: 'recurring', start: '2026-07'},
        budgetType: 'monthly',
        id: undefined,
        userId: undefined,
      },
      {
        amount: 2000,
        monthKey: {kind: 'month', yearMonth: '2026-10'},
        budgetType: 'category',
        categoryId: 'food',
        id: undefined,
        userId: undefined,
      },
    ]),
  );
  expect(rows).toHaveLength(2);
  const stored = await database.get<BudgetModel>('budgets').query().fetch();
  expect(stored.map(b => b.month).sort()).toEqual(['2026-10', '2026-10', 'recurring:2026-07']);
});
