/**
 * M19 (v2.7.1): edit screens read the row by id. A missing id is `null`
 * (deleted elsewhere), never an exception the screen would have to parse.
 */
import type {Database} from '@nozbe/watermelondb';

jest.mock('../src/watermelondb/database', () =>
  require('../src/testing/lokiDatabase').lokiDatabaseModule('recordByIdTest'),
);

// required after jest.mock so the mock applies; each cast names the module's own type
const {database} = require('../src/watermelondb/database') as {database: Database};
const services = require('../src/watermelondb/services') as typeof import('../src/watermelondb/services');

it('reads each kind of row by id, with the category joined, and null for a missing id', async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  const categoryId = await services.createCategory('Food', 'u1', 'pizza', '#111111');
  const expenseId = await services.createExpense('u1', 'Lunch', 12, '', categoryId, '2026-10-30T12:00:00');
  const debtId = await services.createDebt('u1', 5, 'loan', 'p1', '2026-10-30T12:00:00', 'Lend');

  const expense = await services.getExpenseById(expenseId);
  expect(expense?.title).toBe('Lunch');
  expect(expense?.category?.name).toBe('Food');
  expect((await services.getCategoryById(categoryId))?.name).toBe('Food');
  expect((await services.getDebtById(debtId))?.type).toBe('Lend');

  expect(await services.getExpenseById('nope')).toBeNull();
  expect(await services.getCategoryById('nope')).toBeNull();
  expect(await services.getDebtById('nope')).toBeNull();
});
