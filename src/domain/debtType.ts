import type {DebtType} from './types';
import {fromMoneyUnits, toMoneyUnits} from './money';

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

interface DebtRow {
  amount: number;
  type?: string | null;
}

const signedUnits = (row: DebtRow): number =>
  isBorrowType(row.type) ? toMoneyUnits(row.amount) : -toMoneyUnits(row.amount);

/**
 * What you owe minus what you are owed: positive means you owe, negative means
 * you are owed, exactly 0 means settled. Added in money units, never floats:
 * 10.10 + 20.20 borrowed against 30.30 lent is 0 here, while the float sum is
 * 3.5e-15, which read as "You owe ₹0" and let "Mark as paid" write a ₹0 row
 * (audit 2026-11-08 §3.1). The one way any screen nets debts.
 */
export const netDebt = (rows: ReadonlyArray<DebtRow>): number =>
  fromMoneyUnits(rows.reduce((units, row) => units + signedUnits(row), 0));

/** netDebt per person or account, for lists. */
export const netDebtByDebtor = (rows: ReadonlyArray<DebtRow & {debtorId?: string | null}>): Map<string, number> => {
  const units = new Map<string, number>();
  for (const row of rows) {
    if (row.debtorId) {
      units.set(row.debtorId, (units.get(row.debtorId) ?? 0) + signedUnits(row));
    }
  }
  return new Map([...units].map(([id, u]) => [id, fromMoneyUnits(u)]));
};

/**
 * A debtor's account kind is free text: 'Person', 'Credit Card', 'Emi',
 * 'Loan', 'Other' (assets/jsons/defaultDebtAccounts.json), or whatever a
 * backup holds, so it stays a string. The Money tab splits debtors in two:
 * people, and every other kind as accounts. That split is the union (audit
 * 2026-11-08, Appendix A: the tab state was a bare 'Person' | 'Other' string).
 */
const PERSON_DEBTOR_TYPE = 'Person';

export type DebtorGroup = 'people' | 'accounts';

export const debtorGroupOf = (type: string): DebtorGroup => (type === PERSON_DEBTOR_TYPE ? 'people' : 'accounts');
