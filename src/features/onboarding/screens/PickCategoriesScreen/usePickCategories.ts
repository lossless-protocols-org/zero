import {useAppSelector} from '../../../../store/hooks';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useCallback, useMemo, useRef, useState} from 'react';
import {selectUserId} from '../../../../store/slices/userIdSlice';
import {navigate} from '../../../../platform/navigationUtils';
import {createCategory, getAllCategoriesByUserId} from '../../../../data/services/categoryService';
import {useTranslation} from 'react-i18next';
import {useDialog} from '../../../../ui/context/DialogContext';
import {appendErrorLog} from '../../../../platform/errorLog';
import type {CategoryChoice} from '../../../../domain/types';

export const usePickCategories = () => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const [selectedCategories, setSelectedCategories] = useState<Array<CategoryChoice>>([]);

  const selectedCategoryNames = useMemo(() => new Set(selectedCategories.map(c => c.name)), [selectedCategories]);

  const userId = useAppSelector(selectUserId);

  const handleSkip = useCallback(() => {
    navigate('ChooseCurrencyScreen');
  }, []);

  // Guards a double-tap while the categories are being written. Released when
  // the step ends either way: the user can come back from the currency step
  // and continue again (it used to stay set after success, leaving Continue
  // dead on return).
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      // Only the picks this user does not have yet: coming back and continuing
      // again must not try to create "Food" twice (the service refuses a name
      // an active category already has).
      const existing = new Set(
        (await getAllCategoriesByUserId(userId, 'expense'))
          .filter(c => c.categoryStatus !== false)
          .map(c => c.name.trim().toLowerCase()),
      );
      for (const category of selectedCategories) {
        if (!existing.has(category.name.trim().toLowerCase())) {
          await createCategory(category.name, userId, category.icon ?? null, category.color ?? null, 'expense');
        }
      }
      navigate('ChooseCurrencyScreen');
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('onboarding.saveFailed')});
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [selectedCategories, userId, showAlert, t]);

  const toggleCategorySelection = useCallback(
    (category: CategoryChoice) => {
      if (selectedCategoryNames.has(category.name)) {
        setSelectedCategories(prev => prev.filter(item => item.name !== category.name));
      } else {
        setSelectedCategories(prev => [...prev, category]);
      }
    },
    [selectedCategoryNames],
  );

  const isCategorySelected = useCallback(
    (categoryName: string): boolean => {
      return selectedCategoryNames.has(categoryName);
    },
    [selectedCategoryNames],
  );

  return {
    colors,
    selectedCategories,
    setSelectedCategories,
    userId,
    handleSkip,
    handleSubmit,
    isSubmitting,
    toggleCategorySelection,
    isCategorySelected,
  };
};
