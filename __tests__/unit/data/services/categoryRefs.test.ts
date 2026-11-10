/**
 * The category map the lists join onto their rows is read once and kept until
 * a category write (audit 2026-11-08 §8.4). What matters is that it is never
 * stale: every way a category changes shows up in the next read.
 */
import {database} from '../../../../src/data/database/database';
import {categoryRefsOf} from '../../../../src/data/services/categoryRefs';
import * as services from '../../../harness/services';
import {updateCategoryById} from '../../../../src/data/services/categoryService';

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

const namesOf = async (userId: string) => [...(await categoryRefsOf(userId)).values()].map(c => c.name).sort();

it('reads the categories once, then serves the same map', async () => {
  await services.createCategory('Food', 'u1', 'pizza', '#112233', 'expense');
  const first = await categoryRefsOf('u1');
  expect(await categoryRefsOf('u1')).toBe(first);
  expect([...first.values()]).toEqual([expect.objectContaining({name: 'Food', icon: 'pizza', color: '#112233'})]);
});

it('sees a created, renamed and archived category on the next read', async () => {
  const food = await services.createCategory('Food', 'u1', null, null, 'expense');
  expect(await namesOf('u1')).toEqual(['Food']);
  await services.createCategory('Fuel', 'u1', null, null, 'expense');
  expect(await namesOf('u1')).toEqual(['Food', 'Fuel']);
  await updateCategoryById(food, 'Groceries');
  expect(await namesOf('u1')).toEqual(['Fuel', 'Groceries']);
  // Archived categories stay in the map: old expenses still show their name.
  await services.softDeleteCategoryById(food);
  expect(await namesOf('u1')).toEqual(['Fuel', 'Groceries']);
});

it('keeps users apart', async () => {
  await services.createCategory('Food', 'u1', null, null, 'expense');
  await services.createCategory('Rent', 'u2', null, null, 'expense');
  expect(await namesOf('u1')).toEqual(['Food']);
  expect(await namesOf('u2')).toEqual(['Rent']);
});

it('forgets everything when the database is reset (no change event is sent for a reset)', async () => {
  await services.createCategory('Food', 'u1', null, null, 'expense');
  expect(await namesOf('u1')).toEqual(['Food']);
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  expect(await namesOf('u1')).toEqual([]);
});

it('sees a wipe through deleteAllData', async () => {
  await services.createCategory('Food', 'u1', null, null, 'expense');
  expect(await namesOf('u1')).toEqual(['Food']);
  await services.deleteAllData();
  expect(await namesOf('u1')).toEqual([]);
});

it('a month read names its rows from the map, and a rename shows on the next read', async () => {
  const food = await services.createCategory('Food', 'u1', null, null, 'expense');
  await services.createExpense('u1', 'Lunch', 120, '', food, '2026-11-03T13:00:00');
  expect((await services.getAllExpensesByMonth('u1', '2026-11'))[0]?.category?.name).toBe('Food');
  await updateCategoryById(food, 'Eating out');
  expect((await services.getAllExpensesByMonth('u1', '2026-11'))[0]?.category?.name).toBe('Eating out');
});
