import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '../redux/hooks';
import {selectUserId} from '../redux/slice/userIdSlice';
import {fetchBudgetsByMonth} from '../redux/slice/budgetDataSlice';
import {
  clearBudgetForMonth,
  deleteMonthOverride,
  stopRecurringBudgetFrom,
  upsertBudget,
  type BudgetScope,
} from '../watermelondb/services/budgetService';
import type {BudgetMonthKey} from '../domain/types';
import {useDialog} from '../context/DialogContext';
import {useReportFailure} from './useReportFailure';

const scopeFor = (categoryId?: string): BudgetScope =>
  categoryId ? {budgetType: 'category', categoryId} : {budgetType: 'monthly'};

/**
 * Save / remove handlers for the budget sheet, shared by Reports and Settings.
 *
 * Both screens used to carry their own copies; the Reports copy had no error
 * handling at all, so a failed write closed the sheet and the budget was
 * simply not there afterwards, with nothing recorded anywhere (B5).
 *
 * Remove asks a question the old code never did: a recurring budget removed
 * from October used to vanish from every month, including the ones already
 * lived through. Now the user picks "this month only" or "from this month on",
 * and the past keeps its numbers (B3).
 */
const useBudgetActions = (yearMonth: string, monthLabel: string) => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const {showDialog} = useDialog();

  const reportFailure = useReportFailure('settings.budgetSaveFailed');

  const handleBudgetSave = useCallback(
    async (amount: number, everyMonth: boolean, categoryId?: string) => {
      if (!userId) {
        await reportFailure(
          new Error('Cannot save the budget: the user id is empty (user not loaded, or the user row is missing)'),
        );
        return;
      }
      const monthKey: BudgetMonthKey = everyMonth ? {kind: 'recurring', start: yearMonth} : {kind: 'month', yearMonth};
      try {
        await upsertBudget(userId, amount, monthKey, scopeFor(categoryId));
        // A month-only save on top of a recurring budget must beat it, which the
        // month-specific row does by itself. A recurring save from this month
        // must also replace any month-only override sitting on this month.
        if (everyMonth) {
          await deleteMonthOverride(userId, yearMonth, scopeFor(categoryId));
        }
      } catch (error) {
        // The first write may have landed; show what the database holds now.
        void dispatch(fetchBudgetsByMonth(yearMonth));
        await reportFailure(error);
        return;
      }
      void dispatch(fetchBudgetsByMonth(yearMonth));
    },
    [userId, yearMonth, dispatch, reportFailure],
  );

  const handleBudgetRemove = useCallback(
    async (isRecurring: boolean, categoryId?: string) => {
      if (!userId) {
        await reportFailure(
          new Error('Cannot save the budget: the user id is empty (user not loaded, or the user row is missing)'),
        );
        return;
      }
      let everyMonth = false;
      if (isRecurring) {
        // OK = from this month on; Cancel / backdrop = this month only — the
        // smaller change is the one a stray tap should land on.
        everyMonth = await showDialog({
          type: 'warning',
          message: t('sheets.removeRecurringPrompt', {month: monthLabel}),
          okLabel: t('sheets.removeFromThisMonth'),
          cancelLabel: t('sheets.removeThisMonthOnly'),
        });
      }
      try {
        if (everyMonth) {
          await stopRecurringBudgetFrom(userId, yearMonth, scopeFor(categoryId));
        } else {
          await clearBudgetForMonth(userId, yearMonth, scopeFor(categoryId));
        }
      } catch (error) {
        await reportFailure(error);
        return;
      }
      void dispatch(fetchBudgetsByMonth(yearMonth));
    },
    [userId, yearMonth, monthLabel, dispatch, showDialog, t, reportFailure],
  );

  return {handleBudgetSave, handleBudgetRemove};
};

export default useBudgetActions;
