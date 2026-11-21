/**
 * Transfers (schema v6, 3.0): a positive amount, on a day, between two
 * different accounts of the same user. A rule a write breaks is refused
 * whole, so no half-valid transfer is ever stored. Real LokiJS database.
 */
import {database} from '../../../../src/data/database/database';
import type {Account} from '../../../../src/data/database/models/Account';
import type {Transfer} from '../../../../src/data/database/models/Transfer';
import {defaultAccountId} from '../../../../src/data/database/defaultAccount';
import {
  createTransfer,
  deleteTransfer,
  TransferRuleError,
  updateTransfer,
} from '../../../../src/data/services/transferService';
import * as services from '../../../harness/services';

let userId = '';
let cash = '';
let savings = '';

const addAccount = async (owner: string, name: string): Promise<string> => {
  let id = '';
  await database.write(async () => {
    const account = await database.get<Account>('accounts').create(a => {
      a.userId = owner;
      a.name = name;
      a.type = 'bank';
      a.currency = 'INR';
      a.openingBalance = 0;
      a.openingDate = null;
      a.isDefault = false;
      a.accountStatus = true;
      a.sortOrder = 20;
      a.icon = 'landmark';
      a.color = '#224466';
    });
    id = account.id;
  });
  return id;
};

const input = (more: Partial<Parameters<typeof createTransfer>[1]> = {}) => ({
  fromAccountId: cash,
  toAccountId: savings,
  amount: 750,
  date: '2026-11-06' as const,
  note: 'to savings',
  ...more,
});

const rule = async (write: Promise<unknown>): Promise<string> => {
  try {
    await write;
  } catch (error) {
    if (error instanceof TransferRuleError) {
      return error.rule;
    }
    throw error;
  }
  return 'accepted';
};

const stored = async () => (await database.get<Transfer>('transfers').query().fetch()).map(t => t._raw);

beforeEach(async () => {
  await services.deleteAllData();
  userId = await services.createUser('Asha', '');
  cash = defaultAccountId(userId);
  savings = await addAccount(userId, 'Savings');
});

it('records a transfer between two of the user’s accounts', async () => {
  const id = await createTransfer(userId, input());
  expect(await stored()).toEqual([
    expect.objectContaining({
      id,
      user_id: userId,
      from_account_id: cash,
      to_account_id: savings,
      amount: 750,
      date: '2026-11-06',
      note: 'to savings',
    }),
  ]);
});

it.each([
  ['amountNotPositive', {amount: 0}],
  ['amountNotPositive', {amount: -5}],
  ['amountNotPositive', {amount: Number.NaN}],
  ['notADay', {date: '2026-11-06T10:00:00'}],
  ['sameAccount', {toAccountId: 'acct_same', fromAccountId: 'acct_same'}],
  ['notTheUsersAccount', {toAccountId: 'nowhere'}],
  ['amountTooLarge', {amount: 1e13 + 1}],
  ['noteTooLong', {note: 'x'.repeat(201)}],
] as const)('refuses %s, and stores nothing', async (expected, more) => {
  expect(await rule(createTransfer(userId, input(more as never)))).toBe(expected);
  expect(await stored()).toEqual([]);
});

it('refuses an account that belongs to someone else', async () => {
  const other = await services.createUser('Ravi', '');
  const theirs = await addAccount(other, 'Theirs');
  expect(await rule(createTransfer(userId, input({toAccountId: theirs})))).toBe('notTheUsersAccount');
});

it('an edit is checked as the transfer it would leave, and refused whole', async () => {
  const id = await createTransfer(userId, input());
  expect(await rule(updateTransfer(id, {toAccountId: cash}))).toBe('sameAccount');
  expect(await rule(updateTransfer(id, {amount: 0, note: 'never stored'}))).toBe('amountNotPositive');
  expect(await stored()).toEqual([expect.objectContaining({to_account_id: savings, amount: 750, note: 'to savings'})]);
});

it('deletes', async () => {
  const id = await createTransfer(userId, input());
  await deleteTransfer(id);
  expect(await stored()).toEqual([]);
});

it('cannot be recorded without a user', async () => {
  await expect(createTransfer('', input())).rejects.toThrow('user id is empty');
});
