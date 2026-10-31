declare const globalThis: {__DEV__: boolean};
globalThis.__DEV__ = true;

import {upgradeExportData} from '../export/upgrader';
import {CURRENT_EXPORT_VERSION, isEnvelopeTooNew, type ExportData} from '../export/format';

const makeMinimalData = (overrides: Partial<ExportData> = {}): ExportData => ({
  users: [{username: 'Test', email: 'test@example.com'}],
  categories: [{name: 'Food', icon: 'utensils', color: '#FF5733'}],
  expenses: [],
  debtors: [{title: 'Alice', icon: 'user', color: '#333', type: 'Person'}],
  debts: [],
  currencies: [{code: 'USD', name: 'US Dollar', symbol: '$'}],
  budgets: [],
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
}: ExportData): Omit<ExportData, 'budgets'> => ({
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
        categories: [{name: 'Food', icon: 'null', color: ''}],
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

describe('isEnvelopeTooNew', () => {
  it('refuses only versions above the current one', () => {
    expect(isEnvelopeTooNew(undefined)).toBe(false);
    expect(isEnvelopeTooNew(0)).toBe(false);
    expect(isEnvelopeTooNew(CURRENT_EXPORT_VERSION)).toBe(false);
    expect(isEnvelopeTooNew(CURRENT_EXPORT_VERSION + 1)).toBe(true);
  });
});
