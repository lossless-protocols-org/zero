import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {fetchDebtsByDebtor, selectDebtsOf} from '../../../../store/slices/debtDataSlice';
import {selectUserId} from '../../../../store/slices/userIdSlice';
import {goBack, navigate} from '../../../../platform/navigationUtils';
import {createDebt, deleteDebtById} from '../../../../data/services/debtService';
import {deleteDebtorById} from '../../../../data/services/debtorService';
import {RouteProp, useFocusEffect} from '@react-navigation/native';
import {useFreshWhileFocused} from '../../../../ui/hooks/useFreshWhileFocused';
import type {HomeStackParamList} from '../../../../navigation/types';
import {BORROW, LEND, isBorrowType, netDebt} from '../../../../domain/debtType';
import {sumAmounts} from '../../../../domain/money';
import {getISODateTime} from '../../../../domain/dates';
import {appendErrorLog} from '../../../../platform/errorLog';
import {selectDebtorData} from '../../../../store/slices/debtorDataSlice';
import {sortByDateDesc} from '../../../../domain/dates';
import {DebtData as DebtDocType} from '../../../../domain/types';
import {
  clearIndividualDebtor,
  fetchIndividualDebtor,
  selectIndividualDebtorData,
} from '../../../../store/slices/individualDebtorDataSlice';
import {useDialog} from '../../../../ui/context/DialogContext';
import {useTranslation} from 'react-i18next';
import {SETTLEMENT_DESCRIPTION} from '../../../../i18n/displayNames';

export type IndividualDebtsScreenRouteProp = RouteProp<HomeStackParamList, 'IndividualDebtsScreen'>;

export const useIndividualDebts = (route: IndividualDebtsScreenRouteProp) => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const {showDialog, showAlert} = useDialog();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const userId = useAppSelector(selectUserId);
  const [refreshing, setRefreshing] = useState(false);
  const {debtorId} = route.params;
  // Only this person's debts: another person's, still loaded, read as none (audit §3.11).
  const individualDebts = useAppSelector(state => selectDebtsOf(state, debtorId));
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

    // Exact money units (netDebt/sumAmounts): a float sum left 3.5e-15 for a settled person.
    return {
      sortedBorrowings: borrowings,
      sortedLendings: lendings,
      totalBorrowings: sumAmounts(borrowings),
      totalLendings: sumAmounts(lendings),
      debtorTotal: netDebt(sorted),
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
      }
      // A success shows through useFreshWhileFocused below.
    },
    [showAlert, showDialog, t],
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
    goBack(); // Money reads its debtors and debts again on focus
  }, [debtorId, debtorName, individualDebts.length, showAlert, showDialog, t]);

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
    }
    // The settlement shows through useFreshWhileFocused below.
  }, [debtorId, debtorName, debtorTotal, formatAmount, showAlert, showDialog, t, userId]);

  const handleUpdateDebtor = useCallback(() => {
    navigate('UpdateDebtorScreen', {debtorId});
  }, [debtorId]);

  // Another person's header must never show under this one's name: cleared on focus, before the read.
  useFocusEffect(
    useCallback(() => {
      dispatch(clearIndividualDebtor());
    }, [dispatch]),
  );
  useFreshWhileFocused(
    useCallback(() => {
      void dispatch(fetchDebtsByDebtor(debtorId));
      void dispatch(fetchIndividualDebtor(debtorId));
    }, [debtorId, dispatch]),
    ['debts', 'debtors'],
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
