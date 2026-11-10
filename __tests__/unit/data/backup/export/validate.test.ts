/**
 * L7 (v2.7.1): the import validator accepted values the app can never
 * produce — negative or astronomically large amounts, dates and months in
 * any format. Such rows import, count towards totals and never match a month
 * query, which looks like lost data. Each rejection names the offending field.
 * Runs under jest and bun.
 *
 * Tickets: M20.
 */
import {validateExportEnvelope} from '../../../../../src/data/backup/export/validate';
import type {ExportData} from '../../../../../src/data/backup/export/format';

const base: ExportData = {
  users: [{username: 'Ada', email: ''}],
  categories: [{name: 'Fuel', kind: 'expense', categoryStatus: true, icon: 'car', color: '#111111'}],
  expenses: [{title: 'Petrol', amount: 40, description: '', category: {name: 'Fuel'}, date: '2026-08-01T10:00:00'}],
  currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
  debtors: [{title: 'Sam', debtorStatus: true, icon: 'user', type: 'Friend', color: '#444444'}],
  debts: [{amount: 500, description: 'lunch', debtor: {title: 'Sam'}, date: '2026-08-03', type: 'Lend'}],
  budgets: [
    {amount: 30000, month: 'recurring:2026-08', budgetType: 'monthly'},
    {amount: 0, month: '2026-09', budgetType: 'monthly'},
    {amount: 100, month: 'recurring', budgetType: 'monthly'},
  ],
  accounts: [],
  incomes: [],
};

const envelope = (patch: (d: ExportData) => void): unknown => {
  const data: ExportData = JSON.parse(JSON.stringify(base));
  patch(data);
  return {key: 'zeroAAAAAAAAAAAAAAAA', version: 4, data};
};

/** `field` is the zod path, e.g. data.expenses.0.amount → message names "expenses row 1, amount". */
const rejects = (value: unknown, field: string): void => {
  const result = validateExportEnvelope(value);
  expect(result.success).toBe(false);
  const [, table, index, ...rest] = field.split('.');
  expect(result.error).toContain(`${table} row ${Number(index) + 1}, ${rest.join('.')}:`);
  expect(result.issuePath).toEqual(field.split('.'));
};

describe('validateExportEnvelope', () => {
  it('accepts every shape the app writes, including legacy and tombstone budget rows', () => {
    expect(validateExportEnvelope(envelope(() => {})).success).toBe(true);
  });

  it('says plainly that a backup with no user profile cannot be restored', () => {
    const value = {key: 'zeroAAAAAAAAAAAAAAAA', version: 4, data: {...JSON.parse(JSON.stringify(base)), users: []}};
    const result = validateExportEnvelope(value);
    expect(result.success).toBe(false);
    expect(result.error).toBe('This backup has no user profile, so it cannot be restored.');
  });

  it('rejects impossible amounts, naming the field', () => {
    rejects(
      envelope(d => {
        d.expenses[0]!.amount = -1;
      }),
      'data.expenses.0.amount',
    ); // base has one expense
    rejects(
      envelope(d => {
        d.expenses[0]!.amount = 1e308;
      }),
      'data.expenses.0.amount',
    ); // base has one expense
    rejects(
      envelope(d => {
        d.debts[0]!.amount = Number.NaN;
      }),
      'data.debts.0.amount',
    ); // base has one debt
    rejects(
      envelope(d => {
        d.budgets[0]!.amount = -5;
      }),
      'data.budgets.0.amount',
    ); // base has three budgets
    expect(
      validateExportEnvelope(
        envelope(d => {
          d.expenses[0]!.amount = 0;
        }),
      ).success,
    ).toBe(true); // base has one expense
  });

  it('rejects dates and months that no month query could ever match, naming the field', () => {
    rejects(
      envelope(d => {
        d.expenses[0]!.date = 'bad';
      }),
      'data.expenses.0.date',
    ); // base has one expense
    rejects(
      envelope(d => {
        d.expenses[0]!.date = '12/03/2024';
      }),
      'data.expenses.0.date',
    ); // base has one expense
    rejects(
      envelope(d => {
        d.debts[0]!.date = '2024-1-3';
      }),
      'data.debts.0.date',
    ); // base has one debt
    rejects(
      envelope(d => {
        d.budgets[1]!.month = '12/2024';
      }),
      'data.budgets.1.month',
    ); // base has three budgets
    rejects(
      envelope(d => {
        d.budgets[0]!.month = 'recurring:2024';
      }),
      'data.budgets.0.month',
    ); // base has three budgets
    rejects(
      envelope(d => {
        d.expenses[0]!.date = '2024-13-45';
      }),
      'data.expenses.0.date',
    ); // base has one expense
    rejects(
      envelope(d => {
        d.expenses[0]!.date = '0000-00-00';
      }),
      'data.expenses.0.date',
    ); // base has one expense
    rejects(
      envelope(d => {
        d.budgets[1]!.month = '2024-13';
      }),
      'data.budgets.1.month',
    ); // base has three budgets
    expect(
      validateExportEnvelope(
        envelope(d => {
          d.expenses[0]!.date = '2024-02-29';
        }),
      ).success,
    ).toBe(true); // date-only, old exports
  });

  it('messages are readable, not raw zod', () => {
    expect(
      validateExportEnvelope(
        envelope(d => {
          d.expenses[0]!.amount = -1;
        }),
      ).error,
    ).toBe('expenses row 1, amount: must not be negative'); // base has one expense
    expect(
      validateExportEnvelope(
        envelope(d => {
          d.expenses[0]!.amount = 1e308;
        }),
      ).error,
    ).toBe('expenses row 1, amount: must be at most 10,000,000,000,000'); // base has one expense
    expect(validateExportEnvelope({key: 'x'}).error).toContain('data');
  });

  it('rejects absurd string lengths, naming the field', () => {
    rejects(
      envelope(d => {
        d.categories[0]!.name = 'x'.repeat(201);
      }),
      'data.categories.0.name',
    ); // base has one category
    rejects(
      envelope(d => {
        d.expenses[0]!.description = 'x'.repeat(201);
      }),
      'data.expenses.0.description',
    ); // base has one expense
    expect(
      validateExportEnvelope(
        envelope(d => {
          d.expenses[0]!.description = 'x'.repeat(200);
        }),
      ).success,
    ).toBe(true); // base has one expense
  });
});
