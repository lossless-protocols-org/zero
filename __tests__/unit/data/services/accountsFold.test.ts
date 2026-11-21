/**
 * Accounts as Pro data kept (law L9, P8): counted, and removed only on
 * request. Removal moves every entry to the default account, clears debts'
 * accounts, deletes transfers, checkpoints and the other accounts, and
 * changes no money figure Free shows. An income on another account in an
 * extra income category is changed by both parts in one update.
 * Real LokiJS database.
 */
import {Q} from '@nozbe/watermelondb';
import {database} from '../../../../src/data/database/database';
import {defaultAccountId} from '../../../../src/data/database/defaultAccount';
import {defaultIncomeCategoryId} from '../../../../src/data/database/defaultIncomeCategory';
import {accountsPart} from '../../../../src/data/services/accountsFold';
import {countKeptProData, removeProData} from '../../../../src/data/services/proDataService';
import {createAccount, setAccountArchived} from '../../../../src/data/services/accountService';
import {createTransfer} from '../../../../src/data/services/transferService';
import {acceptCheckpoint} from '../../../../src/data/services/checkpointService';
import {createRefund} from '../../../../src/data/services/refundService';
import {createDebt} from '../../../../src/data/services/debtService';
import {getMonthSummary} from '../../../../src/data/services/periodSummaryService';
import {seedCategory} from '../../../harness/seedCategory';
import * as services from '../../../harness/services';
import {periodFor} from '../../../../src/domain/period';

let userId = '';
let food = '';
let cash = '';

const raw = async (table: string) =>
  (await database.get(table).query().unsafeFetchRaw()) as Array<Record<string, unknown>>;

beforeEach(async () => {
  await services.deleteAllData();
  userId = await services.createUser('Asha', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  cash = defaultAccountId(userId);
});

it('an install that never had Pro has nothing kept', async () => {
  expect(await accountsPart.count()).toBe(0);
  await services.createExpense(userId, 'Lunch', 250, '', food, '2026-11-02T13:00:00');
  expect(await countKeptProData()).toBe(0);
});

it('counts every other account (archived too), every transfer and every checkpoint', async () => {
  const bank = await createAccount(userId, {
    name: 'HDFC',
    type: 'bank',
    openingBalance: 0,
    openingDate: null,
    icon: '',
    color: '',
  });
  const old = await createAccount(userId, {
    name: 'Old',
    type: 'bank',
    openingBalance: 0,
    openingDate: null,
    icon: '',
    color: '',
  });
  await setAccountArchived(old, true);
  await createTransfer(userId, {fromAccountId: cash, toAccountId: bank, amount: 10, date: '2026-11-06', note: ''});
  await acceptCheckpoint(userId, {accountId: bank, balance: 5, date: '2026-11-07', note: ''});
  expect(await accountsPart.count()).toBe(4);
});

it('removal leaves one account and every entry on it, and no money figure moves', async () => {
  const bank = await createAccount(userId, {
    name: 'HDFC',
    type: 'bank',
    openingBalance: 900,
    openingDate: null,
    icon: '',
    color: '',
  });
  const debtor = await services.createDebtor('Rohit', userId, 'user', 'Person', '#222222');
  await seedCategory(database, 'bonus', {userId, kind: 'income', name: 'Bonus'});
  // After the default income category, so it is the extra one Free folds in.
  await database.write(async () => {
    await (
      await database.get('categories').find('bonus')
    ).update(c => {
      (c._raw as unknown as {sort_order: number}).sort_order = 99;
    });
  });
  const shoes = await services.createExpense(userId, 'Shoes', 3000, '', food, '2026-11-03T18:00:00', {accountId: bank});
  await createRefund(shoes, {amount: 1000, date: '2026-11-04T10:00:00', note: ''});
  await services.createIncome(userId, {
    categoryId: 'bonus',
    amount: 500,
    date: '2026-11-05',
    note: '',
    accountId: bank,
  });
  await services.createIncome(userId, {
    categoryId: defaultIncomeCategoryId(userId),
    amount: 700,
    date: '2026-11-05',
    note: 'pay',
  });
  await createDebt(userId, 200, '', debtor, '2026-11-08', 'Lend', {accountId: bank});
  await createTransfer(userId, {fromAccountId: cash, toAccountId: bank, amount: 10, date: '2026-11-06', note: ''});
  await acceptCheckpoint(userId, {accountId: bank, balance: 5, date: '2026-11-07', note: ''});
  const before = await getMonthSummary(userId, periodFor('2026-11'));

  await removeProData();

  expect((await raw('accounts')).map(a => a['id'])).toEqual([cash]);
  for (const table of ['expenses', 'refunds', 'incomes']) {
    expect(new Set((await raw(table)).map(row => row['account_id']))).toEqual(new Set([cash]));
  }
  expect((await raw('debts')).map(d => d['account_id'])).toEqual([null]);
  expect(await raw('transfers')).toEqual([]);
  expect(await raw('checkpoints')).toEqual([]);
  // The income both parts changed: onto the default account and into the one income category, its name kept as the note.
  const bonus = (await raw('incomes')).find(i => i['amount'] === 500);
  expect(bonus).toMatchObject({account_id: cash, category_id: defaultIncomeCategoryId(userId), note: 'Bonus'});
  expect(await getMonthSummary(userId, periodFor('2026-11'))).toEqual(before);
  expect(await countKeptProData()).toBe(0);
  expect(await database.get('categories').query(Q.where('kind', 'income')).fetchCount()).toBe(1);
});

it('a user with no default account keeps their accounts: there is nowhere to move entries to', async () => {
  const bank = await createAccount(userId, {
    name: 'HDFC',
    type: 'bank',
    openingBalance: 0,
    openingDate: null,
    icon: '',
    color: '',
  });
  await database.write(async () => {
    await (await database.get('accounts').find(cash)).destroyPermanently();
  });
  await removeProData();
  expect((await raw('accounts')).map(a => a['id'])).toEqual([bank]);
});
