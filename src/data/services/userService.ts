import {nanoid} from 'nanoid';
import {database} from '../database/database';
import {User} from '../database/models/User';
import {prepareDefaultAccount} from './accountService';
import {prepareDefaultIncomeCategory} from './categoryService';
import {DEFAULT_MONTH_START_DAY, MAX_MONTH_START_DAY, toMonthStartDay} from '../../domain/period';

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
 * Sets the day of the month the user's month starts on (3.0, plan P11): 1 to
 * 28. The 1st is stored as null, so a user who never chose and one who chose
 * the 1st are the same row. Tier-blind: the Settings row that calls this is
 * Pro's, and whether the day applies is decided on read (src/pro/monthStart.ts).
 */
export const setMonthStartDay = async (userId: string, day: number): Promise<void> => {
  if (!Number.isInteger(day) || day < 1 || day > MAX_MONTH_START_DAY) {
    throw new Error(`A month starts on day 1 to ${MAX_MONTH_START_DAY}, not ${day}`);
  }
  await database.write(async () => {
    const user = await database.get<User>('users').find(userId);
    await user.update(u => {
      u.monthStartDay = day === DEFAULT_MONTH_START_DAY ? null : day;
    });
  });
};

/**
 * Gets all users. `monthStartDay` is the stored day as a usable one (1 when none was chosen).
 */
export const getAllUsers = async (): Promise<
  {id: string; username: string; email: string; monthStartDay: number}[]
> => {
  const users = await database.get<User>('users').query().fetch();
  return users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    monthStartDay: toMonthStartDay(u.monthStartDay),
  }));
};
