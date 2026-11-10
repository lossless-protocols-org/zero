/**
 * Tickets: M18.
 */
import {buildImportPlan} from '../../../../../src/data/backup/import/planner';
import type {ExportData} from '../../../../../src/data/backup/export/validate';
import {validateExportEnvelope} from '../../../../../src/data/backup/export/validate';

const emptyData: ExportData = {
  users: [{username: 'Test', email: ''}],
  categories: [],
  expenses: [],
  currencies: [],
  debtors: [],
  debts: [],
  budgets: [],
  accounts: [],
  incomes: [],
};

/** The planned categories of one kind (every plan also holds the income category money in lands in). */
const namesOf = (plan: ReturnType<typeof buildImportPlan>, kind: 'expense' | 'income' = 'expense'): string[] =>
  plan.categories.filter(c => c.kind === kind).map(c => c.name);

const category = (
  name: string,
  overrides: Partial<ExportData['categories'][number]> = {},
): ExportData['categories'][number] => ({name, kind: 'expense', ...overrides});

describe('buildImportPlan — category dedupe', () => {
  it('collapses duplicate names to a single planned category (real backups contain "Fuel" twice)', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [
        category('Fuel', {icon: 'fuel', color: '#111111'}),
        category('Fuel', {icon: 'car', color: '#222222'}),
        category('Food'),
      ],
    });
    expect(namesOf(plan).sort()).toEqual(['Food', 'Fuel']);
    // first occurrence wins when statuses are equal
    expect(plan.categories.find(c => c.name === 'Fuel')?.icon).toBe('fuel');
    expect(plan.stats.categories).toBe(3); // Food, Fuel and the default income category
  });

  it('prefers the ACTIVE duplicate over an inactive one, regardless of order', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [
        category('Fuel', {categoryStatus: false, icon: 'dead'}),
        category('Fuel', {categoryStatus: true, icon: 'alive'}),
      ],
    });
    const fuel = plan.categories.find(c => c.name === 'Fuel');
    expect(fuel?.status).toBe(true);
    expect(fuel?.icon).toBe('alive');
  });

  it('preserves soft-delete status instead of resurrecting everything', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [category('Old', {categoryStatus: false})],
    });
    expect(plan.categories[0]?.status).toBe(false);
  });

  it('sanitizes poisoned icon/color values to defaults', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [category('Food', {icon: 'null', color: 'undefined'})],
    });
    expect(plan.categories[0]?.icon).toBe('');
    expect(plan.categories[0]?.color).toBe('#758595');
  });
});

describe('buildImportPlan — auto-create instead of dropping transactions', () => {
  it('auto-creates a missing category referenced by an expense (nothing is skipped)', () => {
    const plan = buildImportPlan({
      ...emptyData,
      expenses: [{title: 'Chai', amount: 20, category: {name: 'Unknown'}, date: '2026-07-01'}],
    });
    const unknown = plan.categories.find(c => c.name === 'Unknown');
    expect(unknown).toBeDefined();
    expect(unknown?.autoCreated).toBe(true);
    expect(unknown?.status).toBe(true);
    expect(plan.expenses).toHaveLength(1);
    expect(plan.stats.autoCreatedCategories).toBe(1);
  });

  it('auto-creates a missing debtor referenced by a debt', () => {
    const plan = buildImportPlan({
      ...emptyData,
      debts: [{amount: 500, description: 'Lunch', debtor: {title: 'Ghost'}, date: '2026-07-01', type: 'Borrow'}],
    });
    const ghost = plan.debtors.find(d => d.title === 'Ghost');
    expect(ghost?.autoCreated).toBe(true);
    expect(ghost?.type).toBe('Other');
    expect(plan.debts).toHaveLength(1);
    expect(plan.stats.autoCreatedDebtors).toBe(1);
  });

  it('does not auto-create when the referenced entity exists (even soft-deleted)', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [category('Food', {categoryStatus: false})],
      expenses: [{title: 'Chai', amount: 20, category: {name: 'Food'}, date: '2026-07-01'}],
    });
    expect(namesOf(plan)).toEqual(['Food']);
    expect(plan.stats.autoCreatedCategories).toBe(0);
  });
});

describe('buildImportPlan — expenses/debts are never deduplicated', () => {
  it('keeps identical expense rows (legit repeated transactions)', () => {
    const expense = {title: 'Chai', amount: 20, category: {name: 'Food'}, date: '2026-07-01'};
    const plan = buildImportPlan({
      ...emptyData,
      categories: [category('Food')],
      expenses: [expense, {...expense}],
    });
    expect(plan.expenses).toHaveLength(2);
  });

  it('normalizes missing expense description to empty string', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [category('Food')],
      expenses: [{title: 'Chai', amount: 20, category: {name: 'Food'}, date: '2026-07-01'}],
    });
    expect(plan.expenses[0]?.description).toBe('');
  });
});

describe('buildImportPlan — currencies and budgets', () => {
  it('dedupes currencies by code, first wins', () => {
    const plan = buildImportPlan({
      ...emptyData,
      currencies: [
        {code: 'INR', symbol: '₹', name: 'Indian Rupee'},
        {code: 'INR', symbol: 'Rs', name: 'Rupee (dup)'},
        {code: 'USD', symbol: '$', name: 'US Dollar'},
      ],
    });
    expect(plan.currencies).toHaveLength(2);
    expect(plan.currencies.find(c => c.code === 'INR')?.symbol).toBe('₹');
  });

  it('dedupes budgets by (month, budgetType) and keeps distinct months', () => {
    const plan = buildImportPlan({
      ...emptyData,
      budgets: [
        {amount: 60000, month: '2026-07', budgetType: 'monthly'},
        {amount: 99999, month: '2026-07', budgetType: 'monthly'},
        {amount: 50000, month: 'recurring:2026-01', budgetType: 'monthly'},
      ],
    });
    expect(plan.budgets).toHaveLength(2);
    expect(plan.budgets.find(b => b.month === '2026-07')?.amount).toBe(60000);
    expect(plan.stats.budgets).toBe(2);
  });
});

describe('buildImportPlan — empty payload', () => {
  it('returns an empty plan with zeroed stats', () => {
    const plan = buildImportPlan(emptyData);
    // Nothing but the income category every user has (it is a seed, not an auto-created fix).
    expect(plan.categories.map(c => [c.kind, c.name, c.status])).toEqual([['income', 'Income', true]]);
    expect(plan.stats).toEqual({
      categories: 1,
      debtors: 0,
      currencies: 0,
      expenses: 0,
      debts: 0,
      budgets: 0,
      // v5: the default account is always planned, even for an empty file.
      accounts: 1,
      refunds: 0,
      incomes: 0,
      autoCreatedCategories: 0,
      autoCreatedDebtors: 0,
      rejectedRefunds: 0,
      reassignedToDefaultAccount: 0,
      mergedIncomeCategories: 0,
      incomeCategoryKept: null,
    });
  });
});

describe('buildImportPlan — debt types', () => {
  it('normalises free-text debt types to Borrow | Lend (the schema folds them)', () => {
    const base = {
      users: [{username: 'u', email: ''}],
      categories: [],
      expenses: [],
      currencies: [],
      debtors: [{title: 'Ann'}],
      budgets: [],
    };
    const validated = validateExportEnvelope({
      key: 'k',
      data: {
        ...base,
        debts: [
          {amount: 1, description: 'a', debtor: {title: 'Ann'}, date: '2026-01-01', type: 'borrowing'},
          {amount: 2, description: 'b', debtor: {title: 'Ann'}, date: '2026-01-01', type: 'lend'},
          {amount: 3, description: 'c', debtor: {title: 'Ann'}, date: '2026-01-01', type: 'Loan'},
        ],
      },
    });
    if (!validated.data) {
      throw new Error(`should validate: ${validated.error}`);
    }
    const result = buildImportPlan(validated.data.data);
    expect(result.debts.map(d => d.type)).toEqual(['Borrow', 'Lend', 'Lend']);
  });
});

describe('buildImportPlan — category budgets', () => {
  const base: ExportData = {...emptyData, categories: [category('Food')]};

  it('keeps a per-category budget whose category is in the file', () => {
    const result = buildImportPlan({
      ...base,
      budgets: [
        {amount: 3000, month: 'recurring:2026-01', budgetType: 'monthly'},
        {amount: 500, month: '2026-10', budgetType: 'category', category: {name: 'Food'}},
      ],
    });
    expect(result.budgets).toEqual([
      {amount: 3000, month: 'recurring:2026-01', budgetType: 'monthly', categoryName: undefined},
      {amount: 500, month: '2026-10', budgetType: 'category', categoryName: 'Food'},
    ]);
  });

  it('drops a per-category budget whose category is missing or unnamed', () => {
    const result = buildImportPlan({
      ...base,
      budgets: [
        {amount: 500, month: '2026-10', budgetType: 'category', category: {name: 'Ghost'}},
        {amount: 700, month: '2026-10', budgetType: 'category'},
      ],
    });
    expect(result.budgets).toEqual([]);
  });

  it('keeps budgets for different categories in the same month apart', () => {
    const result = buildImportPlan({
      ...base,
      categories: [category('Food'), category('Fuel')],
      budgets: [
        {amount: 500, month: '2026-10', budgetType: 'category', category: {name: 'Food'}},
        {amount: 900, month: '2026-10', budgetType: 'category', category: {name: 'Fuel'}},
      ],
    });
    expect(result.budgets).toHaveLength(2);
  });
});

describe('buildImportPlan — v5: kinds, accounts, refunds, timestamps', () => {
  const NOW = 1_800_000_000_000;
  const expense = (overrides: Partial<ExportData['expenses'][number]> = {}): ExportData['expenses'][number] => ({
    title: 'Shoes',
    amount: 3000,
    description: '',
    category: {name: 'Shopping'},
    date: '2026-11-10T18:05:00',
    ...overrides,
  });

  it('keys categories by (kind, name): "Gift" may be both an expense and an income category', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [category('Gift'), category('Gift', {kind: 'income'})],
      expenses: [expense({category: {name: 'Gift'}})],
      incomes: [{amount: 100, date: '2026-11-07', category: {name: 'Gift'}, note: ''}],
    });
    expect(plan.categories.map(c => [c.kind, c.name])).toEqual([
      ['expense', 'Gift'],
      ['income', 'Gift'],
    ]);
    expect(plan.stats.autoCreatedCategories).toBe(0);
  });

  it('auto-creates a missing income category when the file has none', () => {
    const plan = buildImportPlan({
      ...emptyData,
      incomes: [{amount: 100, date: '2026-11-07', category: {name: 'Rent'}, note: ''}],
    });
    expect(plan.categories.find(c => c.name === 'Rent')).toMatchObject({kind: 'income', autoCreated: true});
    expect(plan.stats.mergedIncomeCategories).toBe(0);
  });

  it('Free keeps ONE income category: an edited backup with more is merged into the first, entries kept', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [
        category('Old', {kind: 'income', sortOrder: 5, categoryStatus: false}),
        category('Salary', {kind: 'income', sortOrder: 10}),
        category('Freelance', {kind: 'income', sortOrder: 20}),
        category('Food'),
      ],
      incomes: [
        {amount: 100, date: '2026-11-07', category: {name: 'Salary'}, note: ''},
        {amount: 50, date: '2026-11-08', category: {name: 'Freelance'}, note: 'client'},
        {amount: 25, date: '2026-11-09', category: {name: 'Bonus'}, note: ''},
      ],
    });
    // Active before archived, then the file's order: Salary stays.
    expect(plan.categories.filter(c => c.kind === 'income').map(c => c.name)).toEqual(['Salary']);
    expect(plan.categories.some(c => c.name === 'Food')).toBe(true);
    // A note of its own stays; an empty one takes the old category's name.
    expect(plan.incomes.map(i => [i.amount, i.categoryName, i.note])).toEqual([
      [100, 'Salary', ''],
      [50, 'Salary', 'client'],
      [25, 'Salary', 'Bonus'],
    ]);
    // Old, Freelance and the referenced-but-missing Bonus.
    expect(plan.stats).toMatchObject({mergedIncomeCategories: 3, incomeCategoryKept: 'Salary', incomes: 3});
  });

  it('a file with no income category (every backup before v5) gets the default, active', () => {
    const plan = buildImportPlan({...emptyData, categories: [category('Food')]});
    expect(plan.categories.filter(c => c.kind === 'income')).toEqual([
      {
        name: 'Income',
        kind: 'income',
        status: true,
        icon: 'coins',
        color: '#3D9960',
        sortOrder: 10,
        autoCreated: false,
      },
    ]);
    expect(plan.stats.autoCreatedCategories).toBe(0);
  });

  it('a lone archived income category is made active again: money in always has somewhere to land', () => {
    const plan = buildImportPlan({
      ...emptyData,
      categories: [category('Salary', {kind: 'income', categoryStatus: false})],
    });
    expect(plan.categories.filter(c => c.kind === 'income').map(c => [c.name, c.status])).toEqual([['Salary', true]]);
  });

  it('plans exactly one default account and puts entries naming none or an unknown one on it', () => {
    const plan = buildImportPlan({
      ...emptyData,
      currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
      expenses: [expense(), expense({account: 'Vanished card'})],
    });
    expect(plan.accounts).toEqual([expect.objectContaining({name: 'Cash', isDefault: true, currency: 'INR'})]);
    expect(plan.expenses.map(e => e.accountName)).toEqual(['Cash', 'Cash']);
    expect(plan.stats.reassignedToDefaultAccount).toBe(1);
  });

  it('keeps refunds that fit, in date order, and rejects the rest without dropping the expense', () => {
    const plan = buildImportPlan({
      ...emptyData,
      expenses: [
        expense({
          refunds: [
            {amount: 2000, date: '2026-11-25T10:00:00', note: 'second'},
            {amount: 1200, date: '2026-11-20T12:00:00', note: 'first'},
            {amount: 5, date: '2026-11-09T10:00:00', note: 'before the purchase'},
          ],
        }),
      ],
    });
    // 1200 then 2000 would exceed 3000: the later one goes; the one dated before the expense goes.
    expect(plan.expenses[0]?.refunds.map(r => r.note)).toEqual(['first']);
    expect(plan.stats).toMatchObject({expenses: 1, refunds: 1, rejectedRefunds: 2});
  });

  it('keeps file timestamps; derives missing ones from the date (as the migration does), updatedAt = createdAt', () => {
    const plan = buildImportPlan(
      {
        ...emptyData,
        expenses: [expense({createdAt: 5, updatedAt: 9}), expense()],
        debts: [{amount: 1, description: '', debtor: {title: 'Sam'}, date: '2026-08-03', type: 'Lend'}],
      },
      NOW,
    );
    expect(plan.expenses.map(e => [e.createdAt, e.updatedAt])).toEqual([
      [5, 9],
      [Date.UTC(2026, 10, 10, 18, 5, 0), Date.UTC(2026, 10, 10, 18, 5, 0)],
    ]);
    expect(plan.debts[0]?.createdAt).toBe(Date.UTC(2026, 7, 3));
  });
});
