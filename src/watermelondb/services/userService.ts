import {nanoid} from 'nanoid';
import {database} from '../database';
import User from '../models/User';

/**
 * Creates a new user
 */
export const createUser = async (username: string, email: string): Promise<string> => {
  const id = nanoid(24);
  await database.write(async () => {
    await database.get<User>('users').create(user => {
      user._raw.id = id;
      user.username = username;
      user.email = email || '';
    });
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
