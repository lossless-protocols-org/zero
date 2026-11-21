/**
 * The held-and-owed model's proof (ZERO_3.0_TO_FIX_APPROVED.md A2): net worth
 * moves only when the user earns, spends, or a value changes. Everything else
 * is money changing sides. Each row of the approved table is one event
 * written through the real services, read back through getNetWorth and the
 * month's summary. Real LokiJS database.
 */
import {createAccount, updateAccount} from '../../src/data/services/accountService';
import {createTransfer} from '../../src/data/services/transferService';
import {createIncome} from '../../src/data/services/incomeService';
import {createDebt} from '../../src/data/services/debtService';
import {acceptCheckpoint} from '../../src/data/services/checkpointService';
import {getNetWorth} from '../../src/data/services/netWorthService';
import {getMonthSummary} from '../../src/data/services/periodSummaryService';
import {defaultIncomeCategoryId} from '../../src/data/database/defaultIncomeCategory';
import {periodFor} from '../../src/domain/period';
import type {IsoDay} from '../../src/domain/types';
import {seedAccounts, type AccountsSeed} from '../harness/accountsSeed';
import * as services from '../harness/services';

const DAY = '2026-11-10' as IsoDay; // the tests' days are YYYY-MM-DD
const AT = `${DAY}T12:00:00`;
const NOVEMBER = periodFor('2026-11');

interface Reading {
  held: number;
  owed: number;
  net: number;
  spent: number;
}

let seed: AccountsSeed;
let loan: string;
let friend: string;

const read = async (): Promise<Reading> => {
  const worth = await getNetWorth(seed.userId, DAY);
  const {lines} = worth;
  return {
    held: lines.cashAndBank + lines.investments,
    owed: lines.youOwe - lines.owedToYou,
    net: worth.total,
    spent: (await getMonthSummary(seed.userId, NOVEMBER)).spent,
  };
};

/** What one event changed: [held, owed, net worth, spent]. */
const changeBy = async (event: () => Promise<unknown>): Promise<[number, number, number, number]> => {
  const before = await read();
  await event();
  const after = await read();
  return [after.held - before.held, after.owed - before.owed, after.net - before.net, after.spent - before.spent];
};

const expense = (amount: number, accountId: string) =>
  services.createExpense(seed.userId, 'Thing', amount, '', seed.snacks, AT, {accountId});
const move = (fromAccountId: string, toAccountId: string, amount: number) =>
  createTransfer(seed.userId, {fromAccountId, toAccountId, amount, date: DAY, note: ''});

beforeEach(async () => {
  seed = await seedAccounts(); // cash 0, bank 5,000, card owing 1,500, fund 9,000
  loan = await createAccount(seed.userId, {
    name: 'Bike loan',
    type: 'loan',
    openingBalance: -20_000,
    openingDate: null,
    icon: 'hand-coins',
    color: '',
  });
  friend = await services.createDebtor('Riya', seed.userId, 'user', 'Person', '#222222');
});

it('starts as held less owed: a loan is owed, exactly as a card', async () => {
  // Held 5,000 + 9,000; owed 1,500 on the card and 20,000 on the loan.
  expect(await read()).toEqual({held: 14_000, owed: 21_500, net: -7500, spent: 0});
});

describe('each event of the approved table: [held, owed, net worth, spent]', () => {
  it('buy with bank or cash: held falls, net worth falls, it is spending', async () => {
    expect(await changeBy(() => expense(300, seed.bank))).toEqual([-300, 0, -300, 300]);
  });

  it('buy with a card: owed rises, net worth falls, it is spending', async () => {
    expect(await changeBy(() => expense(300, seed.card))).toEqual([0, 300, -300, 300]);
  });

  it('pay the card bill: held and owed both fall, nothing else moves', async () => {
    expect(await changeBy(() => move(seed.bank, seed.card, 1000))).toEqual([-1000, -1000, 0, 0]);
  });

  it('take a loan: held and owed both rise, nothing else moves', async () => {
    expect(await changeBy(() => move(loan, seed.bank, 4000))).toEqual([4000, 4000, 0, 0]);
  });

  it('pay an EMI: held and owed both fall, nothing else moves', async () => {
    expect(await changeBy(() => move(seed.bank, loan, 2000))).toEqual([-2000, -2000, 0, 0]);
  });

  it('interest or a fee, charged to the card or the loan: owed rises, net worth falls, it is spending', async () => {
    expect(await changeBy(() => expense(450, loan))).toEqual([0, 450, -450, 450]);
    expect(await changeBy(() => expense(120, seed.card))).toEqual([0, 120, -120, 120]);
  });

  it('salary arrives: held and net worth rise, it is not spending', async () => {
    const salary = () =>
      createIncome(seed.userId, {
        categoryId: defaultIncomeCategoryId(seed.userId),
        amount: 50_000,
        date: DAY,
        note: 'Salary',
        accountId: seed.bank,
      });
    expect(await changeBy(salary)).toEqual([50_000, 0, 50_000, 0]);
  });

  it('lend a friend money: held falls and so does owed (they owe you), net worth stays', async () => {
    const lend = () => createDebt(seed.userId, 700, 'lent', friend, AT, 'Lend', {accountId: seed.bank});
    expect(await changeBy(lend)).toEqual([-700, -700, 0, 0]);
  });

  it('a friend uses your card: you owe the card and are owed by the friend, so nothing moves', async () => {
    const lend = () => createDebt(seed.userId, 900, 'dinner', friend, AT, 'Lend', {accountId: seed.card});
    expect(await changeBy(lend)).toEqual([0, 0, 0, 0]);
    const {lines} = await getNetWorth(seed.userId, DAY);
    expect([lines.youOwe, lines.owedToYou]).toEqual([1500 + 900 + 20_000, 900]);
  });

  it('move money into savings: held is unchanged, as is everything else', async () => {
    expect(await changeBy(() => move(seed.bank, seed.fund, 1500))).toEqual([0, 0, 0, 0]);
  });

  it('an investment changes value: held and net worth move, never spending', async () => {
    const revalue = () => acceptCheckpoint(seed.userId, {accountId: seed.fund, balance: 9600, date: DAY, note: ''});
    expect(await changeBy(revalue)).toEqual([600, 0, 600, 0]);
  });
});

it('a card paid beyond nothing is owed to you by the lender, never money in hand', async () => {
  await move(seed.bank, seed.card, 2000); // the card owed 1,500
  const {lines} = await getNetWorth(seed.userId, DAY);
  expect(lines.cashAndBank).toBe(3000);
  expect(lines.owedToYou).toBe(500);
  expect(lines.youOwe).toBe(20_000);
});

it('no sum reads the kind: giving every account one changes no figure', async () => {
  const before = await getNetWorth(seed.userId, DAY);
  for (const [index, account] of before.accounts.entries()) {
    await updateAccount(account.accountId, {kind: `Kind ${index}`});
  }
  const after = await getNetWorth(seed.userId, DAY);
  expect(after.total).toBe(before.total);
  expect(after.lines).toEqual(before.lines);
  expect(after.accounts.map(a => a.balance)).toEqual(before.accounts.map(a => a.balance));
  expect(after.accounts.map(a => a.kind)).toEqual(before.accounts.map((_, index) => `Kind ${index}`));
});
