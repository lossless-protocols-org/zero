/**
 * Tickets: audit 2026-11-08 §3.1.
 */
import {debtorGroupOf, isBorrowType, netDebt, netDebtByDebtor, normalizeDebtType} from '../../../src/domain/debtType';

describe('debt type normalisation', () => {
  it.each(['Borrow', 'borrow', 'BORROW', 'Borrowing', ' borrowed '])('reads %p as a borrowing', value => {
    expect(isBorrowType(value)).toBe(true);
    expect(normalizeDebtType(value)).toBe('Borrow');
  });

  it.each(['Lend', 'lend', 'Lending', 'Loan', '', undefined, null])('folds %p into Lend', value => {
    expect(isBorrowType(value)).toBe(false);
    expect(normalizeDebtType(value)).toBe('Lend');
  });
});

describe('netDebt', () => {
  it('nets a settled person to exactly 0, where a float sum left 3.5e-15', () => {
    const rows = [
      {amount: 10.1, type: 'Borrow'},
      {amount: 20.2, type: 'Borrow'},
      {amount: 30.3, type: 'Lend'},
    ];
    expect(10.1 + 20.2 - 30.3).not.toBe(0); // the bug this replaces
    expect(netDebt(rows)).toBe(0);
  });

  it('is positive when you owe, negative when you are owed, and exact in every currency precision', () => {
    expect(
      netDebt([
        {amount: 500, type: 'Borrow'},
        {amount: 120.25, type: 'Lend'},
      ]),
    ).toBe(379.75);
    expect(
      netDebt([
        {amount: 0.1, type: 'Lend'},
        {amount: 0.2, type: 'Lend'},
      ]),
    ).toBe(-0.3);
    expect(
      netDebt([
        {amount: 1.001, type: 'Borrow'},
        {amount: 0.002, type: 'borrowing'},
      ]),
    ).toBe(1.003);
    expect(netDebt([])).toBe(0);
  });

  it('nets per person and skips rows without one', () => {
    const totals = netDebtByDebtor([
      {debtorId: 'a', amount: 10.1, type: 'Borrow'},
      {debtorId: 'a', amount: 20.2, type: 'Borrow'},
      {debtorId: 'a', amount: 30.3, type: 'Lend'},
      {debtorId: 'b', amount: 5, type: 'Lend'},
      {debtorId: null, amount: 99, type: 'Borrow'},
    ]);
    expect([...totals]).toEqual([
      ['a', 0],
      ['b', -5],
    ]);
  });
});

describe('debtorGroupOf', () => {
  it('a person is in people; every other account kind, known or not, is an account', () => {
    expect(debtorGroupOf('Person')).toBe('people');
    for (const kind of ['Credit Card', 'Emi', 'Loan', 'Other', 'Kirana tab', '']) {
      expect(debtorGroupOf(kind)).toBe('accounts');
    }
  });
});
