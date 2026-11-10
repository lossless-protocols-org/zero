import {useCallback, useMemo, useState} from 'react';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {selectCurrencyCode} from '../../../store/slices/currencyDataSlice';
import {createDebt, updateDebtById} from '../../../data/services/debtService';
import type {DebtData} from '../../../domain/types';
import {createAmountSchema, expenseSchema} from '../../../i18n/validationSchema';
import {getISODateTime} from '../../../domain/dates';
import {BORROW} from '../../../domain/debtType';
import {goBack} from '../../../platform/navigationUtils';
import {useReportSaveFailure} from '../../../ui/hooks/useReportFailure';

/** The debt being edited, as read from the database (M19). */
export type EditedDebt = DebtData;

/** State and save for the add/edit debt form; `editing` absent = add. */
export const useDebtForm = (debtorId: string, editing?: EditedDebt) => {
  const userId = useAppSelector(selectUserId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [debtName, setDebtName] = useState(editing?.description ?? '');
  const [debtAmount, setDebtAmount] = useState(editing ? String(editing.amount) : '');
  const [createdAt, setCreatedAt] = useState(editing?.date ?? getISODateTime());
  const [debtsType, setDebtsType] = useState(editing?.type ?? BORROW);

  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const debtAmountError = hasInteracted ? amountSchema.issues(Number(debtAmount)) : [];
  const isValid = expenseSchema.isValid(debtName) && amountSchema.isValid(Number(debtAmount));

  const reportSaveFailure = useReportSaveFailure('debt.saveFailed');

  const save = useCallback(async () => {
    if (!isValid) {
      return;
    }
    try {
      if (editing) {
        await updateDebtById(editing.id, Number(debtAmount), debtName, createdAt, debtsType);
      } else {
        await createDebt(userId, Number(debtAmount), debtName, debtorId, createdAt, debtsType);
      }
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    goBack(); // the screen underneath reads its debts again on focus (useFreshWhileFocused)
  }, [isValid, editing, userId, debtAmount, debtName, debtorId, createdAt, debtsType, reportSaveFailure]);

  // Gates validation errors until the user leaves the field (see ExpenseEntry).
  const handleAmountBlur = useCallback(() => {
    setHasInteracted(true);
  }, []);

  return {
    debtName,
    setDebtName,
    debtAmount,
    setDebtAmount,
    createdAt,
    setCreatedAt,
    debtsType,
    setDebtsType,
    debtAmountError,
    isValid,
    handleAmountBlur,
    save,
  };
};
