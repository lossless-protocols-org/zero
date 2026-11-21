/**
 * Account sums through the service as jest runs it (LokiJS, the JavaScript
 * path): each day's sum is every row of the account after the anchor up to
 * that day, money in positive; other accounts and other users never count.
 * The SQLite path is held to the same answers in positionSums.bun.test.ts.
 */
import {flowSumsAt} from '../../../../src/data/services/positionSums';
import {createTransfer} from '../../../../src/data/services/transferService';
import {createDebt} from '../../../../src/data/services/debtService';
import {seedAccounts, type AccountsSeed} from '../../../harness/accountsSeed';
import * as services from '../../../harness/services';

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
});

it('adds every kind of row on the account, by day, after the anchor', async () => {
  await services.createExpense(seed.userId, 'Lunch', 250, '', seed.snacks, '2026-11-02T13:00:00', {
    accountId: seed.bank,
  });
  await services.createExpense(seed.userId, 'Elsewhere', 999, '', seed.snacks, '2026-11-02T13:00:00');
  await createTransfer(seed.userId, {
    fromAccountId: seed.bank,
    toAccountId: seed.fund,
    amount: 1000,
    date: '2026-11-03',
    note: '',
  });
  const debtor = await services.createDebtor('Rohit', seed.userId, 'user', 'Person', '#222222');
  await createDebt(seed.userId, 300, '', debtor, '2026-11-04', 'Borrow', {accountId: seed.bank});
  const u = (n: number) => n * 10_000;
  expect(await flowSumsAt(seed.userId, seed.bank, null, ['2026-11-01', '2026-11-02', '2026-11-04'])).toEqual([
    0,
    u(-250),
    u(-250 - 1000 + 300),
  ]);
  expect(await flowSumsAt(seed.userId, seed.bank, '2026-11-02', ['2026-11-04'])).toEqual([u(-1000 + 300)]);
  expect(await flowSumsAt(seed.userId, seed.fund, null, ['2026-11-30'])).toEqual([u(1000)]);
  expect(await flowSumsAt(seed.userId, seed.bank, null, [])).toEqual([]);
});
