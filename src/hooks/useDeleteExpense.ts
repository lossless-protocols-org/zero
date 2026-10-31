import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppDispatch} from '../redux/hooks';
import {refetchExpenses} from '../redux/slice/expenseDataSlice';
import {deleteExpenseById} from '../watermelondb/services';
import {useDialog} from '../context/DialogContext';
import {appendErrorLog} from '../utils/errorLog';

/** Deletes a transaction and refetches the month (or day) the list shows. */
export const useDeleteExpense = (scope: {targetMonth?: string; targetDate?: string}) => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const {targetMonth, targetDate} = scope;

  const commit = useCallback(
    async (expenseId: string) => {
      await deleteExpenseById(expenseId);
      try {
        await refetchExpenses(dispatch, {targetMonth, targetDate});
      } catch (refetchError) {
        // The row is gone; a failed refresh must not report the delete as failed.
        appendErrorLog(refetchError, false);
      }
    },
    [dispatch, targetMonth, targetDate],
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
