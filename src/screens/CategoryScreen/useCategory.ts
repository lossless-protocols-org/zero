import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import useThemeColors from '../../hooks/useThemeColors';
import {fetchCategories, selectActiveCategories} from '../../redux/slice/categoryDataSlice';
import {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {navigate} from '../../utils/navigationUtils';
import {softDeleteCategoryById} from '../../watermelondb/services';
import {useDialog} from '../../context/DialogContext';
import {useTranslation} from 'react-i18next';
import {appendErrorLog} from '../../utils/errorLog';

const useCategory = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const {showDialog, showAlert} = useDialog();
  const {t} = useTranslation();
  const categories = useAppSelector(selectActiveCategories);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchCategories());
    }, [dispatch]),
  );

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
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('category.saveFailed')});
        return;
      }
      void dispatch(fetchCategories());
    },
    [dispatch, showAlert, showDialog, t],
  );

  return {
    colors,
    refreshing,
    onRefresh,
    categories,
    handleEdit,
    handleDelete,
  };
};

export default useCategory;
