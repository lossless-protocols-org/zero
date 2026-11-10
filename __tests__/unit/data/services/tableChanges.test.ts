/**
 * observeTables: the one table watch every screen and the session follower
 * use. It emits once at once, then once per write batch to a watched table,
 * and never for other tables.
 */
import {database} from '../../../../src/data/database/database';
import {observeTables} from '../../../../src/data/services/tableChanges';
import * as services from '../../../harness/services';

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

it('emits on subscribe, then once per write to a watched table only', async () => {
  const emissions: number[] = [];
  const subscription = observeTables(['categories']).subscribe(() => emissions.push(emissions.length));
  expect(emissions).toHaveLength(1);
  await services.createCategory('Food', 'u1', null, null, 'expense');
  expect(emissions).toHaveLength(2);
  await services.createCurrency('INR', '₹', 'Indian Rupee', 'u1');
  expect(emissions).toHaveLength(2);
  subscription.unsubscribe();
  await services.createCategory('Fuel', 'u1', null, null, 'expense');
  expect(emissions).toHaveLength(2);
});
