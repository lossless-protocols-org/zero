import type {ExpenseWithCategory, RefundListRow} from '../../domain/types';
import {toSpendRows} from '../../domain/periodMath';

/**
 * One row of a spending list (2.8): an expense, or a refund dated in the
 * period. The list's rows are signed spend rows (domain/periodMath), so a
 * refund's `amount` is negative here and day headers come out net.
 */
export type ListRow =
  | (ExpenseWithCategory & {kind: 'expense'; refunded: number})
  | (RefundListRow & {kind: 'refund'; description?: undefined});

export type ExpenseListRow = Extract<ListRow, {kind: 'expense'}>;
export type RefundListItemRow = Extract<ListRow, {kind: 'refund'}>;

/** Expenses (each with what came back on it) and the period's refunds, as one signed list. */
export const toListRows = (
  expenses: readonly ExpenseWithCategory[],
  refunds: readonly RefundListRow[],
  refundedByExpense: Readonly<Record<string, number>>,
): ListRow[] =>
  toSpendRows(
    expenses.map(e => ({...e, kind: 'expense' as const, refunded: refundedByExpense[String(e.id)] ?? 0})),
    refunds.map(r => ({...r, kind: 'refund' as const})),
  );
