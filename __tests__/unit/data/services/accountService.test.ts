/**
 * Accounts (3.0): names unique per user however they are spelled, exactly
 * one default and it always active, archived never deleted, currency always
 * the user's. Entries may name an active account; an old entry keeps an
 * archived one. Transfers take new money only into active accounts.
 * Real LokiJS database.
 */
import {Q} from '@nozbe/watermelondb';
import {database} from '../../../../src/data/database/database';
import type {Account} from '../../../../src/data/database/models/Account';
import type {Expense} from '../../../../src/data/database/models/Expense';
import {defaultAccountId} from '../../../../src/data/database/defaultAccount';
import {
  AccountRuleError,
  createAccount,
  EntryAccountError,
  renameAccountKind,
  resolveDefaultAccount,
  setAccountArchived,
  setDefaultAccount,
  updateAccount,
  type AccountFields,
} from '../../../../src/data/services/accountService';
import {
  copyIncomesFromMonth,
  createIncome,
  getIncomesByMonth,
  updateIncome,
} from '../../../../src/data/services/incomeService';
import {createRefund} from '../../../../src/data/services/refundService';
import {createTransfer, TransferRuleError, updateTransfer} from '../../../../src/data/services/transferService';
import {acceptCheckpoint, previewCheckpoint} from '../../../../src/data/services/checkpointService';
import {defaultIncomeCategoryId} from '../../../../src/data/database/defaultIncomeCategory';
import {updateCurrencyById} from '../../../../src/data/services/currencyService';
import * as services from '../../../harness/services';
import {periodFor} from '../../../../src/domain/period';

let userId = '';
let currencyId = '';
let food = '';
let cash = '';

const fields = (more: Partial<AccountFields> = {}): AccountFields => ({
  name: 'HDFC',
  type: 'bank',
  openingBalance: 0,
  openingDate: null,
  icon: 'landmark',
  color: '#224466',
  ...more,
});

const accountRule = async (write: Promise<unknown>): Promise<string> => {
  try {
    await write;
  } catch (error) {
    if (error instanceof AccountRuleError) {
      return error.rule;
    }
    throw error;
  }
  return 'accepted';
};

const accounts = () => database.get<Account>('accounts').query(Q.where('user_id', userId)).fetch();
const find = (id: string) => database.get<Account>('accounts').find(id);

beforeEach(async () => {
  await services.deleteAllData();
  userId = await services.createUser('Asha', '');
  currencyId = await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  cash = defaultAccountId(userId);
});

describe('createAccount', () => {
  it('adds an active, non-default account after the others, in the user’s currency, its name trimmed', async () => {
    const id = await createAccount(
      userId,
      fields({name: '  HDFC  ', openingBalance: -1200.5, openingDate: '2026-11-01'}),
    );
    const account = await find(id);
    expect(account).toMatchObject({
      name: 'HDFC',
      type: 'bank',
      currency: 'INR',
      openingBalance: -1200.5,
      openingDate: '2026-11-01',
      isDefault: false,
      accountStatus: true,
    });
    expect(account.sortOrder).toBeGreaterThan((await find(cash)).sortOrder);
  });

  it('refuses a name another account has, however it is spelled, archived ones included', async () => {
    const id = await createAccount(userId, fields());
    expect(await accountRule(createAccount(userId, fields({name: ' hdfc'})))).toBe('nameTaken');
    expect(await accountRule(createAccount(userId, fields({name: 'CASH'})))).toBe('nameTaken');
    await setAccountArchived(id, true);
    expect(await accountRule(createAccount(userId, fields({name: 'Hdfc'})))).toBe('nameTaken');
    // Another user's names are theirs.
    const other = await services.createUser('Bela', '');
    expect(await accountRule(createAccount(other, fields()))).toBe('accepted');
  });

  it('refuses what a backup could not carry or a balance could not use', async () => {
    expect(await accountRule(createAccount(userId, fields({name: '   '})))).toBe('nameNotValid');
    expect(await accountRule(createAccount(userId, fields({name: 'x'.repeat(201)})))).toBe('nameNotValid');
    // The type comes from a list; a string from elsewhere is refused.
    expect(await accountRule(createAccount(userId, fields({type: 'savings' as AccountFields['type']})))).toBe(
      'notAType',
    );
    expect(await accountRule(createAccount(userId, fields({openingBalance: Number.NaN})))).toBe('notAnAmount');
    expect(await accountRule(createAccount(userId, fields({openingBalance: -1e14})))).toBe('notAnAmount');
    expect(await accountRule(createAccount(userId, fields({openingDate: '2026-11'})))).toBe('notADay');
    expect(await accountRule(createAccount(userId, fields({icon: 'x'.repeat(201)})))).toBe('textTooLong');
    expect(await accounts()).toHaveLength(1);
  });
});

describe('updateAccount', () => {
  it('renames, and may keep its own name in another spelling', async () => {
    const id = await createAccount(userId, fields());
    await updateAccount(id, {name: 'hdfc '});
    expect((await find(id)).name).toBe('hdfc');
    expect(await accountRule(updateAccount(id, {name: 'Cash'}))).toBe('nameTaken');
  });

  it('an account restored with an unknown type stays editable without choosing a type', async () => {
    const id = await createAccount(userId, fields());
    await database.write(async () => {
      await (
        await find(id)
      ).update(a => {
        a.type = 'Savings';
      });
    });
    await updateAccount(id, {name: 'Old savings'});
    expect((await find(id)).type).toBe('Savings');
  });

  it('a currency change still relabels every account', async () => {
    const id = await createAccount(userId, fields());
    await updateCurrencyById(currencyId, {code: 'USD'});
    expect((await find(id)).currency).toBe('USD');
  });
});

describe('archive and default', () => {
  it('archives and restores; the default cannot be archived', async () => {
    const id = await createAccount(userId, fields());
    await setAccountArchived(id, true);
    expect((await find(id)).accountStatus).toBe(false);
    await setAccountArchived(id, false);
    expect((await find(id)).accountStatus).toBe(true);
    expect(await accountRule(setAccountArchived(cash, true))).toBe('defaultCannotBeArchived');
  });

  it('moves the default in one batch: exactly one at every point, and new entries follow it', async () => {
    const id = await createAccount(userId, fields());
    await setDefaultAccount(id);
    expect((await accounts()).filter(a => a.isDefault).map(a => a.id)).toEqual([id]);
    expect((await resolveDefaultAccount(userId)).accountId).toBe(id);
    const expense = await services.createExpense(userId, 'Lunch', 250, '', food, '2026-11-02T13:00:00');
    expect((await database.get<Expense>('expenses').find(expense)).accountId).toBe(id);
    // The old default can now be archived; an archived account cannot become the default.
    await setAccountArchived(cash, true);
    expect(await accountRule(setDefaultAccount(cash))).toBe('archivedCannotBeDefault');
  });
});

describe('renameAccountKind', () => {
  it('gives the accounts named the new word, cleaned, in one batch, archived ones included', async () => {
    const gold = await createAccount(userId, fields({name: 'Gold bond', type: 'investment', kind: 'Gold'}));
    const coins = await createAccount(userId, fields({name: 'Coins', type: 'investment', kind: 'gold'}));
    const funds = await createAccount(userId, fields({name: 'Index', type: 'investment', kind: 'Funds'}));
    await setAccountArchived(coins, true);
    const batch = jest.spyOn(database, 'batch');
    await renameAccountKind(userId, 'save', [gold, coins], '  Precious   metal ');
    expect(batch).toHaveBeenCalledTimes(1);
    batch.mockRestore();
    expect((await find(gold)).kind).toBe('Precious metal');
    expect((await find(coins)).kind).toBe('Precious metal');
    expect((await find(funds)).kind).toBe('Funds');
  });

  it('gives an account that had no word of its own one, and leaves its stored type alone', async () => {
    await renameAccountKind(userId, 'spend', [cash], 'Pocket');
    expect(await find(cash)).toMatchObject({kind: 'Pocket', type: 'cash'});
  });

  it('passes over an account of another class or another user, and writes nothing when nothing differs', async () => {
    const card = await createAccount(userId, fields({name: 'Amex', type: 'card', kind: 'Later'}));
    const other = await services.createUser('Ravi', '');
    const theirs = defaultAccountId(other);
    const batch = jest.spyOn(database, 'batch');
    await renameAccountKind(userId, 'spend', [card, theirs], 'Pocket');
    await renameAccountKind(userId, 'card', [card], 'Later');
    expect(batch).not.toHaveBeenCalled();
    batch.mockRestore();
    expect((await find(card)).kind).toBe('Later');
    expect((await find(theirs)).kind ?? '').toBe('');
  });

  it('refuses an empty word or one too long, and changes nothing', async () => {
    const card = await createAccount(userId, fields({name: 'Amex', type: 'card', kind: 'Later'}));
    expect(await accountRule(renameAccountKind(userId, 'card', [card], '   '))).toBe('kindEmpty');
    expect(await accountRule(renameAccountKind(userId, 'card', [card], 'x'.repeat(21)))).toBe('kindTooLong');
    expect((await find(card)).kind).toBe('Later');
  });
});

describe('entries on an account', () => {
  it('an expense, money in and a refund may name an active account', async () => {
    const card = await createAccount(userId, fields({name: 'Amex', type: 'card'}));
    const bank = await createAccount(userId, fields());
    const expense = await services.createExpense(userId, 'Shoes', 3000, '', food, '2026-11-03T18:00:00', {
      accountId: card,
    });
    expect((await database.get<Expense>('expenses').find(expense)).accountId).toBe(card);
    const refund = await createRefund(expense, {amount: 1000, date: '2026-11-04T10:00:00', note: '', accountId: bank});
    const plainRefund = await createRefund(expense, {amount: 500, date: '2026-11-04T10:00:00', note: ''});
    const refundAccount = async (id: string) =>
      ((await database.get('refunds').find(id))._raw as unknown as {account_id: string}).account_id;
    expect(await refundAccount(refund)).toBe(bank);
    // Without one, a refund lands on its expense's account.
    expect(await refundAccount(plainRefund)).toBe(card);
    const income = await createIncome(userId, {
      categoryId: defaultIncomeCategoryId(userId),
      amount: 100,
      date: '2026-11-05',
      note: '',
      accountId: bank,
    });
    expect(((await database.get('incomes').find(income))._raw as unknown as {account_id: string}).account_id).toBe(
      bank,
    );
  });

  it('refuses an archived account or another user’s for a new entry, and keeps an old entry’s archived one', async () => {
    const bank = await createAccount(userId, fields());
    const income = await createIncome(userId, {
      categoryId: defaultIncomeCategoryId(userId),
      amount: 100,
      date: '2026-11-05',
      note: '',
      accountId: bank,
    });
    await setAccountArchived(bank, true);
    await expect(
      services.createExpense(userId, 'x', 1, '', food, '2026-11-03T18:00:00', {accountId: bank}),
    ).rejects.toBeInstanceOf(EntryAccountError);
    await expect(
      services.createExpense(userId, 'x', 1, '', food, '2026-11-03T18:00:00', {accountId: 'someone-else'}),
    ).rejects.toBeInstanceOf(EntryAccountError);
    // Naming the account it already has is allowed; moving it there from elsewhere is not.
    await updateIncome(income, {accountId: bank, amount: 120});
    await updateIncome(income, {accountId: cash});
    await expect(updateIncome(income, {accountId: bank})).rejects.toBeInstanceOf(EntryAccountError);
  });

  it('a transfer takes new money only into active accounts; an old one stays editable', async () => {
    const bank = await createAccount(userId, fields());
    const card = await createAccount(userId, fields({name: 'Amex', type: 'card'}));
    const id = await createTransfer(userId, {
      fromAccountId: cash,
      toAccountId: bank,
      amount: 10,
      date: '2026-11-06',
      note: '',
    });
    await setAccountArchived(bank, true);
    const rule = await createTransfer(userId, {
      fromAccountId: cash,
      toAccountId: bank,
      amount: 10,
      date: '2026-11-06',
      note: '',
    }).catch((error: TransferRuleError) => error.rule);
    expect(rule).toBe('accountArchived');
    await updateTransfer(id, {amount: 12, toAccountId: bank});
    await updateTransfer(id, {toAccountId: card});
    expect(await updateTransfer(id, {toAccountId: bank}).catch((error: TransferRuleError) => error.rule)).toBe(
      'accountArchived',
    );
  });
});

describe('reconcile', () => {
  it('previews the gap and records it with the kind its account calls for', async () => {
    const fund = await createAccount(userId, fields({name: 'Fund', type: 'investment', openingBalance: 1000}));
    expect(await previewCheckpoint(userId, fund, 1100.25, '2026-11-10')).toEqual({derived: 1000, gap: 100.25});
    const {id, gap} = await acceptCheckpoint(userId, {
      accountId: fund,
      balance: 1100.25,
      date: '2026-11-10',
      note: 'statement',
    });
    expect(gap).toBe(100.25);
    expect((await database.get('checkpoints').find(id))._raw).toMatchObject({
      kind: 'revaluation',
      gap: 100.25,
      balance: 1100.25,
    });
    const {id: onCash} = await acceptCheckpoint(userId, {accountId: cash, balance: -5, date: '2026-11-10', note: ''});
    expect((await database.get('checkpoints').find(onCash))._raw).toMatchObject({kind: 'adjustment', gap: -5});
  });

  it('refuses another user’s account', async () => {
    const other = await services.createUser('Bela', '');
    await expect(
      acceptCheckpoint(userId, {accountId: defaultAccountId(other), balance: 1, date: '2026-11-10', note: ''}),
    ).rejects.toThrow();
  });
});

describe('"Same as last month" and accounts', () => {
  const salaryOn = async (accountId: string) =>
    createIncome(userId, {
      categoryId: defaultIncomeCategoryId(userId),
      amount: 100,
      date: '2026-10-07',
      note: 'Salary',
      accountId,
    });

  it('without Pro every copy is a new entry on the default account, whatever the source was on', async () => {
    await salaryOn(await createAccount(userId, fields()));
    expect(await copyIncomesFromMonth(userId, periodFor('2026-10'), periodFor('2026-11'))).toBe(1);
    expect((await getIncomesByMonth(userId, periodFor('2026-11'))).map(i => i.accountId)).toEqual([cash]);
  });

  it('with Pro a copy keeps its account while it is active, and never lands on an archived one', async () => {
    const bank = await createAccount(userId, fields());
    const old = await createAccount(userId, fields({name: 'Old'}));
    await salaryOn(bank);
    await salaryOn(old);
    await setAccountArchived(old, true);
    expect(await copyIncomesFromMonth(userId, periodFor('2026-10'), periodFor('2026-11'), {keepAccounts: true})).toBe(
      2,
    );
    expect((await getIncomesByMonth(userId, periodFor('2026-11'))).map(i => i.accountId).sort()).toEqual(
      [bank, cash].sort(),
    );
  });
});
