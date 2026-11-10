import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppDispatch} from '../../../store/hooks';
import {refetchExpenses} from '../../../store/slices/expenseDataSlice';
import {deleteExpenseById} from '../../../data/services/expenseService';
import {deleteRefund} from '../../../data/services/refundService';
import {useDialog} from '../../../ui/context/DialogContext';
import {appendErrorLog} from '../../../platform/errorLog';

/**
 * Deletes a row of a spending list. `refundIds` marks the rows that are
 * refunds (2.8): those delete the refund only; an expense deletes with its
 * refunds (refundService cascade). The list shows the result through its
 * screen's useFreshWhileFocused, whichever screen is focused when the undo
 * window closes; a failed delete changes nothing in the database, so that
 * path reads the list again itself.
 */
export const useDeleteExpense = (scope: {
  targetMonth?: string;
  targetDate?: string;
  refundIds?: ReadonlySet<string>;
}) => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const {targetMonth, targetDate, refundIds} = scope;

  const commit = useCallback(
    async (id: string) => {
      if (refundIds?.has(id)) {
        await deleteRefund(id);
      } else {
        await deleteExpenseById(id);
      }
    },
    [refundIds],
  );

  // Record why, refetch so the screen shows the truth, and tell the user.
  const onCommitFailed = useCallback(
    async (error: unknown) => {
      appendErrorLog(error, false);
      try {
        await refetchExpenses(dispatch, {targetMonth, targetDate});
      } catch (refetchError) {
        // Recovery must not throw out of a timer callback (unhandled rejection, no alert).
        appendErrorLog(refetchError, false);
      }
      await showAlert({type: 'error', message: t('transaction.deleteFailed')});
    },
    [dispatch, targetMonth, targetDate, showAlert, t],
  );

  return {commit, onCommitFailed};
};
