/**
 * A backup that is valid JSON of the right shape but whose rows contradict
 * each other — edited by hand, or written by a buggy build — restores into a
 * consistent database, or the restore keeps exactly what it can and says what
 * it left out (audit 2026-11-08 §7.6). The file format references by name and
 * nests refunds in their expense, so the contradictions it can carry are:
 * refunds that do not fit their expense, two default accounts, entries naming
 * an account, category or income category the file does not have, a budget
 * on a category it does not have, duplicate names, and an archived income
 * category as the only one.
 *
 * validate → upgrade → importAllData → export again, on the LokiJS database.
 */
import {validateExportEnvelope} from '../../src/data/backup/export/validate';
import {upgradeExportData} from '../../src/data/backup/export/upgrader';
import {importAllData} from '../../src/data/services/importService';
import {getAllData} from '../../src/data/services/getService';
import * as services from '../harness/services';

const account = (name: string, isDefault: boolean) => ({
  name,
  type: 'cash',
  currency: 'INR',
  openingBalance: 0,
  openingDate: null,
  isDefault,
  accountStatus: true,
  sortOrder: 0,
  icon: 'wallet',
  color: '#111111',
});

const TAMPERED = {
  key: 'zeroAAAAAAAAAAAAAAA5',
  version: 5,
  data: {
    users: [{username: 'Eli', email: ''}],
    currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
    categories: [
      {name: 'Food', categoryStatus: false, icon: 'pizza', color: '#111111', kind: 'expense'},
      {name: 'Food', categoryStatus: true, icon: 'pizza', color: '#111111', kind: 'expense'},
      {name: 'Salary', categoryStatus: false, icon: 'coins', color: '#222222', kind: 'income'},
    ],
    accounts: [account('Wallet', true), account('Card', true)],
    expenses: [
      {
        title: 'Shoes',
        amount: 2000,
        category: {name: 'Food'},
        date: '2026-10-20T09:00:00',
        account: 'Card',
        refunds: [
          {amount: 500, date: '2026-10-21T10:00:00', note: 'fits'},
          {amount: 300, date: '2026-10-19T10:00:00', note: 'before the purchase'},
          {amount: 1600, date: '2026-10-22T10:00:00', note: 'more than is left'},
        ],
      },
      {title: 'Taxi', amount: 300, category: {name: 'Transport'}, date: '2026-10-21T22:00:00', account: 'Nowhere'},
    ],
    incomes: [{amount: 40_000, date: '2026-10-01', category: {name: 'Bonus'}, note: '', account: 'Ghost'}],
    debtors: [],
    debts: [],
    budgets: [{amount: 900, month: '2026-10', budgetType: 'category', category: {name: 'Groceries'}}],
  },
};

let restored: Awaited<ReturnType<typeof getAllData>>;
let rejectedRefunds = 0;

beforeAll(async () => {
  await services.deleteAllData();
  const validation = validateExportEnvelope(TAMPERED);
  if (!validation.success || !validation.data) {
    throw new Error(`the tampered file should still be valid: ${validation.error}`);
  }
  const result = await importAllData(upgradeExportData(validation.data));
  rejectedRefunds = result.stats.rejectedRefunds;
  restored = await getAllData();
});

const data = () => {
  if (!restored) {
    throw new Error('export failed');
  }
  return restored;
};

it('keeps every expense and the money in: nothing a user entered is dropped', () => {
  expect(
    data()
      .expenses.map(e => [e.title, e.amount])
      .sort(),
  ).toEqual([
    ['Shoes', 2000],
    ['Taxi', 300],
  ]);
  expect(data().incomes.map(i => i.amount)).toEqual([40_000]);
});

it('keeps only the refunds that fit their expense, and says how many it left out', () => {
  const shoes = data().expenses.find(e => e.title === 'Shoes');
  expect(shoes?.refunds?.map(r => [r.amount, r.note])).toEqual([[500, 'fits']]);
  expect(rejectedRefunds).toBe(2);
});

it('ends with exactly one default account, and puts entries naming an unknown one on it', () => {
  const defaults = data().accounts.filter(a => a.isDefault);
  expect(defaults).toHaveLength(1);
  const defaultName = defaults[0]?.name;
  const taxi = data().expenses.find(e => e.title === 'Taxi');
  expect(taxi?.account ?? defaultName).toBe(defaultName);
  expect(data().incomes[0]?.account ?? defaultName).toBe(defaultName);
});

it('creates the categories entries name but the file lacks, once each, of the right kind', () => {
  const byKind = (kind: string) =>
    data()
      .categories.filter(c => c.kind === kind)
      .map(c => c.name)
      .sort();
  expect(byKind('expense')).toEqual(['Food', 'Transport']);
  expect(byKind('income')).toContain('Bonus');
});

it('drops a category budget whose category the file lacks: a limit on nothing (planner rule)', () => {
  expect(data().budgets).toEqual([]);
});

it('keeps the active one of two same-named categories', () => {
  const food = data().categories.filter(c => c.name === 'Food');
  expect(food.map(c => c.categoryStatus)).toEqual([true]);
});

it('leaves exactly one active income category, so money in always has somewhere to land', () => {
  const activeIncome = data().categories.filter(c => c.kind === 'income' && c.categoryStatus !== false);
  expect(activeIncome).toHaveLength(1);
});
