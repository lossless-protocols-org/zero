/**
 * M17 (v2.7.1): debt `type` was a free string at every write site. Writers now
 * take `DebtType` ('Borrow' | 'Lend'); rows already on devices (or imported)
 * may hold any spelling, so reads normalise once, in the service mapper.
 * LokiJS harness as in userRow.test.ts.
 */
import type {Debt as DebtModel} from '../../../../src/data/database/models/Debt';
import {database} from '../../../../src/data/database/database';
import {createAccount, setAccountArchived} from '../../../../src/data/services/accountService';
import * as services from '../../../../src/data/services/debtService';
import * as harness from '../../../harness/services';
import {defaultAccountId} from '../../../../src/data/database/defaultAccount';

it('reads a legacy spelling back as one of the two debt types', async () => {
  await database.write(async () => {
    await database.get<DebtModel>('debts').create(d => {
      d.description = 'old import';
      d.amount = 5;
      d.debtorId = 'p1';
      d.userId = 'u1';
      d.date = '2026-10-01T10:00:00';
      d.type = 'borrowing';
    });
  });
  await services.createDebt('u1', 7, 'new', 'p1', '2026-10-02T10:00:00', 'Lend');
  const types = (await services.getAllDebtsByUserIdAndDebtorId('u1', 'p1')).map(d => d.type).sort();
  expect(types).toEqual(['Borrow', 'Lend']);
});

describe('the account a debt moved money through (3.0)', () => {
  it('is none unless given, and kept when given one of the user’s accounts', async () => {
    const userId = await harness.createUser('Asha', '');
    const debtor = await harness.createDebtor('Rohit', userId, 'user', 'Person', '#555555');
    const none = await services.createDebt(userId, 100, 'Lunch', debtor, '2026-11-05T10:00:00', 'Lend');
    expect((await services.getDebtById(none))?.accountId).toBeNull();
    const cash = defaultAccountId(userId);
    const through = await services.createDebt(userId, 100, 'Rent', debtor, '2026-11-05T10:00:00', 'Borrow', {
      accountId: cash,
    });
    expect((await services.getDebtById(through))?.accountId).toBe(cash);
  });

  it('refuses an account that is not the user’s, and stores nothing', async () => {
    const userId = await harness.createUser('Asha', '');
    const debtor = await harness.createDebtor('Rohit', userId, 'user', 'Person', '#555555');
    await expect(
      services.createDebt(userId, 100, 'Rent', debtor, '2026-11-05T10:00:00', 'Borrow', {accountId: 'nowhere'}),
    ).rejects.toBeInstanceOf(services.DebtAccountError);
    expect(await services.getAllDebtsByUserId(userId)).toEqual([]);
  });

  it('moves to an active account or to none on edit, keeps an archived one it has, and takes no new money into one', async () => {
    const userId = await harness.createUser('Asha', '');
    const debtor = await harness.createDebtor('Rohit', userId, 'user', 'Person', '#555555');
    const bank = await createAccount(userId, {
      name: 'HDFC',
      type: 'bank',
      openingBalance: 0,
      openingDate: null,
      icon: '',
      color: '',
    });
    const id = await services.createDebt(userId, 100, 'Rent', debtor, '2026-11-05T10:00:00', 'Borrow', {
      accountId: bank,
    });
    await setAccountArchived(bank, true);
    await services.updateDebtById(id, 120, undefined, undefined, undefined, bank);
    expect((await services.getDebtById(id))?.accountId).toBe(bank);
    await services.updateDebtById(id, undefined, undefined, undefined, undefined, null);
    expect((await services.getDebtById(id))?.accountId).toBeNull();
    await expect(services.updateDebtById(id, undefined, undefined, undefined, undefined, bank)).rejects.toBeInstanceOf(
      services.DebtAccountError,
    );
    await expect(
      services.createDebt(userId, 1, '', debtor, '2026-11-05T10:00:00', 'Lend', {accountId: bank}),
    ).rejects.toBeInstanceOf(services.DebtAccountError);
  });
});
