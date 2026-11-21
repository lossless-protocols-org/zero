import {Q, type Model} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Account} from '../database/models/Account';
import {
  DEFAULT_ACCOUNT_COLOR,
  DEFAULT_ACCOUNT_ICON,
  DEFAULT_ACCOUNT_NAME,
  defaultAccountId,
} from '../database/defaultAccount';
import {assertUserId} from './assertUserId';
import {
  ACCOUNT_TYPES,
  accountNameKey,
  classOf,
  cleanAccountKind,
  cleanAccountName,
  isValidAccountKind,
  isValidAccountName,
  toAccountType,
  type AccountClass,
  type AccountType,
} from '../../domain/accounts';
import {isCalendarDay} from '../../domain/dates';
import {MAX_AMOUNT, MAX_TEXT} from '../../domain/limits';

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

/** True when `accountId` names one of the user's accounts (active or archived). Run inside a writer or not. */
export const isUsersAccount = async (userId: string, accountId: string): Promise<boolean> =>
  (await database.get<Account>('accounts').query(Q.where('id', accountId), Q.where('user_id', userId)).fetchCount()) >
  0;

/** True when `accountId` is one of the user's accounts and not archived: what a new entry may be recorded on. */
export const isUsersActiveAccount = async (userId: string, accountId: string): Promise<boolean> =>
  (await database
    .get<Account>('accounts')
    .query(Q.where('id', accountId), Q.where('user_id', userId), Q.where('account_status', true))
    .fetchCount()) > 0;

/**
 * An entry (expense, income, refund) named an account it may not use: not
 * the user's, or archived. The screens offer only active accounts, so this
 * is a stale screen or a bug, never a choice the user made.
 * @internal The forms show their usual "couldn't save"; tests check the class.
 */
export class EntryAccountError extends Error {
  constructor() {
    super('Not one of the user’s active accounts');
    this.name = 'EntryAccountError';
  }
}

/**
 * Checks the account an entry is being moved to, inside the caller's writer.
 * `current` is the account the entry has now: keeping it is always allowed,
 * archived or not, so an old entry on an archived account stays editable.
 */
export const assertEntryAccount = async (userId: string, accountId: string, current?: string): Promise<void> => {
  if (accountId !== current && !(await isUsersActiveAccount(userId, accountId))) {
    throw new EntryAccountError();
  }
};

type AccountRule =
  | 'nameNotValid'
  | 'nameTaken'
  | 'kindTooLong'
  | 'kindEmpty'
  | 'notAType'
  | 'notAnAmount'
  | 'notADay'
  | 'textTooLong'
  | 'defaultCannotBeArchived'
  | 'archivedCannotBeDefault';

/** A write refused because it would store an invalid account, or break "one default, always active". The UI maps `rule` to copy. */
export class AccountRuleError extends Error {
  readonly rule: AccountRule;
  constructor(rule: AccountRule) {
    super(`Account rule broken: ${rule}`);
    this.name = 'AccountRuleError';
    this.rule = rule;
  }
}

/** What the user types or picks for an account. Currency is never given: it mirrors the user's. */
export interface AccountFields {
  name: string;
  type: AccountType;
  openingBalance: number;
  /** The day the opening balance is from; null: from the beginning. */
  openingDate: string | null;
  icon: string;
  color: string;
  /** The user's own one-word label; '' or left out for none. */
  kind?: string;
}

const usersAccounts = (userId: string): Promise<Account[]> =>
  database.get<Account>('accounts').query(Q.where('user_id', userId)).fetch();

/**
 * Names are unique per user, read the same way backups match them
 * (accountNameKey). Archived accounts count: unarchiving one must not make a
 * second of the same name, and a backup carries both.
 */
const assertAccountFields = async (userId: string, fields: AccountFields, selfId?: string): Promise<void> => {
  if (!isValidAccountName(fields.name)) {
    throw new AccountRuleError('nameNotValid');
  }
  if (!(ACCOUNT_TYPES as readonly string[]).includes(fields.type)) {
    throw new AccountRuleError('notAType');
  }
  // May be below zero (a card); never NaN, infinite, or past the backup's bound (domain/limits).
  if (!Number.isFinite(fields.openingBalance) || Math.abs(fields.openingBalance) > MAX_AMOUNT) {
    throw new AccountRuleError('notAnAmount');
  }
  if (fields.openingDate !== null && !isCalendarDay(fields.openingDate)) {
    throw new AccountRuleError('notADay');
  }
  if (fields.kind !== undefined && !isValidAccountKind(fields.kind)) {
    throw new AccountRuleError('kindTooLong');
  }
  if (fields.icon.length > MAX_TEXT || fields.color.length > MAX_TEXT) {
    throw new AccountRuleError('textTooLong');
  }
  const key = accountNameKey(fields.name);
  const others = (await usersAccounts(userId)).filter(account => account.id !== selfId);
  if (others.some(account => accountNameKey(account.name) === key)) {
    throw new AccountRuleError('nameTaken');
  }
};

/**
 * Adds an account (3.0), active, after every other. Its currency is the
 * user's (one currency per user in 3.0): read from their default account,
 * which the currency service keeps in step.
 */
export const createAccount = async (userId: string, fields: AccountFields): Promise<string> => {
  assertUserId(userId, 'account');
  let id = '';
  await database.write(async () => {
    await assertAccountFields(userId, fields);
    const own = await usersAccounts(userId);
    const currency = own.find(account => account.isDefault)?.currency ?? own[0]?.currency ?? '';
    const created = await database.get<Account>('accounts').create(account => {
      account.userId = userId;
      account.name = cleanAccountName(fields.name);
      account.type = fields.type;
      account.currency = currency;
      account.openingBalance = fields.openingBalance;
      account.openingDate = fields.openingDate;
      account.isDefault = false;
      account.accountStatus = true;
      account.sortOrder = Math.max(-1, ...own.map(a => a.sortOrder)) + 1;
      account.icon = fields.icon;
      account.color = fields.color;
      account.kind = cleanAccountKind(fields.kind ?? '') || null;
    });
    id = created.id;
  });
  return id;
};

/** Changes the fields given and no other (law L6). The result must still be a valid account with a unique name. */
export const updateAccount = async (accountId: string, patch: Partial<AccountFields>): Promise<void> => {
  await database.write(async () => {
    const account = await database.get<Account>('accounts').find(accountId);
    await assertAccountFields(
      account.userId,
      {
        name: patch.name ?? account.name,
        // The stored type is checked only when the patch changes it: an imported unknown type stays editable.
        type: patch.type ?? 'other',
        openingBalance: patch.openingBalance ?? account.openingBalance,
        openingDate: patch.openingDate === undefined ? account.openingDate : patch.openingDate,
        icon: patch.icon ?? account.icon,
        color: patch.color ?? account.color,
        kind: patch.kind,
      },
      account.id,
    );
    await account.update(a => {
      if (patch.name !== undefined) {
        a.name = cleanAccountName(patch.name);
      }
      if (patch.type !== undefined) {
        a.type = patch.type;
      }
      if (patch.openingBalance !== undefined) {
        a.openingBalance = patch.openingBalance;
      }
      if (patch.openingDate !== undefined) {
        a.openingDate = patch.openingDate;
      }
      if (patch.icon !== undefined) {
        a.icon = patch.icon;
      }
      if (patch.color !== undefined) {
        a.color = patch.color;
      }
      if (patch.kind !== undefined) {
        a.kind = cleanAccountKind(patch.kind) || null;
      }
    });
  });
};

/**
 * Archives or restores an account. Archived accounts keep every row and
 * still count in net worth; they are only no longer offered for new
 * entries. Accounts are never deleted: backups refer to them by name, and
 * an entry's account must always exist. The default cannot be archived.
 */
export const setAccountArchived = async (accountId: string, archived: boolean): Promise<void> => {
  await database.write(async () => {
    const account = await database.get<Account>('accounts').find(accountId);
    if (archived && account.isDefault) {
      throw new AccountRuleError('defaultCannotBeArchived');
    }
    if (account.accountStatus === !archived) {
      return;
    }
    await account.update(a => {
      a.accountStatus = !archived;
    });
  });
};

/**
 * Makes an active account the one new entries take. One batch: there is
 * exactly one default at every moment a reader could look.
 */
export const setDefaultAccount = async (accountId: string): Promise<void> => {
  await database.write(async () => {
    const account = await database.get<Account>('accounts').find(accountId);
    if (!account.accountStatus) {
      throw new AccountRuleError('archivedCannotBeDefault');
    }
    const changes = (await usersAccounts(account.userId))
      .filter(a => a.isDefault !== (a.id === account.id))
      .map(a =>
        a.prepareUpdate(changed => {
          changed.isDefault = changed.id === account.id;
        }),
      );
    if (changes.length > 0) {
      await database.batch(changes);
    }
  });
};

/**
 * Gives the accounts named one kind (the user's word for a group of them),
 * in one batch: a reader sees the group under its old word or its new one,
 * never split. Only `kind` is written (law L6), and only where it differs;
 * the stored type stays, so no sum moves.
 *
 * The caller names the accounts, not the old word: an account with no kind
 * of its own is grouped under the word its stored type stands for, and that
 * word is copy in the user's language, which this layer does not read. Only
 * the user's own accounts of `accountClass` are touched, archived ones
 * included (an unarchived account must not bring the old word back); any
 * other id is passed over. An empty or over-long word is refused.
 */
export const renameAccountKind = async (
  userId: string,
  accountClass: AccountClass,
  accountIds: readonly string[],
  toLabel: string,
): Promise<void> => {
  const kind = cleanAccountKind(toLabel);
  if (kind === '') {
    throw new AccountRuleError('kindEmpty');
  }
  if (!isValidAccountKind(kind)) {
    throw new AccountRuleError('kindTooLong');
  }
  const named = new Set(accountIds);
  await database.write(async () => {
    const changes = (await usersAccounts(userId))
      .filter(
        account =>
          named.has(account.id) && classOf(toAccountType(account.type)) === accountClass && account.kind !== kind,
      )
      .map(account =>
        account.prepareUpdate(changed => {
          changed.kind = kind;
        }),
      );
    if (changes.length > 0) {
      await database.batch(changes);
    }
  });
};

/** An account as screens list it. */
export interface AccountSummary {
  id: string;
  name: string;
  type: AccountType;
  isDefault: boolean;
  /** False when archived. */
  active: boolean;
  icon: string;
  color: string;
  /** The user's own label, '' when none. */
  kind: string;
}

/** Every account of the user, archived ones included, in the user's order. */
export const getAccounts = async (userId: string): Promise<AccountSummary[]> =>
  (
    await database.get<Account>('accounts').query(Q.where('user_id', userId), Q.sortBy('sort_order', Q.asc)).fetch()
  ).map(account => ({
    id: account.id,
    name: account.name,
    type: toAccountType(account.type),
    isDefault: account.isDefault,
    active: account.accountStatus,
    icon: account.icon,
    color: account.color,
    kind: account.kind ?? '',
  }));

/** One account with everything its form edits, or null when it no longer exists. */
export interface AccountRecord extends AccountSummary {
  /** As stored: a restored backup may carry a type the app does not know (read through toAccountType). */
  storedType: string;
  openingBalance: number;
  openingDate: string | null;
}

export const getAccountById = async (accountId: string): Promise<AccountRecord | null> => {
  const [account] = await database.get<Account>('accounts').query(Q.where('id', accountId)).fetch();
  if (!account) {
    return null;
  }
  return {
    id: account.id,
    name: account.name,
    type: toAccountType(account.type),
    storedType: account.type,
    isDefault: account.isDefault,
    active: account.accountStatus,
    icon: account.icon,
    color: account.color,
    kind: account.kind ?? '',
    openingBalance: account.openingBalance,
    openingDate: account.openingDate,
  };
};
