import type {DebtType} from '../domain/types';

/**
 * Debt rows carry a free-text `type`. The app writes exactly 'Borrow' or
 * 'Lend', but imports accept any string, and before 2.7.0 every screen agreed
 * on how to treat the unknowns EXCEPT the per-person view, which filtered
 * `=== 'Borrow'` / `=== 'Lend'` and so showed an imported "borrowing" row in
 * no tab at all while still counting it in the totals.
 *
 * One rule, used everywhere: a row is a borrowing when its type says so;
 * everything else is a lending. Totals, lists and colours all read this.
 */
export const BORROW = 'Borrow' satisfies DebtType;
export const LEND = 'Lend' satisfies DebtType;

export const isBorrowType = (type: string | undefined | null): boolean =>
  typeof type === 'string' && type.trim().toLowerCase().startsWith('borrow');

/** Canonical form for storage: 'Borrow' | 'Lend'. Unknown spellings fold into the two. */
export const normalizeDebtType = (type: string | undefined | null): DebtType => (isBorrowType(type) ? BORROW : LEND);
