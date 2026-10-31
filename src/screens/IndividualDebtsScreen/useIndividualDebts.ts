import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {fetchDebtsByDebtor, selectDebtData, fetchAllDebts} from '../../redux/slice/debtDataSlice';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {goBack, navigate} from '../../utils/navigationUtils';
import {createDebt, deleteDebtById, deleteDebtorById} from '../../watermelondb/services';
import {RouteProp, useFocusEffect} from '@react-navigation/native';
import type {HomeStackParamList} from '../../navigation/types';
import {BORROW, LEND, isBorrowType} from '../../utils/debtType';
import {getISODateTime} from '../../utils/dateUtils';
import {appendErrorLog} from '../../utils/errorLog';
import {fetchDebtors, selectDebtorData} from '../../redux/slice/debtorDataSlice';
import {sortByDateDesc} from '../../utils/dateUtils';
import {DebtData as DebtDocType} from '../../watermelondb/services';
import {
  clearIndividualDebtor,
  fetchIndividualDebtor,
  selectIndividualDebtorData,
} from '../../redux/slice/individualDebtorDataSlice';
import {useDialog} from '../../context/DialogContext';
import {useTranslation} from 'react-i18next';
import {SETTLEMENT_DESCRIPTION} from '../../i18n/displayNames';

export type IndividualDebtsScreenRouteProp = RouteProp<HomeStackParamList, 'IndividualDebtsScreen'>;

const useIndividualDebts = (route: IndividualDebtsScreenRouteProp) => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const {showDialog, showAlert} = useDialog();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const userId = useAppSelector(selectUserId);
  const [refreshing, setRefreshing] = useState(false);
  const individualDebts = useAppSelector(selectDebtData);
  const {debtorId} = route.params;
  const individualDebtor = useAppSelector(selectIndividualDebtorData);
  // The store is cleared on focus so the previous debtor never flashes; until
  // the fetch lands, the Debts list (already loaded) has the same row (M19).
  const listedDebtor = useAppSelector(state => selectDebtorData(state).find(debtor => debtor.id === debtorId));
  const debtorName = individualDebtor?.title ?? listedDebtor?.title ?? '';

  const {sortedBorrowings, sortedLendings, totalBorrowings, totalLendings, debtorTotal} = useMemo(() => {
    const sorted = sortByDateDesc(individualDebts);
    // One rule shared with the Debts tab and totals: Borrow, or else Lend.
    // Filtering on exact strings here left imported rows with other spellings
    // counted in the totals but shown in neither tab (B7).
    const borrowings = sorted.filter((debt: DebtDocType) => isBorrowType(debt.type));
    const lendings = sorted.filter((debt: DebtDocType) => !isBorrowType(debt.type));

    const borrowingsTotal = borrowings.reduce((total: number, debt: DebtDocType) => total + debt.amount, 0);
    const lendingsTotal = lendings.reduce((total: number, debt: DebtDocType) => total + debt.amount, 0);

    return {
      sortedBorrowings: borrowings,
      sortedLendings: lendings,
      totalBorrowings: borrowingsTotal,
      totalLendings: lendingsTotal,
      debtorTotal: borrowingsTotal - lendingsTotal,
    };
  }, [individualDebts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const handleEditDebt = useCallback((debtId: string) => {
    navigate('UpdateDebtScreen', {debtId});
  }, []);

  const handleDeleteDebt = useCallback(
    async (debtId: string) => {
      // Unlike transactions, a deleted debt has no undo window — confirm first.
      const confirmed = await showDialog({
        type: 'warning',
        message: t('debt.deleteConfirm'),
      });
      if (!confirmed) {
        return;
      }
      try {
        await deleteDebtById(debtId);
      } catch (error) {
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('debts.actionFailed')});
        return;
      }
      void dispatch(fetchDebtsByDebtor(debtorId));
      void dispatch(fetchAllDebts());
    },
    [debtorId, dispatch, showAlert, showDialog, t],
  );

  /**
   * Deletes the debtor and, via the cascading service, every debt they hold.
   * Previously this only settled the debts when any existed, which made the
   * trash button behave identically to "mark as paid" and left the debtor
   * behind.
   */
  const handleDeleteDebtor = useCallback(async () => {
    const hasDebts = individualDebts.length > 0;
    const confirmed = await showDialog({
      type: 'warning',
      message: hasDebts
        ? t('debtor.deleteWithDebtsConfirm', {name: debtorName})
        : t('debtor.deleteConfirm', {name: debtorName}),
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteDebtorById(debtorId);
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('debts.actionFailed')});
      return;
    }
    void dispatch(fetchDebtors());
    void dispatch(fetchAllDebts());
    goBack();
  }, [debtorId, debtorName, dispatch, individualDebts.length, showAlert, showDialog, t]);

  /**
   * "Mark as paid" used to hard-delete every entry the person had — the
   * history of who paid what was gone the moment the balance was cleared, and
   * a mis-tap on the tick could not be undone (B7).
   *
   * Settling is now what a ledger does: one balancing entry for the net
   * amount, dated today, so the balance reads zero while every past entry
   * stays. No schema change, exports/imports unchanged, and an old app
   * version renders the settlement as an ordinary entry.
   */
  const handleMarkAsPaid = useCallback(async () => {
    if (debtorTotal === 0) {
      await showAlert({type: 'info', message: t('debts.alreadySettled', {name: debtorName})});
      return;
    }
    const amount = Math.abs(debtorTotal);
    const confirmed = await showDialog({
      type: 'success',
      message: t('debts.settleConfirm', {name: debtorName, amount: formatAmount(amount)}),
    });
    if (!confirmed) {
      return;
    }
    try {
      // Positive total = you owe them, so the balancing entry is a lending.
      const settlementType = debtorTotal > 0 ? LEND : BORROW;
      // Stored in English and translated where shown (M32): a translated
      // string here would freeze the language of the day it was settled.
      await createDebt(userId, amount, SETTLEMENT_DESCRIPTION, debtorId, getISODateTime(), settlementType);
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('debts.actionFailed')});
      return;
    }
    void dispatch(fetchDebtsByDebtor(debtorId));
    void dispatch(fetchAllDebts());
  }, [debtorId, debtorName, debtorTotal, dispatch, formatAmount, showAlert, showDialog, t, userId]);

  const handleUpdateDebtor = useCallback(() => {
    navigate('UpdateDebtorScreen', {debtorId});
  }, [debtorId]);

  useFocusEffect(
    useCallback(() => {
      dispatch(clearIndividualDebtor());
      void dispatch(fetchDebtsByDebtor(debtorId));
      void dispatch(fetchIndividualDebtor(debtorId));
    }, [debtorId, dispatch]),
  );

  useEffect(() => {
    if (!refreshing) return;

    let cancelled = false;
    void Promise.all([dispatch(fetchDebtsByDebtor(debtorId)), dispatch(fetchIndividualDebtor(debtorId))]).finally(
      () => {
        if (!cancelled) setRefreshing(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [dispatch, debtorId, refreshing]);

  return {
    colors,
    refreshing,
    debtorName,
    debtorId,
    debtorTotal,
    onRefresh,
    handleEditDebt,
    handleDeleteDebt,
    handleDeleteDebtor,
    handleMarkAsPaid,
    handleUpdateDebtor,
    sortedBorrowings,
    sortedLendings,
    totalBorrowings,
    totalLendings,
  };
};

export default useIndividualDebts;
