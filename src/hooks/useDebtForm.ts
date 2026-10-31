import {useCallback, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../redux/hooks';
import {selectUserId} from '../redux/slice/userIdSlice';
import {selectCurrencyCode} from '../redux/slice/currencyDataSlice';
import {fetchAllDebts, fetchDebtsByDebtor} from '../redux/slice/debtDataSlice';
import {createDebt, updateDebtById, type DebtData} from '../watermelondb/services';
import {createAmountSchema, expenseSchema} from '../i18n/validationSchema';
import {getISODateTime} from '../utils/dateUtils';
import {BORROW} from '../utils/debtType';
import {goBack} from '../utils/navigationUtils';
import {useReportSaveFailure} from './useReportFailure';

/** The debt being edited, as read from the database (M19). */
export type EditedDebt = DebtData;

/** State and save for the add/edit debt form; `editing` absent = add. */
export const useDebtForm = (debtorId: string, editing?: EditedDebt) => {
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [debtName, setDebtName] = useState(editing?.description ?? '');
  const [debtAmount, setDebtAmount] = useState(editing ? String(editing.amount) : '');
  const [createdAt, setCreatedAt] = useState(editing?.date ?? getISODateTime());
  const [debtsType, setDebtsType] = useState(editing?.type ?? BORROW);

  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const debtAmountError = hasInteracted ? amountSchema.safeParse(Number(debtAmount)).error?.issues || [] : [];
  const isValid = expenseSchema.safeParse(debtName).success && amountSchema.safeParse(Number(debtAmount)).success;

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
    void dispatch(fetchAllDebts());
    void dispatch(fetchDebtsByDebtor(debtorId));
    goBack();
  }, [isValid, editing, userId, debtAmount, debtName, debtorId, createdAt, debtsType, dispatch, reportSaveFailure]);

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
