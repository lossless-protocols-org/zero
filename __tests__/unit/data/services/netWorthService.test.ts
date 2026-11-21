/**
 * Balances, net worth and the articulation from the real database (R8, R15,
 * R16), checked against a replay of every row (harness/positionsOracle) and
 * against the identity itself: ΔNetWorth = Kept + revaluations + adjustments
 * + opening balances brought in + debts outside accounts, to the unit, after
 * 100 random sequences of the writes a user can make. Real LokiJS database.
 */
import fc from 'fast-check';
import {defaultAccountId} from '../../../../src/data/database/defaultAccount';
import {createAccount, setAccountArchived, updateAccount} from '../../../../src/data/services/accountService';
import {createTransfer, deleteTransfer} from '../../../../src/data/services/transferService';
import {acceptCheckpoint, deleteCheckpoint} from '../../../../src/data/services/checkpointService';
import {createRefund} from '../../../../src/data/services/refundService';
import {createIncome} from '../../../../src/data/services/incomeService';
import {createDebt} from '../../../../src/data/services/debtService';
import {
  articulate,
  getAccountBalance,
  getNetWorth,
  getUnexplained,
} from '../../../../src/data/services/netWorthService';
import {defaultIncomeCategoryId} from '../../../../src/data/database/defaultIncomeCategory';
import {oracleBalance, oracleKept, oracleNetWorth, readOracle} from '../../../harness/positionsOracle';
import * as services from '../../../harness/services';
import type {IsoDay} from '../../../../src/domain/types';

let userId = '';
let food = '';
let debtor = '';
let cash = '';

const units = (amount: number) => Math.round(amount * 10_000);
const day = (d: number): IsoDay => `2026-11-${String(d).padStart(2, '0')}` as IsoDay; // two digits, a real November day

const setUp = async () => {
  await services.deleteAllData();
  userId = await services.createUser('Asha', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  debtor = await services.createDebtor('Rohit', userId, 'user', 'Person', '#222222');
  cash = defaultAccountId(userId);
};

const account = (
  name: string,
  type: 'bank' | 'card' | 'investment',
  openingBalance = 0,
  openingDate: string | null = null,
) => createAccount(userId, {name, type, openingBalance, openingDate, icon: 'landmark', color: '#333333'});

/** Every account's balance and net worth on `asOf` agree with the replay; the articulation holds over (after, upTo]. */
const expectAgreement = async (asOf: string, from: string, to: string) => {
  const data = await readOracle();
  const balances = (await getNetWorth(userId, asOf)).accounts;
  for (const row of data.accounts) {
    const found = balances.find(b => b.accountId === row['id']);
    expect(units(found?.balance ?? NaN)).toBe(oracleBalance(data, row, asOf));
  }
  expect(units((await getNetWorth(userId, asOf)).total)).toBe(oracleNetWorth(data, asOf));
  const after = `2026-11-${String(Number(from.slice(8)) - 1).padStart(2, '0')}`;
  const result = await articulate(userId, from, to);
  expect(result.holds).toBe(true);
  expect(units(result.netWorthChange)).toBe(oracleNetWorth(data, to) - oracleNetWorth(data, after));
  expect(units(result.kept)).toBe(oracleKept(data, after, to));
};

beforeEach(setUp);

describe('one worked month', () => {
  it('balances, the four lines, and the articulation in words', async () => {
    const bank = await account('HDFC', 'bank', 10000, '2026-11-01');
    const card = await account('Amex', 'card');
    const fund = await account('Index fund', 'investment', 50000, '2026-11-01');
    await services.createExpense(userId, 'Lunch', 250, '', food, '2026-11-02T13:00:00');
    await services.createExpense(userId, 'Shoes', 3000, '', food, '2026-11-03T18:00:00', {accountId: card});
    await createIncome(userId, {
      categoryId: defaultIncomeCategoryId(userId),
      amount: 60000,
      date: day(5),
      note: '',
      accountId: bank,
    });
    await createTransfer(userId, {
      fromAccountId: bank,
      toAccountId: card,
      amount: 3000,
      date: day(6),
      note: 'card bill',
    });
    await createTransfer(userId, {fromAccountId: bank, toAccountId: fund, amount: 5000, date: day(7), note: 'SIP'});
    await createDebt(userId, 500, 'lent', debtor, '2026-11-08', 'Lend', {accountId: bank});
    await createDebt(userId, 200, 'cash in hand', debtor, '2026-11-09', 'Lend');
    // The fund is worth 57,400 on the 20th: a revaluation of +2,400.
    const reval = await acceptCheckpoint(userId, {accountId: fund, balance: 57400, date: day(20), note: ''});
    expect(reval.gap).toBe(2400);
    // The bank reads 61,150 on the 21st, 350 less than zero worked out: an adjustment.
    const adjust = await acceptCheckpoint(userId, {accountId: bank, balance: 61150, date: day(21), note: ''});
    expect(adjust.gap).toBe(-350);

    const worth = await getNetWorth(userId, day(30));
    expect(worth.lines).toEqual({cashAndBank: -250 + 61150, investments: 57400, owedToYou: 700, youOwe: 0});
    expect((await getAccountBalance(userId, card, day(30))).balance).toBe(0);
    expect((await getAccountBalance(userId, bank, day(30))).anchorDate).toBe(day(21));

    const words = await articulate(userId, day(1), day(30));
    expect(words).toEqual({
      netWorthChange: 60000 - 250 - 3000 + 2400 - 350 + 200 + 10000 + 50000,
      kept: 60000 - 3250,
      revaluations: 2400,
      adjustments: -350,
      openings: 60000,
      debtsOutsideAccounts: 200,
      holds: true,
    });
    await expectAgreement(day(30), day(1), day(30));
  });

  it('an archived account still counts; a deleted checkpoint gives the earlier anchor back', async () => {
    const bank = await account('HDFC', 'bank', 1000);
    const {id} = await acceptCheckpoint(userId, {accountId: bank, balance: 900, date: day(10), note: ''});
    await setAccountArchived(bank, true);
    expect((await getNetWorth(userId, day(30))).total).toBe(900);
    await deleteCheckpoint(id);
    expect((await getNetWorth(userId, day(30))).total).toBe(1000);
  });

  it('an entry added on or before a checkpoint’s day moves the gap, not the balance after it', async () => {
    const bank = await account('HDFC', 'bank', 1000);
    await acceptCheckpoint(userId, {accountId: bank, balance: 900, date: day(10), note: ''});
    await services.createExpense(userId, 'Forgotten', 100, '', food, '2026-11-05T10:00:00', {accountId: bank});
    expect((await getAccountBalance(userId, bank, day(30))).balance).toBe(900);
    const words = await articulate(userId, day(1), day(30));
    // The 100 is now explained by the expense; the checkpoint's own gap is 0.
    expect(words.adjustments).toBe(0);
    expect(words.holds).toBe(true);
  });

  it('refuses an account that is not the user’s', async () => {
    await expect(getAccountBalance(userId, 'nope', day(1))).rejects.toThrow();
  });
});

/** One write a user can make. Indices pick among what exists at that moment. */
type Op =
  | {kind: 'expense'; account: number; amount: number; day: number}
  | {kind: 'income'; account: number; amount: number; day: number}
  | {kind: 'refund'; expense: number; account: number; day: number}
  | {kind: 'transfer'; from: number; to: number; amount: number; day: number}
  | {kind: 'debt'; account: number; borrow: boolean; amount: number; day: number}
  | {kind: 'reconcile'; account: number; balance: number; day: number}
  | {kind: 'unreconcile'; index: number}
  | {kind: 'untransfer'; index: number}
  | {kind: 'editExpense'; expense: number; account: number; amount: number; day: number}
  | {kind: 'deleteExpense'; expense: number}
  | {kind: 'opening'; account: number; amount: number; day: number | null};

const amount = fc.integer({min: 1, max: 5_000_000}).map(cents => cents / 100);
const signedAmount = fc.integer({min: -5_000_000, max: 5_000_000}).map(cents => cents / 100);
const dayN = fc.integer({min: 1, max: 28});
const pick = fc.nat(10);

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({kind: fc.constant('expense' as const), account: pick, amount, day: dayN}),
  fc.record({kind: fc.constant('income' as const), account: pick, amount, day: dayN}),
  fc.record({kind: fc.constant('refund' as const), expense: pick, account: pick, day: dayN}),
  fc.record({kind: fc.constant('transfer' as const), from: pick, to: pick, amount, day: dayN}),
  fc.record({
    kind: fc.constant('debt' as const),
    account: fc.integer({min: -1, max: 10}),
    borrow: fc.boolean(),
    amount,
    day: dayN,
  }),
  fc.record({kind: fc.constant('reconcile' as const), account: pick, balance: signedAmount, day: dayN}),
  fc.record({kind: fc.constant('unreconcile' as const), index: pick}),
  fc.record({kind: fc.constant('untransfer' as const), index: pick}),
  fc.record({kind: fc.constant('editExpense' as const), expense: pick, account: pick, amount, day: dayN}),
  fc.record({kind: fc.constant('deleteExpense' as const), expense: pick}),
  fc.record({
    kind: fc.constant('opening' as const),
    account: pick,
    amount: signedAmount,
    day: fc.option(dayN, {nil: null}),
  }),
);

const at = <T>(list: readonly T[], index: number): T | undefined =>
  list.length === 0 ? undefined : list[index % list.length];

describe('100 random sequences of writes', () => {
  it('every balance matches the replay and the articulation holds to the unit', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(op, {minLength: 5, maxLength: 25}), dayN, dayN, async (ops, a, b) => {
        await setUp();
        const accounts = [
          cash,
          await account('HDFC', 'bank', 2500.5, '2026-11-03'),
          await account('Amex', 'card'),
          await account('Index fund', 'investment', 10000),
        ];
        const expenses: Array<{id: string; day: number}> = [];
        const checkpoints: string[] = [];
        const transfers: string[] = [];
        for (const step of ops) {
          switch (step.kind) {
            case 'expense': {
              const id = await services.createExpense(userId, 'x', step.amount, '', food, `${day(step.day)}T10:00:00`, {
                accountId: at(accounts, step.account),
              });
              expenses.push({id, day: step.day});
              break;
            }
            case 'income':
              await createIncome(userId, {
                categoryId: defaultIncomeCategoryId(userId),
                amount: step.amount,
                date: day(step.day),
                note: '',
                accountId: at(accounts, step.account),
              });
              break;
            case 'refund': {
              const expense = at(expenses, step.expense);
              if (expense) {
                // At most what is left of it, on or after its day; a refused one changes nothing either.
                await createRefund(expense.id, {
                  amount: 0.01,
                  date: `${day(Math.max(expense.day, step.day))}T12:00:00`,
                  note: '',
                  accountId: at(accounts, step.account),
                }).catch(() => undefined);
              }
              break;
            }
            case 'transfer': {
              const from = at(accounts, step.from);
              const to = at(accounts, step.to);
              if (from && to && from !== to) {
                transfers.push(
                  await createTransfer(userId, {
                    fromAccountId: from,
                    toAccountId: to,
                    amount: step.amount,
                    date: day(step.day),
                    note: '',
                  }),
                );
              }
              break;
            }
            case 'debt':
              await createDebt(userId, step.amount, '', debtor, day(step.day), step.borrow ? 'Borrow' : 'Lend', {
                accountId: step.account < 0 ? null : at(accounts, step.account),
              });
              break;
            case 'reconcile': {
              const target = at(accounts, step.account);
              if (target) {
                checkpoints.push(
                  (
                    await acceptCheckpoint(userId, {
                      accountId: target,
                      balance: step.balance,
                      date: day(step.day),
                      note: '',
                    })
                  ).id,
                );
              }
              break;
            }
            case 'unreconcile': {
              const id = at(checkpoints, step.index);
              if (id) {
                await deleteCheckpoint(id);
                checkpoints.splice(checkpoints.indexOf(id), 1);
              }
              break;
            }
            case 'untransfer': {
              const id = at(transfers, step.index);
              if (id) {
                await deleteTransfer(id);
                transfers.splice(transfers.indexOf(id), 1);
              }
              break;
            }
            case 'editExpense': {
              const expense = at(expenses, step.expense);
              if (expense) {
                await services
                  .updateExpenseById(
                    expense.id,
                    undefined,
                    undefined,
                    step.amount,
                    undefined,
                    `${day(step.day)}T09:00:00`,
                    at(accounts, step.account),
                  )
                  .then(() => {
                    expense.day = step.day;
                  })
                  .catch(() => undefined); // refused when it would undercut a refund: nothing changed
              }
              break;
            }
            case 'deleteExpense': {
              const expense = at(expenses, step.expense);
              if (expense) {
                await services.deleteExpenseById(expense.id);
                expenses.splice(expenses.indexOf(expense), 1);
              }
              break;
            }
            case 'opening': {
              const target = at(accounts, step.account);
              if (target) {
                await updateAccount(target, {
                  openingBalance: step.amount,
                  openingDate: step.day === null ? null : day(step.day),
                });
              }
              break;
            }
          }
        }
        const [from, to] = a <= b ? [a, b] : [b, a];
        await expectAgreement(day(to), day(Math.max(2, from)), day(to));
      }),
      {numRuns: 100},
    );
  }, 120_000);
});

describe('getUnexplained (Reports)', () => {
  it('is what balances set on cash and bank explained in the month; an investment’s value change is not counted', async () => {
    const bank = await account('HDFC', 'bank', 1000);
    const fund = await account('Fund', 'investment', 5000);
    await acceptCheckpoint(userId, {accountId: bank, balance: 900, date: day(10), note: ''});
    await acceptCheckpoint(userId, {accountId: fund, balance: 5400, date: day(12), note: ''});
    await acceptCheckpoint(userId, {accountId: cash, balance: 50, date: day(14), note: ''});
    expect(await getUnexplained(userId, day(1), day(30))).toBe(-100 + 50);
    // Another month: nothing set, nothing unexplained.
    expect(await getUnexplained(userId, '2026-10-01', '2026-10-31')).toBe(0);
  });
});
