/**
 * M22 (v2.7.1): expense reads, tested on a real (LokiJS) database instead of
 * the service's source text.
 */
import {database} from '../../../../src/data/database/database';
import * as services from '../../../harness/services';
import {Query} from '@nozbe/watermelondb';

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

it('still names the category of an expense whose category was soft-deleted', async () => {
  const categoryId = await services.createCategory('Fuel', 'u1', 'car', '#123456', 'expense');
  await services.createExpense('u1', 'Petrol', 900, '', categoryId, '2026-10-05T10:00:00');
  await services.softDeleteCategoryById(categoryId);
  const [expense] = await services.getAllExpensesByMonth('u1', '2026-10');
  expect(expense?.category?.name).toBe('Fuel');
});

it('returns an expense whose category row is gone, with no category, rather than failing', async () => {
  // The services no longer write such a row; an old database or a sync can still hold one.
  const categoryId = await services.createCategory('Gone', 'u1', null, null, 'expense');
  await services.createExpense('u1', 'Orphan', 5, '', categoryId, '2026-10-05T10:00:00');
  await database.write(async () => {
    await (await database.get('categories').find(categoryId)).destroyPermanently();
  });
  const [expense] = await services.getAllExpensesByMonth('u1', '2026-10');
  expect(expense?.title).toBe('Orphan');
  expect(expense?.category).toBeUndefined();
});

it('reads a day and a category-month through the same mapping', async () => {
  const categoryId = await services.createCategory('Food', 'u1', 'pizza', '#654321', 'expense');
  await services.createExpense('u1', 'Lunch', 12, '', categoryId, '2026-10-05T12:00:00');
  await services.createExpense('u1', 'Dinner', 20, '', categoryId, '2026-10-06T20:00:00');
  expect((await services.getAllExpensesByDate('u1', '2026-10-05')).map(e => e.title)).toEqual(['Lunch']);
  expect(
    (await services.getAllExpensesByCategoryAndMonth('u1', categoryId, '2026-10')).map(e => e.title).sort(),
  ).toEqual(['Dinner', 'Lunch']);
});

it('month, day and category reads return plain rows with exactly the ExpenseWithCategory fields', async () => {
  const categoryId = await services.createCategory('Food', 'u1', 'pizza', '#654321', 'expense');
  await services.createExpense('u1', 'Lunch', 12.5, '', categoryId, '2026-10-05T12:00:00');
  const expected = {
    title: 'Lunch',
    amount: 12.5,
    description: '',
    categoryId,
    userId: 'u1',
    date: '2026-10-05T12:00:00',
    category: {id: categoryId, name: 'Food', icon: 'pizza', color: '#654321'},
  };
  for (const rows of [
    await services.getAllExpensesByMonth('u1', '2026-10'),
    await services.getAllExpensesByDate('u1', '2026-10-05'),
    await services.getAllExpensesByCategoryAndMonth('u1', categoryId, '2026-10'),
  ]) {
    const [row] = rows;
    // No WatermelonDB internals (_status, _changed) and no model instance reach Redux.
    expect(Object.keys(row ?? {}).sort()).toEqual(['id', ...Object.keys(expected)].sort());
    expect(row).toMatchObject(expected);
  }
});

it('reads the month without hydrating a Model per expense (the 2.7.1 gate: ≤ 15 ms at 10k on the Moto)', async () => {
  const categoryId = await services.createCategory('Coffee', 'u1', null, null, 'expense');
  await services.createExpense('u1', 'Coffee', 3, '', categoryId, '2026-10-05T09:00:00');
  const fetch = jest.spyOn(Query.prototype, 'fetch');
  await services.getAllExpensesByMonth('u1', '2026-10');
  await services.getAllExpensesByDate('u1', '2026-10-05');
  await services.getAllExpensesByCategoryAndMonth('u1', categoryId, '2026-10');
  const hydratedTables = fetch.mock.contexts.map(query => (query as {collection: {table: string}}).collection.table); // `this` of Query#fetch
  expect(hydratedTables).not.toContain('expenses');
  fetch.mockRestore();
});
