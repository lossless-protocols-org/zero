/**
 * Turning one of the free app's card or loan tallies into a full card or
 * loan (approved model A2): the balance is carried across, the tally is
 * closed with one entry and keeps its history, and net worth counts the
 * debt once. Real LokiJS database.
 */
import {Q} from '@nozbe/watermelondb';
import {database} from '../../../../src/data/database/database';
import type {Debt} from '../../../../src/data/database/models/Debt';
import {moveTallyToAccount, NotATallyError} from '../../../../src/data/services/tallyService';
import {AccountRuleError, getAccountById} from '../../../../src/data/services/accountService';
import {createDebt} from '../../../../src/data/services/debtService';
import {getNetWorth} from '../../../../src/data/services/netWorthService';
import {netDebt} from '../../../../src/domain/debtType';
import type {IsoDay} from '../../../../src/domain/types';
import {seedAccounts, type AccountsSeed} from '../../../harness/accountsSeed';
import * as services from '../../../harness/services';

const TODAY = '2026-11-14' as IsoDay; // the tests' days are YYYY-MM-DD
const WHEN = `${TODAY}T10:00:00`;

let seed: AccountsSeed;
let tally: string;
const debtsOf = (debtorId: string) => database.get<Debt>('debts').query(Q.where('debtor_id', debtorId)).fetch();
const moveIt = (debtorId: string, accountClass: 'card' | 'loan' = 'loan') =>
  moveTallyToAccount(seed.userId, debtorId, accountClass, TODAY, WHEN, 'Moved to accounts', 'hand-coins');

beforeEach(async () => {
  seed = await seedAccounts();
  tally = await services.createDebtor('Navi loan', seed.userId, 'landmark', 'Loan', '#445566');
  await createDebt(seed.userId, 50_000, 'Loan taken', tally, '2026-06-01T10:00:00', 'Borrow');
  await createDebt(seed.userId, 9700, 'EMI', tally, '2026-07-05T10:00:00', 'Lend');
});

it('makes a loan owing what the tally nets to, closes the tally, and leaves net worth as it was', async () => {
  const before = await getNetWorth(seed.userId, TODAY);
  const accountId = await moveIt(tally);
  const account = await getAccountById(accountId);
  expect(account).toMatchObject({name: 'Navi loan', type: 'loan', openingBalance: -40_300, openingDate: TODAY});
  const debts = await debtsOf(tally);
  // The two entries it had, and one closing entry: its history stays readable.
  expect(debts).toHaveLength(3);
  expect(netDebt(debts)).toBe(0);
  expect(debts.find(debt => debt.description === 'Moved to accounts')).toMatchObject({
    amount: 40_300,
    type: 'Lend',
    accountId: null,
  });
  const after = await getNetWorth(seed.userId, TODAY);
  expect(after.total).toBe(before.total);
  expect(after.lines.youOwe).toBe(before.lines.youOwe);
});

it('a card tally becomes a card; a settled one moves with no closing entry', async () => {
  const settled = await services.createDebtor('Old card', seed.userId, 'credit-card', 'Credit Card', '#111111');
  const accountId = await moveIt(settled, 'card');
  expect(await getAccountById(accountId)).toMatchObject({type: 'card', openingBalance: 0});
  expect(await debtsOf(settled)).toHaveLength(0);
});

it('a tally the user is owed on starts in credit', async () => {
  const deposit = await services.createDebtor('Deposit', seed.userId, 'landmark', 'Other', '#111111');
  await createDebt(seed.userId, 3000, 'Paid in', deposit, '2026-08-01T10:00:00', 'Lend');
  const accountId = await moveIt(deposit);
  expect(await getAccountById(accountId)).toMatchObject({openingBalance: 3000});
  expect(netDebt(await debtsOf(deposit))).toBe(0);
});

it('refuses a person, another user, and a name an account already has; nothing is written', async () => {
  const person = await services.createDebtor('Riya', seed.userId, 'user', 'Person', '#222222');
  await expect(moveIt(person)).rejects.toBeInstanceOf(NotATallyError);
  await expect(
    moveTallyToAccount('someone-else', tally, 'loan', TODAY, WHEN, 'Moved', 'hand-coins'),
  ).rejects.toBeInstanceOf(NotATallyError);
  const clash = await services.createDebtor('hdfc', seed.userId, 'landmark', 'Loan', '#111111');
  await expect(moveIt(clash)).rejects.toMatchObject({rule: 'nameTaken'});
  await expect(moveIt(clash)).rejects.toBeInstanceOf(AccountRuleError);
  expect(await debtsOf(tally)).toHaveLength(2);
  expect((await getNetWorth(seed.userId, TODAY)).accounts).toHaveLength(4);
});
