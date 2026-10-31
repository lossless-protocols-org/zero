import {isBorrowType, normalizeDebtType} from '../debtType';

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
