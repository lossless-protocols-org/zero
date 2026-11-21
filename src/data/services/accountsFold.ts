import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Account} from '../database/models/Account';
import type {Expense} from '../database/models/Expense';
import type {Income} from '../database/models/Income';
import type {Refund} from '../database/models/Refund';
import type {Debt} from '../database/models/Debt';
import type {ProDataPart} from './proDataService';

/**
 * Accounts, transfers and checkpoints as Pro data kept (3.0 law L9,
 * ZERO_3.0_ENTITLEMENT.md §4). A free user sees one account, the default,
 * and no transfer or checkpoint: what a restored Pro backup or a lapsed
 * subscription leaves is counted, and consolidated only on the user's own
 * request.
 *
 * Counted: every account but the default, every transfer, every checkpoint.
 * Removing: entries (expenses, money in, refunds) on another account move to
 * the default; a debt's account is cleared (it then touched no account, as
 * every debt before 3.0); transfers and checkpoints are deleted; then the
 * other accounts, which nothing refers to any more. The default account,
 * its name and its opening balance stay: it is the account Free uses.
 */

const defaultsByUser = async (): Promise<Map<string, string>> => {
  const defaults = await database.get<Account>('accounts').query(Q.where('is_default', true)).fetch();
  return new Map(defaults.map(account => [account.userId, account.id]));
};

export const accountsPart: ProDataPart = {
  key: 'accounts',
  count: async () => {
    const [others, transfers, checkpoints] = await Promise.all([
      database.get<Account>('accounts').query(Q.where('is_default', false)).fetchCount(),
      database.get('transfers').query().fetchCount(),
      database.get('checkpoints').query().fetchCount(),
    ]);
    return others + transfers + checkpoints;
  },
  planRemoval: async plan => {
    const defaults = await defaultsByUser();
    for (const [userId, defaultId] of defaults) {
      const elsewhere = [Q.where('user_id', userId), Q.where('account_id', Q.notEq(defaultId))];
      const [expenses, incomes, refunds] = await Promise.all([
        database
          .get<Expense>('expenses')
          .query(...elsewhere)
          .fetch(),
        database
          .get<Income>('incomes')
          .query(...elsewhere)
          .fetch(),
        database
          .get<Refund>('refunds')
          .query(...elsewhere)
          .fetch(),
      ]);
      for (const row of [...expenses, ...incomes, ...refunds]) {
        plan.update(row, moved => {
          moved.accountId = defaultId;
        });
      }
      const others = await database
        .get<Account>('accounts')
        .query(Q.where('user_id', userId), Q.where('id', Q.notEq(defaultId)))
        .fetch();
      others.forEach(account => plan.destroy(account));
    }
    // A user with no default account (never made by the app) keeps their accounts: there is nowhere to move entries to.
    const debts = await database
      .get<Debt>('debts')
      .query(Q.where('account_id', Q.notEq(null)))
      .fetch();
    for (const debt of debts) {
      plan.update(debt, cleared => {
        cleared.accountId = null;
      });
    }
    const [transfers, checkpoints] = await Promise.all([
      database.get('transfers').query().fetch(),
      database.get('checkpoints').query().fetch(),
    ]);
    [...transfers, ...checkpoints].forEach(row => plan.destroy(row));
  },
};
