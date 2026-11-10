import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {
  fetchCategories,
  selectActiveCategories,
  selectActiveIncomeCategories,
  selectCategoryData,
  selectIncomeCategories,
} from '../../../../store/slices/categoryDataSlice';
import {selectUserId} from '../../../../store/slices/userIdSlice';
import {useCallback, useEffect, useState} from 'react';
import {navigate} from '../../../../platform/navigationUtils';
import {softDeleteCategoryById} from '../../../../data/services/categoryService';
import {CategoryRuleError, reorderCategories} from '../../../../data/services/categoryService';
import {moveInOrder, placeActiveOrder, type OrderMove} from '../../../../domain/categoryOrder';
import type {CategoryKind} from '../../../../domain/types';
import {useDialog} from '../../../../ui/context/DialogContext';
import {useTranslation} from 'react-i18next';
import {appendErrorLog} from '../../../../platform/errorLog';

export const useCategory = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const {showDialog, showAlert} = useDialog();
  const {t} = useTranslation();
  const categories = useAppSelector(selectActiveCategories);
  const incomeCategories = useAppSelector(selectActiveIncomeCategories);
  // Every category of each kind, archived ones included: the stored order covers them all.
  const allExpense = useAppSelector(selectCategoryData);
  const allIncome = useAppSelector(selectIncomeCategories);
  const userId = useAppSelector(selectUserId);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!refreshing) return;

    void dispatch(fetchCategories()).finally(() => {
      setRefreshing(false);
    });
  }, [refreshing, dispatch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const handleEdit = useCallback((categoryId: string) => {
    navigate('UpdateCategoryScreen', {categoryId});
  }, []);

  const handleDelete = useCallback(
    async (categoryId: string) => {
      // Soft delete keeps historical expenses intact, but there is no in-app way
      // to bring a category back — so confirm before removing it.
      const confirmed = await showDialog({
        type: 'warning',
        message: t('category.deleteConfirm'),
      });
      if (!confirmed) {
        return;
      }
      try {
        await softDeleteCategoryById(categoryId);
      } catch (error) {
        if (error instanceof CategoryRuleError && error.rule === 'lastIncomeCategory') {
          await showAlert({type: 'info', message: t('categories.lastIncomeCategory')});
          return;
        }
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('category.saveFailed')});
      }
      // A success shows through the session's category follower (store/followSession).
    },
    [showAlert, showDialog, t],
  );

  /** Move up, down or to the top among the visible (active) categories of its kind. */
  const handleMove = useCallback(
    async (kind: CategoryKind, categoryId: string, move: OrderMove) => {
      const all = kind === 'income' ? allIncome : allExpense;
      const ordered = moveInOrder(
        all.map(c => ({id: c.id, active: c.categoryStatus})),
        categoryId,
        move,
      );
      if (!ordered) {
        return;
      }
      try {
        await reorderCategories(userId, kind, ordered);
      } catch (error) {
        appendErrorLog(error, false);
        // Nothing changed in the database, so nothing is followed: read again to undo a dragged order on screen.
        void dispatch(fetchCategories());
        await showAlert({type: 'error', message: t('categories.reorderFailed')});
      }
    },
    [allIncome, allExpense, userId, dispatch, showAlert, t],
  );

  /** A drag's result: the active categories of `kind` in their new order. */
  const handleReorder = useCallback(
    async (kind: CategoryKind, activeOrder: string[]) => {
      const all = kind === 'income' ? allIncome : allExpense;
      const ordered = placeActiveOrder(
        all.map(c => ({id: c.id, active: c.categoryStatus})),
        activeOrder,
      );
      if (!ordered) {
        return;
      }
      try {
        await reorderCategories(userId, kind, ordered);
      } catch (error) {
        appendErrorLog(error, false);
        // Nothing changed in the database, so nothing is followed: read again to undo a dragged order on screen.
        void dispatch(fetchCategories());
        await showAlert({type: 'error', message: t('categories.reorderFailed')});
      }
    },
    [allIncome, allExpense, userId, dispatch, showAlert, t],
  );

  return {
    colors,
    refreshing,
    onRefresh,
    categories,
    incomeCategories,
    handleMove,
    handleReorder,
    handleEdit,
    handleDelete,
  };
};
