import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../store/hooks';
import {selectCurrencyCode} from '../../../store/slices/currencyDataSlice';
import type {ExpenseWithCategory} from '../../../domain/types';
import {
  RefundRuleError,
  createRefund,
  deleteRefund,
  getRefundsByExpense,
  updateRefund,
} from '../../../data/services/refundService';
import {createAmountSchema} from '../../../i18n/validationSchema';
import {getISODateTime} from '../../../domain/dates';
import {refundableRemainder, netSpent} from '../../../domain/periodMath';
import {goBack} from '../../../platform/navigationUtils';
import {appendErrorLog} from '../../../platform/errorLog';
import {useDialog} from '../../../ui/context/DialogContext';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import type {RefundData} from '../../../domain/types';

/**
 * State and save for "Got money back" on one expense (R12). `refundId` edits
 * an existing refund. The remainder shown and checked here leaves the
 * edited refund out; the service checks the same bounds again on write.
 */
export const useRefundForm = (expense: ExpenseWithCategory, refundId?: string) => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const {showAlert, showDialog} = useDialog();
  const currencyCode = useAppSelector(selectCurrencyCode);
  const [refunds, setRefunds] = useState<RefundData[] | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getISODateTime());
  const [note, setNote] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    getRefundsByExpense(expense.id)
      .then(list => {
        if (!live) {
          return;
        }
        setRefunds(list);
        const editing = refundId ? list.find(r => r.id === refundId) : undefined;
        if (editing) {
          setAmount(String(editing.amount));
          setDate(editing.date);
          setNote(editing.note);
        }
      })
      .catch((error: unknown) => {
        appendErrorLog(error, false);
        if (live) {
          setRefunds([]);
        }
      });
    return () => {
      live = false;
    };
  }, [expense.id, refundId]);

  const editing = refunds?.find(r => r.id === refundId);
  const others = useMemo(() => (refunds ?? []).filter(r => r.id !== refundId), [refunds, refundId]);
  const remainder = refundableRemainder(expense.amount, netSpent(others, []));

  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const value = Number(amount);
  const schemaIssues = amountSchema.issues(value);
  const exceeds = Number.isFinite(value) && value > remainder;
  const amountErrors = hasInteracted
    ? [
        ...schemaIssues.map(issue => issue.message),
        ...(exceeds ? [t('refund.exceedsExpense', {amount: formatAmount(remainder)})] : []),
      ]
    : [];
  // Positive and within the currency's limits (schema), and no more than is left.
  const isValid = refunds !== null && schemaIssues.length === 0 && !exceeds;

  const messageFor = useCallback(
    (error: unknown): string => {
      if (error instanceof RefundRuleError) {
        switch (error.rule) {
          case 'exceedsExpense':
            return t('refund.exceedsExpense', {amount: formatAmount(remainder)});
          case 'beforeExpense':
            return t('refund.beforeExpense');
          case 'amountNotPositive':
            return t('refund.amountNotPositive');
          default:
            return t('refund.saveFailed');
        }
      }
      return t('refund.saveFailed');
    },
    [t, formatAmount, remainder],
  );

  const save = useCallback(async () => {
    if (!isValid || saving) {
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateRefund(editing.id, {amount: value, date, note: note.trim()});
      } else {
        await createRefund(expense.id, {amount: value, date, note: note.trim()});
      }
    } catch (error) {
      if (!(error instanceof RefundRuleError)) {
        appendErrorLog(error, false);
      }
      setSaving(false);
      await showAlert({type: 'error', message: messageFor(error)});
      return;
    }
    setSaving(false);
    goBack();
  }, [isValid, saving, editing, value, date, note, expense.id, showAlert, messageFor]);

  const remove = useCallback(async () => {
    if (!editing) {
      return;
    }
    const confirmed = await showDialog({
      type: 'warning',
      message: t('refund.deleteConfirm', {amount: formatAmount(editing.amount)}),
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteRefund(editing.id);
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('refund.deleteFailed')});
      return;
    }
    goBack();
  }, [editing, showDialog, showAlert, t, formatAmount]);

  return {
    loaded: refunds !== null,
    editing: Boolean(editing),
    remainder,
    amount,
    setAmount,
    date,
    setDate,
    note,
    setNote,
    amountErrors,
    onAmountBlur: () => setHasInteracted(true),
    isValid,
    saving,
    save,
    remove,
  };
};
