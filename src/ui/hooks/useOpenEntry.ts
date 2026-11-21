import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {getRuleById} from '../../data/services/recurringService';
import {appendErrorLog} from '../../platform/errorLog';
import {navigate} from '../../platform/navigationUtils';
import {useDialog} from '../context/DialogContext';
import {useProFeature} from './useProFeature';

/**
 * Opening an entry to edit it (3.0, P9). An entry a recurring rule made asks
 * first, with Pro: "change just this entry, or the recurring entry it came
 * from?". Just this one is the answer a stray tap on the backdrop gives, so
 * nothing about the rule changes by accident. Without Pro, or for an entry
 * entered by hand, or one whose rule is gone, it opens the entry directly.
 */
export const useOpenEntry = () => {
  const {t} = useTranslation();
  const {showDialog} = useDialog();
  const pro = useProFeature('recurring');

  const openRuleOr = useCallback(
    async (recurringId: string | null | undefined, openEntry: () => void) => {
      if (!pro || !recurringId) {
        openEntry();
        return;
      }
      try {
        if ((await getRuleById(recurringId)) === null) {
          openEntry();
          return;
        }
      } catch (error) {
        appendErrorLog(error, false);
        openEntry();
        return;
      }
      const rule = await showDialog({
        type: 'info',
        message: t('recurring.editWhich'),
        okLabel: t('recurring.editRule'),
        cancelLabel: t('recurring.editThis'),
      });
      if (rule) {
        navigate('RuleFormScreen', {ruleId: recurringId});
      } else {
        openEntry();
      }
    },
    [pro, showDialog, t],
  );

  const openExpense = useCallback(
    (expense: {id: string; recurringId?: string | null}) =>
      openRuleOr(expense.recurringId, () => navigate('UpdateTransactionScreen', {expenseId: expense.id})),
    [openRuleOr],
  );
  const openIncome = useCallback(
    (income: {id: string; recurringId?: string | null}) =>
      openRuleOr(income.recurringId, () => navigate('UpdateIncomeScreen', {incomeId: income.id})),
    [openRuleOr],
  );

  return {openExpense, openIncome, showsRepeat: pro};
};
