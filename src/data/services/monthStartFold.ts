import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import type {User} from '../database/models/User';
import type {ProDataPart} from './proDataService';

/**
 * The month start day as Pro data kept (law L9, ZERO_3.0_ENTITLEMENT.md §4,
 * plan P11): without Pro it is read as the 1st and left untouched, so it
 * applies again the day Pro returns. It counts as one kept thing while a day
 * is chosen, and "Remove Pro data" clears it: months are then calendar
 * months for good, whoever is paying.
 */
export const monthStartPart: ProDataPart = {
  key: 'monthStart',
  count: () =>
    database
      .get<User>('users')
      .query(Q.where('month_start_day', Q.notEq(null)))
      .fetchCount(),
  planRemoval: async plan => {
    const users = await database
      .get<User>('users')
      .query(Q.where('month_start_day', Q.notEq(null)))
      .fetch();
    for (const user of users) {
      plan.update(user, cleared => {
        cleared.monthStartDay = null;
      });
    }
  },
};
