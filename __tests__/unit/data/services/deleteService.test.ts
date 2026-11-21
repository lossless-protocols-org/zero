/**
 * What the wipe guard asks about (Welcome → Get Started): every table is
 * counted, from the model registry, and everything but the rows a new user
 * is given counts as entered, so a table added later is never wiped unasked.
 * Real LokiJS database.
 */
import {Q} from '@nozbe/watermelondb';
import {database} from '../../../../src/data/database/database';
import type {Account} from '../../../../src/data/database/models/Account';
import {MODEL_CLASSES} from '../../../../src/data/database/models/modelClasses';
import {defaultAccountId} from '../../../../src/data/database/defaultAccount';
import {countAllRecords, deleteAllData} from '../../../../src/data/services/deleteService';
import {createTransfer} from '../../../../src/data/services/transferService';
import * as services from '../../../harness/services';
import {seedIncomeCategory} from '../../../harness/incomeCategories';

let userId = '';

/** A second account, as Pro makes one (P8); written directly until its service exists. */
const addAccount = async (name: string): Promise<string> => {
  let id = '';
  await database.write(async () => {
    const account = await database.get<Account>('accounts').create(a => {
      a.userId = userId;
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

beforeEach(async () => {
  await deleteAllData();
  userId = await services.createUser('Asha', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
});

it('counts every registered table', async () => {
  const counts = await countAllRecords();
  expect(Object.keys(counts.byTable).sort()).toEqual(MODEL_CLASSES.map(m => m.table).sort());
  expect(counts.total).toBe(Object.values(counts.byTable).reduce((sum, n) => sum + n, 0));
});

it('a new user with only what they were given has entered nothing', async () => {
  const counts = await countAllRecords();
  expect(counts.byTable['accounts']).toBe(1);
  expect(counts.byTable['categories']).toBeGreaterThan(0);
  expect(counts.entered).toBe(0);
});

it('an account of their own is entered, though accounts are seeded', async () => {
  await addAccount('Savings');
  expect((await countAllRecords()).entered).toBe(1);
});

it('income categories beyond the one a user is given are entered: a restored Pro backup’s, even with no entries', async () => {
  await seedIncomeCategory(userId, 'freelance');
  expect((await countAllRecords()).entered).toBe(1);
});

it('a device holding only transfers still asks: rows of a 3.0 table are the user’s', async () => {
  const savings = await addAccount('Savings');
  await createTransfer(userId, {
    fromAccountId: defaultAccountId(userId),
    toAccountId: savings,
    amount: 500,
    date: '2026-11-05',
    note: '',
  });
  const counts = await countAllRecords();
  expect(counts.byTable['transfers']).toBe(1);
  expect(counts.entered).toBe(2);
});

it('the wipe empties every table', async () => {
  await addAccount('Savings');
  await deleteAllData();
  expect((await countAllRecords()).total).toBe(0);
  expect(await database.get('accounts').query(Q.where('user_id', userId)).fetchCount()).toBe(0);
});
