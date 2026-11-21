/**
 * The day a user's month starts on (plan P11): one column, written alone
 * (L6), the 1st stored as "none", and nothing outside 1 to 28 accepted.
 */
import {database} from '../../../../src/data/database/database';
import {createUser, getAllUsers, setMonthStartDay, updateUserById} from '../../../../src/data/services/userService';

const raw = async (userId: string) =>
  (await database.get('users').find(userId))._raw as unknown as Record<string, unknown>;

it('a new user has no day, which reads as the 1st', async () => {
  const userId = await createUser('Asha', '');
  expect((await raw(userId))['month_start_day']).toBeNull();
  expect((await getAllUsers())[0]?.monthStartDay).toBe(1);
});

it('sets the day and touches nothing else; the 1st is stored as none', async () => {
  const userId = await createUser('Asha', 'a@example.com');
  const before = await raw(userId);
  await setMonthStartDay(userId, 7);
  const after = await raw(userId);
  expect(after['month_start_day']).toBe(7);
  expect({...after, month_start_day: null, updated_at: 0, _changed: ''}).toEqual({
    ...before,
    month_start_day: null,
    updated_at: 0,
    _changed: '',
  });
  expect((await getAllUsers()).find(user => user.id === userId)?.monthStartDay).toBe(7);
  await setMonthStartDay(userId, 1);
  expect((await raw(userId))['month_start_day']).toBeNull();
  // A rename afterwards leaves the day alone.
  await setMonthStartDay(userId, 28);
  await updateUserById(userId, {username: 'Bela'});
  expect((await raw(userId))['month_start_day']).toBe(28);
});

it('refuses a day a month might not have', async () => {
  const userId = await createUser('Asha', '');
  for (const bad of [0, 29, 31, 1.5, Number.NaN]) {
    await expect(setMonthStartDay(userId, bad)).rejects.toThrow('A month starts on day 1 to 28');
  }
});

it('a stored value outside 1 to 28 (a hand-edited database) reads as the 1st', async () => {
  const userId = await createUser('Asha', '');
  await database.write(async () => {
    const user = await database.get('users').find(userId);
    await user.update(record => {
      (record._raw as unknown as Record<string, unknown>)['month_start_day'] = 31;
    });
  });
  expect((await getAllUsers()).find(user => user.id === userId)?.monthStartDay).toBe(1);
});
