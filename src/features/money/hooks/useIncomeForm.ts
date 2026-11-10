import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {selectCurrencyCode} from '../../../store/slices/currencyDataSlice';
import {selectActiveIncomeCategories} from '../../../store/slices/categoryDataSlice';
import {IncomeRuleError, createIncome, deleteIncome, updateIncome} from '../../../data/services/incomeService';
import {createAmountSchema, expenseDescriptionSchema} from '../../../i18n/validationSchema';
import {getISODateTime, isIsoDay, isYearMonth, toDayKey} from '../../../domain/dates';
import {goBack} from '../../../platform/navigationUtils';
import {appendErrorLog} from '../../../platform/errorLog';
import {useDialog} from '../../../ui/context/DialogContext';
import type {IncomeData} from '../../../domain/types';

/** Where a new income's date starts: today in the current month, else the 1st of the month being viewed. */
const initialPickerDate = (yearMonth: string | undefined): string => {
  const today = getISODateTime();
  // A month that is not one (a hand-typed zero://money/add?yearMonth=…) means "today", never an invalid date.
  if (!isYearMonth(yearMonth) || today.startsWith(yearMonth)) {
    return today;
  }
  return `${yearMonth}-01T09:00:00`;
};

/**
 * State and save for money in (R11: never from the expense plus). The date is
 * a day (income has no time of day); the picker works in datetimes, so only
 * its day is stored. Every user has an income category from the start (Free
 * has one), so the category is chosen for the user unless they have more.
 */
export const useIncomeForm = (editing?: IncomeData, yearMonth?: string) => {
  const {t} = useTranslation();
  const {showAlert, showDialog} = useDialog();
  const userId = useAppSelector(selectUserId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const categories = useAppSelector(selectActiveIncomeCategories);
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '');
  const [pickerDate, setPickerDate] = useState(editing ? `${editing.date}T09:00:00` : initialPickerDate(yearMonth));
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [saving, setSaving] = useState(false);

  // A new entry takes the first income category once they arrive.
  useEffect(() => {
    if (!categoryId && categories[0]) {
      setCategoryId(categories[0].id);
    }
  }, [categoryId, categories]);

  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const schemaIssues = amountSchema.issues(Number(amount));
  const amountErrors = hasInteracted ? schemaIssues.map(issue => issue.message) : [];
  const day = toDayKey(pickerDate);
  const isValid =
    schemaIssues.length === 0 && categoryId.length > 0 && isIsoDay(day) && expenseDescriptionSchema.isValid(note);

  const messageFor = useCallback(
    (error: unknown): string => {
      if (error instanceof IncomeRuleError && error.rule === 'notADay') {
        return t('money.notADay');
      }
      return t('money.saveFailed');
    },
    [t],
  );

  const save = useCallback(async () => {
    if (!isValid || saving || !isIsoDay(day)) {
      return;
    }
    setSaving(true);
    try {
      const input = {categoryId, amount: Number(amount), date: day, note: note.trim()};
      if (editing) {
        await updateIncome(editing.id, input);
      } else {
        await createIncome(userId, input);
      }
    } catch (error) {
      appendErrorLog(error, false);
      setSaving(false);
      await showAlert({type: 'error', message: messageFor(error)});
      return;
    }
    setSaving(false);
    goBack(); // Money reads its month again on focus (useFreshWhileFocused)
  }, [isValid, saving, day, categoryId, amount, note, editing, userId, showAlert, messageFor]);

  const remove = useCallback(async () => {
    if (!editing) {
      return;
    }
    const confirmed = await showDialog({type: 'warning', message: t('money.deleteConfirm')});
    if (!confirmed) {
      return;
    }
    try {
      await deleteIncome(editing.id);
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('money.deleteFailed')});
      return;
    }
    goBack();
  }, [editing, showDialog, showAlert, t]);

  return {
    categories,
    categoryId,
    setCategoryId,
    pickerDate,
    setPickerDate,
    amount,
    setAmount,
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
