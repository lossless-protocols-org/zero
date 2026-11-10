import {useCallback, useMemo, useRef} from 'react';
import type {RefundListRow} from '../../../domain/types';
import {useDeleteExpense} from './useDeleteExpense';
import {useUndoableDelete} from './useUndoableDelete';

/**
 * A spending list's swipe-delete with undo: which rows are waiting for undo,
 * which are gone, and the card height each undo strip takes. One timer per
 * row (createPendingDeletes, S7). Expenses and refunds both delete through
 * here; the refund ids tell the commit which table a row belongs to.
 *
 * The heights live in a ref, not state: writing one used to re-render every
 * visible row (renderItem depended on it, audit 2026-11-08 §8.3). The pending
 * set changes in the same tap, which redraws the strip that reads it.
 */
export const useListDeletion = ({
  targetMonth,
  targetDate,
  refunds,
  presentIds,
}: {
  targetMonth?: string;
  targetDate?: string;
  refunds: readonly RefundListRow[];
  presentIds: readonly string[];
}) => {
  const refundIds = useMemo(() => new Set(refunds.map(r => r.id)), [refunds]);
  const {commit, onCommitFailed} = useDeleteExpense({targetMonth, targetDate, refundIds});
  const {pendingIds, removedIds, schedule, undo} = useUndoableDelete({commit, onCommitFailed, presentIds});

  const undoHeights = useRef(new Map<string, number>());
  const remove = useCallback(
    (id: string, cardHeight: number) => {
      if (cardHeight > 0) {
        undoHeights.current.set(id, cardHeight);
      }
      schedule(id);
    },
    [schedule],
  );
  const undoHeightOf = useCallback((id: string): number | undefined => undoHeights.current.get(id), []);

  return {pendingIds, removedIds, remove, undo, undoHeightOf};
};
