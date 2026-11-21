import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Account} from '../database/models/Account';
import {Debt} from '../database/models/Debt';
import {Debtor} from '../database/models/Debtor';
import {assertUserId} from './assertUserId';
import {AccountRuleError} from './accountService';
import {accountNameKey, cleanAccountName, isValidAccountName, storedTypeFor} from '../../domain/accounts';
import {BORROW, LEND, debtorGroupOf, netDebt} from '../../domain/debtType';
import type {IsoDay} from '../../domain/types';

/**
 * The tally asked for is not one: it is a person, or not this user's.
 * @internal The screen shows its usual "couldn't move it"; tests check the class.
 */
export class NotATallyError extends Error {
  constructor() {
    super('Not one of the user’s card or loan tallies');
    this.name = 'NotATallyError';
  }
}

/**
 * Turns one of the free app's card or loan tallies into a full card or loan
 * (approved model A2, "Free and Pro"). One batch, and nothing is deleted:
 * - an account of the class asked for is made under the tally's name, owing
 *   what the tally nets to today (a tally you are owed on starts in credit);
 * - the tally gets one closing entry that brings it to nothing, so its
 *   history stays readable and net worth counts the debt once, not twice.
 * Tier-blind like every service: the screen decides who is offered it.
 *
 * @param closingNote What the closing entry says ("Moved to accounts"), in the user's language.
 * @param when The closing entry's date and time, as debts store it.
 * @returns The new account's id.
 */
export const moveTallyToAccount = async (
  userId: string,
  debtorId: string,
  accountClass: 'card' | 'loan',
  today: IsoDay,
  when: string,
  closingNote: string,
  icon: string,
): Promise<string> => {
  assertUserId(userId, 'tally');
  let accountId = '';
  await database.write(async () => {
    const [debtor] = await database
      .get<Debtor>('debtors')
      .query(Q.where('id', debtorId), Q.where('user_id', userId))
      .fetch();
    if (!debtor || debtorGroupOf(debtor.type) !== 'accounts') {
      throw new NotATallyError();
    }
    if (!isValidAccountName(debtor.title)) {
      throw new AccountRuleError('nameNotValid');
    }
    const accounts = await database.get<Account>('accounts').query(Q.where('user_id', userId)).fetch();
    const key = accountNameKey(debtor.title);
    if (accounts.some(account => accountNameKey(account.name) === key)) {
      throw new AccountRuleError('nameTaken');
    }
    const debts = await database
      .get<Debt>('debts')
      .query(Q.where('debtor_id', debtorId), Q.where('user_id', userId))
      .fetch();
    // Positive: the user owes. An account holds what is owed below zero.
    const owed = netDebt(debts);
    const currency = accounts.find(account => account.isDefault)?.currency ?? accounts[0]?.currency ?? '';
    const account = database.get<Account>('accounts').prepareCreate(created => {
      created.userId = userId;
      created.name = cleanAccountName(debtor.title);
      created.type = storedTypeFor(accountClass, '');
      created.currency = currency;
      created.openingBalance = owed === 0 ? 0 : 0 - owed;
      created.openingDate = today;
      created.isDefault = false;
      created.accountStatus = true;
      created.sortOrder = Math.max(-1, ...accounts.map(a => a.sortOrder)) + 1;
      created.icon = icon;
      created.color = debtor.color;
      created.kind = null;
    });
    accountId = account.id;
    const closing =
      owed === 0
        ? []
        : [
            database.get<Debt>('debts').prepareCreate(debt => {
              debt.description = closingNote;
              debt.amount = Math.abs(owed);
              debt.debtorId = debtorId;
              debt.userId = userId;
              debt.date = when;
              // A lending cancels what was borrowed, and the other way round (domain/debtType.netDebt).
              debt.type = owed > 0 ? LEND : BORROW;
              debt.accountId = null;
            }),
          ];
    await database.batch([account, ...closing]);
  });
  return accountId;
};
