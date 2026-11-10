import {nanoid} from 'nanoid';
import {database} from '../database/database';
import {User} from '../database/models/User';
import {prepareDefaultAccount} from './accountService';
import {prepareDefaultIncomeCategory} from './categoryService';

/**
 * Creates a new user and, in the same batch, their default account (schema
 * v5: every entry belongs to an account) and their income category (money in
 * always has somewhere to land). The account's currency is filled in when
 * onboarding picks one (currencyService).
 */
export const createUser = async (username: string, email: string): Promise<string> => {
  const id = nanoid(24);
  await database.write(async () => {
    const user = database.get<User>('users').prepareCreate(u => {
      u._raw.id = id;
      u.username = username;
      u.email = email || '';
    });
    // Every user has a default account and an income category from the start (audit §4.1).
    await database.batch([user, prepareDefaultAccount(id, ''), prepareDefaultIncomeCategory(id)]);
  });
  return id;
};

/**
 * Updates a user by ID
 */
export const updateUserById = async (userId: string, updates: {username?: string; email?: string}): Promise<void> => {
  await database.write(async () => {
    const user = await database.get<User>('users').find(userId);
    await user.update(u => {
      if (updates.username !== undefined) {
        u.username = updates.username;
      }
      if (updates.email !== undefined) {
        u.email = updates.email;
      }
    });
  });
};

/**
 * Gets all users
 */
export const getAllUsers = async (): Promise<{id: string; username: string; email: string}[]> => {
  const users = await database.get<User>('users').query().fetch();
  return users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
  }));
};
