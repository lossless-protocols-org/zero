/**
 * M2 (v2.7.1): with no user row the app used to run as `user_id = ''`: every
 * write stored user_id '' and the export carried `users: []`, which the
 * validator refuses at restore — a backup the user could never use. Now the
 * user fetch rejects (surfaced by M1), the create services refuse an empty
 * user id, and the export refuses to write a file without a user. LokiJS
 * harness as in importService.test.ts, real store for the thunk.
 */
import {database} from '../../src/data/database/database';
import {store} from '../../src/store/store';
import {fetchUserData, selectUserId} from '../../src/store/slices/userIdSlice';
import * as services from '../harness/services';

describe('no user row', () => {
  beforeAll(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  it('fetchUserData rejects with a named reason instead of resolving to an empty id', async () => {
    const action = await store.dispatch(fetchUserData());
    expect(fetchUserData.rejected.match(action)).toBe(true);
    expect(fetchUserData.rejected.match(action) && action.payload).toBe('No user row');
    expect(selectUserId(store.getState())).toBe('');
  });

  it('create services refuse an empty user id rather than writing an orphan row', async () => {
    await expect(services.createExpense('', 'Petrol', 40, '', 'cat-1', '2026-08-01T10:00:00')).rejects.toThrow(
      'Cannot create expense',
    );
    await expect(services.createCategory('Fuel', '', 'car', '#111111', 'expense')).rejects.toThrow(
      'Cannot create category',
    );
    await expect(services.createDebtor('Sam', '', 'user', 'Person', '#444444')).rejects.toThrow('Cannot create debtor');
    await expect(services.createDebt('', 500, 'lunch', 'debtor-1', '2026-08-03', 'Lend')).rejects.toThrow(
      'Cannot create debt',
    );
    await expect(services.createCurrency('INR', '₹', 'Indian Rupee', '')).rejects.toThrow('Cannot create currency');
    await expect(services.upsertBudget('', 30000, {kind: 'month', yearMonth: '2026-10'})).rejects.toThrow(
      'Cannot create budget',
    );
    expect(await database.get('expenses').query().fetchCount()).toBe(0);
    expect(await database.get('categories').query().fetchCount()).toBe(0);
  });

  it('once a user exists the fetch resolves to its id; when the row goes again the dead id is cleared', async () => {
    const id = await services.createUser('Ada', '');
    const action = await store.dispatch(fetchUserData());
    expect(fetchUserData.fulfilled.match(action)).toBe(true);
    expect(selectUserId(store.getState())).toBe(id);
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
    await store.dispatch(fetchUserData());
    expect(selectUserId(store.getState())).toBe('');
  });
});
