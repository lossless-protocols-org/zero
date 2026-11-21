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
  transfers: [],
  checkpoints: [],
  recurring: [],
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

describe('v6 (3.0): transfers, checkpoints, a debt’s account', () => {
  const transfer = {fromAccount: 'Cash', toAccount: 'Savings', amount: 750, date: '2026-11-06', note: ''};
  const checkpoint = {account: 'Card', balance: -1200.5, date: '2026-11-08', gap: -30.25, kind: 'adjustment', note: ''};
  const withV6 = (patch: (d: ExportData) => void = () => {}) =>
    envelope(d => {
      d.transfers = [{...transfer}];
      d.checkpoints = [{...checkpoint, kind: 'adjustment'}];
      patch(d);
    });

  it('accepts them, a negative balance and gap included', () => {
    expect(validateExportEnvelope(withV6()).success).toBe(true);
  });

  it('a file without them (every file before v6) reads as having none', () => {
    const value = envelope(() => {}) as {data: Record<string, unknown>};
    delete value.data['transfers'];
    delete value.data['checkpoints'];
    const result = validateExportEnvelope(value);
    expect(result.success).toBe(true);
    expect(result.data?.data).toMatchObject({transfers: [], checkpoints: []});
  });

  it('refuses a transfer too small to be one money unit, as the transfer service does', () => {
    rejects(
      withV6(d => {
        d.transfers[0]!.amount = 1e-9;
      }),
      'data.transfers.0.amount',
    );
  });

  it('refuses a transfer of nothing, or dated with a time, naming the row', () => {
    rejects(
      withV6(d => {
        d.transfers[0]!.amount = 0;
      }),
      'data.transfers.0.amount',
    );
    rejects(
      withV6(d => {
        d.transfers[0]!.date = '2026-11-06T10:00:00';
      }),
      'data.transfers.0.date',
    );
  });

  it('refuses a checkpoint of an unknown kind or an absurd balance, naming the row', () => {
    rejects(
      withV6(d => {
        (d.checkpoints[0] as {kind: string}).kind = 'income';
      }),
      'data.checkpoints.0.kind',
    );
    rejects(
      withV6(d => {
        d.checkpoints[0]!.balance = -1e14;
      }),
      'data.checkpoints.0.balance',
    );
  });

  it('a refund may name its own account, and need not (omitted: its expense’s)', () => {
    const result = validateExportEnvelope(
      withV6(d => {
        d.expenses[0]!.refunds = [
          {amount: 1, date: '2026-08-02', note: '', account: 'Savings'},
          {amount: 1, date: '2026-08-02', note: ''},
        ];
      }),
    );
    expect(result.data?.data.expenses[0]?.refunds?.map(refund => refund.account)).toEqual(['Savings', undefined]);
  });

  it('a debt may name its account, and need not', () => {
    const result = validateExportEnvelope(
      withV6(d => {
        d.debts = [
          {amount: 1, description: '', debtor: {title: 'Rohit'}, date: '2026-11-05', type: 'Lend', account: 'Savings'},
          {amount: 1, description: '', debtor: {title: 'Rohit'}, date: '2026-11-05', type: 'Lend'},
        ];
      }),
    );
    expect(result.data?.data.debts.map(debt => debt.account)).toEqual(['Savings', undefined]);
  });
});

describe('v6 days are on the calendar', () => {
  it('refuses a transfer or checkpoint dated 31 February, which no balance could be read on', () => {
    const base6 = (patch: (d: ExportData) => void) =>
      envelope(d => {
        d.transfers = [{fromAccount: 'Cash', toAccount: 'Savings', amount: 1, date: '2026-11-06', note: ''}];
        d.checkpoints = [{account: 'Card', balance: 1, date: '2026-11-08', gap: 0, kind: 'adjustment', note: ''}];
        patch(d);
      });
    expect(validateExportEnvelope(base6(() => {})).success).toBe(true);
    rejects(
      base6(d => {
        d.transfers[0]!.date = '2026-02-31';
      }),
      'data.transfers.0.date',
    );
    rejects(
      base6(d => {
        d.checkpoints[0]!.date = '2026-11-31';
      }),
      'data.checkpoints.0.date',
    );
  });
});

describe('v6 recurring rules (P9)', () => {
  const rule = {
    ref: 'r1',
    target: 'expense' as const,
    title: 'Rent',
    category: {name: 'Fuel'},
    account: 'Cash',
    amount: 18000,
    cadence: 'monthly' as const,
    interval: 1,
    startDate: '2026-11-01',
    endDate: null,
    nextIndex: 2,
    remindDaysBefore: 1,
    active: true,
  };
  const withRule = (patch: Partial<typeof rule> | Record<string, unknown>) =>
    envelope(d => {
      d.recurring = [{...rule, ...patch} as ExportData['recurring'][number]]; // the patch is a rule row's own fields
    });

  it('accepts a rule, and one whose amount varies', () => {
    expect(validateExportEnvelope(withRule({})).success).toBe(true);
    expect(validateExportEnvelope(withRule({amount: null})).success).toBe(true);
  });

  it('refuses a next index no schedule could reach, and a rule that ends before it starts', () => {
    rejects(withRule({nextIndex: 1e9}), 'data.recurring.0.nextIndex');
    rejects(withRule({endDate: '2026-10-01'}), 'data.recurring.0.endDate');
  });
});
