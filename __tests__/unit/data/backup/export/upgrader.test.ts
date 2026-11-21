declare const globalThis: {__DEV__: boolean};
globalThis.__DEV__ = true;

import {upgradeExportData} from '../../../../../src/data/backup/export/upgrader';
import {CURRENT_EXPORT_VERSION, isEnvelopeTooNew, type ExportData} from '../../../../../src/data/backup/export/format';

const makeMinimalData = (overrides: Partial<ExportData> = {}): ExportData => ({
  users: [{username: 'Test', email: 'test@example.com'}],
  categories: [{name: 'Food', kind: 'expense', icon: 'utensils', color: '#FF5733'}],
  expenses: [],
  debtors: [{title: 'Alice', icon: 'user', color: '#333', type: 'Person'}],
  debts: [],
  currencies: [{code: 'USD', name: 'US Dollar', symbol: '$'}],
  budgets: [],
  accounts: [],
  incomes: [],
  transfers: [],
  checkpoints: [],
  recurring: [],
  ...overrides,
});

/** The data as a pre-v4 file has it: no budgets key at all. */
const withoutBudgets = ({
  users,
  categories,
  expenses,
  debtors,
  debts,
  currencies,
}: ExportData): Omit<ExportData, 'budgets' | 'accounts' | 'incomes' | 'transfers' | 'checkpoints' | 'recurring'> => ({
  users,
  categories,
  expenses,
  debtors,
  debts,
  currencies,
});

describe('upgradeExportData', () => {
  it('upgrades v0 (no version) to current version', () => {
    // A v0 file predates the budgets table.
    const data = withoutBudgets(
      makeMinimalData({
        categories: [{name: 'Food', kind: 'expense', icon: 'null', color: ''}],
        debtors: [{title: 'Alice', icon: undefined, color: 'null', type: 'undefined'}],
      }),
    );
    const result = upgradeExportData({key: 'test-key', data});

    expect(result.categories[0]?.icon).toBe('');
    expect(result.categories[0]?.color).toBe('#758595');
    expect(result.debtors[0]?.icon).toBe('');
    expect(result.debtors[0]?.color).toBe('#758595');
    expect(result.debtors[0]?.type).toBe('Person');
    expect(result.budgets).toEqual([]);
  });

  it('preserves valid data through upgrade chain', () => {
    const original = makeMinimalData();
    const result = upgradeExportData({
      key: 'test-key',
      version: 0,
      data: original,
    });

    expect(result.categories[0]?.name).toBe('Food');
    expect(result.categories[0]?.icon).toBe('utensils');
    expect(result.expenses).toEqual([]);
    expect(result.budgets).toEqual([]);
  });

  it('handles v3 export missing budgets field', () => {
    const data = withoutBudgets(makeMinimalData());

    const result = upgradeExportData({
      key: 'test-key',
      version: 3,
      data,
    });

    expect(result.budgets).toEqual([]);
  });

  it('does not modify a current-version export', () => {
    const data = makeMinimalData();
    const result = upgradeExportData({
      key: 'test-key',
      version: CURRENT_EXPORT_VERSION,
      data,
    });

    expect(result).toEqual(data);
  });

  it('preserves existing budgets in v4 export', () => {
    const budgets = [{userId: 'u1', categoryId: '', amount: 5000, month: '2025-07', budgetType: 'monthly'}];
    const data = makeMinimalData({budgets});

    const result = upgradeExportData({
      key: 'test-key',
      version: CURRENT_EXPORT_VERSION,
      data,
    });

    expect(result.budgets).toEqual(budgets);
  });
});

describe('v5 → v6 (3.0)', () => {
  it('a v5 file gains empty transfers and checkpoints, and its debts touch no account', () => {
    // A v5 file has no transfers or checkpoints key at all.
    const v5: Partial<ExportData> = makeMinimalData({
      debts: [{amount: 5, description: 'Lunch', debtor: {title: 'Rohit'}, date: '2026-11-05', type: 'Lend'}],
    });
    delete v5.transfers;
    delete v5.checkpoints;
    delete v5.recurring;
    // The upgrader's input allows exactly these lists to be missing; the rest are set above.
    const upgraded = upgradeExportData({
      key: 'k',
      version: 5,
      data: v5 as Parameters<typeof upgradeExportData>[0]['data'],
    });
    expect(upgraded.transfers).toEqual([]);
    expect(upgraded.checkpoints).toEqual([]);
    expect(upgraded.recurring).toEqual([]);
    expect(upgraded.debts.map(debt => debt.account)).toEqual([undefined]);
  });

  it('a v6 file’s rows pass through untouched', () => {
    const data = makeMinimalData({
      transfers: [{fromAccount: 'Cash', toAccount: 'Savings', amount: 1, date: '2026-11-06', note: ''}],
      checkpoints: [{account: 'Card', balance: -1, date: '2026-11-08', gap: 0, kind: 'revaluation', note: ''}],
    });
    expect(upgradeExportData({key: 'k', version: 6, data})).toEqual(data);
  });
});

describe('isEnvelopeTooNew', () => {
  it('refuses only versions above the current one', () => {
    expect(isEnvelopeTooNew(undefined)).toBe(false);
    expect(isEnvelopeTooNew(0)).toBe(false);
    expect(isEnvelopeTooNew(CURRENT_EXPORT_VERSION)).toBe(false);
    expect(isEnvelopeTooNew(CURRENT_EXPORT_VERSION + 1)).toBe(true);
  });
});
