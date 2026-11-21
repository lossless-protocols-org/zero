/**
 * A 3.0 backup on a 2.8 phone (3.0 plan P7): 2.8 must refuse it with its
 * "this backup is from a newer version of zero, update the app" message,
 * never restore part of it. 2.8.x checks a file's shape before its version
 * (ExistingUserScreen at tag v2.8.0: validate, then the key, then
 * isEnvelopeTooNew), so the message is reached only if 2.8's validator
 * accepts the file. That holds while v6 only ADDS to v5; a v6 change to a
 * field 2.8 reads would make 2.8 say "not a valid backup" instead, and this
 * test would fail first.
 *
 * Run against 2.8.0's own code, frozen from the tag in frozen/v2.8.0, on a
 * file the 3.0 export writes from a database holding everything 3.0 adds:
 * transfers, checkpoints, a debt through an account, a second account, and
 * income categories 2.8 would have merged.
 */
import {database} from '../../src/data/database/database';
import type {Account} from '../../src/data/database/models/Account';
import {defaultAccountId} from '../../src/data/database/defaultAccount';
import {defaultIncomeCategoryId} from '../../src/data/database/defaultIncomeCategory';
import {CURRENT_EXPORT_VERSION} from '../../src/data/backup/export/format';
import {generateUniqueKey} from '../../src/data/backup/export/key';
import {getAllData} from '../../src/data/services/getService';
import {createTransfer} from '../../src/data/services/transferService';
import {createCheckpoint} from '../../src/data/services/checkpointService';
import * as services from '../harness/services';
import {seedIncomeCategory} from '../harness/incomeCategories';
import {validateExportEnvelope as validate280} from './frozen/v2.8.0/validate';
import {isValidExportKey as isValidKey280} from './frozen/v2.8.0/key';
import {isEnvelopeTooNew as isTooNew280} from './frozen/v2.8.0/format';

/** What 2.8.0's restore screen shows for a picked, parsed file, in its own order. */
const restoreOn280 = (
  file: unknown,
): 'existingUser.invalidExport' | 'existingUser.invalidKey' | 'existingUser.newerVersion' | 'restores' => {
  const validation = validate280(file);
  if (!validation.success || !validation.data) {
    return 'existingUser.invalidExport';
  }
  if (!isValidKey280(validation.data.key)) {
    return 'existingUser.invalidKey';
  }
  if (isTooNew280(validation.data.version)) {
    return 'existingUser.newerVersion';
  }
  return 'restores';
};

let file: {key: string; version: number; data: unknown};

beforeAll(async () => {
  await services.deleteAllData();
  const userId = await services.createUser('Asha', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  await services.createExpense(userId, 'Lunch', 250, '', food, '2026-11-05T10:00:00');
  await seedIncomeCategory(userId, 'freelance', {name: 'Freelance'});
  await services.createIncome(userId, {
    categoryId: defaultIncomeCategoryId(userId),
    amount: 100,
    date: '2026-11-01',
    note: '',
  });
  await services.createIncome(userId, {categoryId: 'freelance', amount: 200, date: '2026-11-02', note: ''});
  let savings = '';
  await database.write(async () => {
    const account = await database.get<Account>('accounts').create(a => {
      a.userId = userId;
      a.name = 'Savings';
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
    savings = account.id;
  });
  const debtor = await services.createDebtor('Rohit', userId, 'user', 'Person', '#555555');
  await services.createDebt(userId, 500, 'Rent', debtor, '2026-11-04T09:00:00', 'Borrow', {accountId: savings});
  await createTransfer(userId, {
    fromAccountId: defaultAccountId(userId),
    toAccountId: savings,
    amount: 750,
    date: '2026-11-06',
    note: '',
  });
  await createCheckpoint(userId, {
    accountId: savings,
    balance: 250,
    date: '2026-11-08',
    gap: 0,
    kind: 'adjustment',
    note: '',
  });
  const data = await getAllData();
  // A file as the export writes it: through JSON, as on disk.
  file = JSON.parse(JSON.stringify({key: generateUniqueKey(), version: CURRENT_EXPORT_VERSION, data})) as typeof file;
});

it('the file holds everything 3.0 adds', () => {
  const data = file.data as Record<string, unknown[]>;
  expect(file.version).toBe(6);
  expect(data['transfers']).toHaveLength(1);
  expect(data['checkpoints']).toHaveLength(1);
  expect((data['categories'] as Array<{kind: string}>).filter(c => c.kind === 'income')).toHaveLength(2);
});

it('2.8.0 refuses it with its "newer version" message, and restores none of it', () => {
  expect(restoreOn280(file)).toBe('existingUser.newerVersion');
});

it('2.8.0’s shape check alone would have dropped the 3.0 rows without a word: the version check is what protects them', () => {
  const validation = validate280(file);
  expect(validation.success).toBe(true);
  const parsed = validation.data?.data as Record<string, unknown>;
  expect(parsed['transfers']).toBeUndefined();
  expect(parsed['checkpoints']).toBeUndefined();
});

it('a v5 file, as 2.8 writes it, still restores on 2.8.0: nothing here changed what 2.8 accepts', () => {
  expect(restoreOn280({...file, version: 5})).toBe('restores');
});
