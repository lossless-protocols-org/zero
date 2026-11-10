import {Q, type Model} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Account} from '../database/models/Account';
import {
  DEFAULT_ACCOUNT_COLOR,
  DEFAULT_ACCOUNT_ICON,
  DEFAULT_ACCOUNT_NAME,
  defaultAccountId,
} from '../database/defaultAccount';

/**
 * The user's default account as a prepared create, for a caller's own batch
 * (createUser, import). Must run inside a writer.
 */
export const prepareDefaultAccount = (userId: string, currency: string): Account =>
  database.get<Account>('accounts').prepareCreate(account => {
    account._raw.id = defaultAccountId(userId);
    account.userId = userId;
    account.name = DEFAULT_ACCOUNT_NAME;
    account.type = 'cash';
    account.currency = currency;
    account.openingBalance = 0;
    account.openingDate = null;
    account.isDefault = true;
    account.accountStatus = true;
    account.sortOrder = 0;
    account.icon = DEFAULT_ACCOUNT_ICON;
    account.color = DEFAULT_ACCOUNT_COLOR;
  });

/**
 * The id new entries are recorded against, from inside a writer. Every user
 * has a default account from schema v5 (migration, createUser, import); if
 * one is ever missing, it is created in the caller's batch rather than
 * failing the entry the user is saving.
 */
export const resolveDefaultAccount = async (userId: string): Promise<{accountId: string; prepared: Account[]}> => {
  const [existing] = await database
    .get<Account>('accounts')
    .query(Q.where('user_id', userId), Q.where('is_default', true), Q.take(1))
    .fetch();
  if (existing) {
    return {accountId: existing.id, prepared: []};
  }
  return {accountId: defaultAccountId(userId), prepared: [prepareDefaultAccount(userId, '')]};
};

/**
 * Prepared updates that give every account of the user the currency code
 * (2.8 is single-currency: an account's currency mirrors the user's). For the
 * currency service's own batch.
 */
export const prepareAccountCurrencyUpdates = async (userId: string, code: string): Promise<Model[]> => {
  const accounts = await database.get<Account>('accounts').query(Q.where('user_id', userId)).fetch();
  return accounts
    .filter(account => account.currency !== code)
    .map(account =>
      account.prepareUpdate(a => {
        a.currency = code;
      }),
    );
};
