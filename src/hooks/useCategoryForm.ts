import {useCallback, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../redux/hooks';
import {selectUserId} from '../redux/slice/userIdSlice';
import {fetchCategories, selectCategoryData} from '../redux/slice/categoryDataSlice';
import {createCategory, updateCategoryById, type CategoryData} from '../watermelondb/services';
import {useTranslation} from 'react-i18next';
import {categorySchema} from '../i18n/validationSchema';
import {displayCategoryName} from '../i18n/displayNames';
import {DEFAULTS} from '../utils/sanitize';
import {goBack} from '../utils/navigationUtils';
import {useReportSaveFailure} from './useReportFailure';
import defaultCategories from '../../assets/jsons/defaultCategories.json';

export interface CategorySelection {
  name: string;
  icon?: string;
  color?: string;
}

/** The category being edited, as read from the database (M19). */
export type EditedCategory = CategoryData;

const resolveIconParam = (val?: string): string | null => {
  // 'null' is a legacy sentinel that older rows/params may still carry.
  if (!val || val === 'null' || val === '') {
    return null;
  }
  return val;
};

/** State and save for the add/edit category form; `editing` absent = add. */
export const useCategoryForm = (editing?: EditedCategory) => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const [categoryName, setCategoryName] = useState(editing?.name ?? '');

  const [selectedIcon, setSelectedIcon] = useState<string | null>(editing ? resolveIconParam(editing.icon) : null);
  const [selectedColor, setSelectedColor] = useState<string | null>(
    editing ? resolveIconParam(editing.color) : DEFAULTS.color,
  );
  const [selectedCategories, setSelectedCategories] = useState<Array<CategorySelection>>([]);

  const selectedCategoryNames = useMemo(() => new Set(selectedCategories.map(c => c.name)), [selectedCategories]);

  const allCategories = useAppSelector(selectCategoryData);
  // Stored and shown names both count (M32): a seeded "Food" shows translated,
  // and the user can type that translation as a name of their own.
  const existingCategoryNamesSet = useMemo(
    () =>
      new Set(
        (allCategories ?? []).flatMap((category: CategorySelection) => [
          category.name,
          displayCategoryName(category.name, t),
        ]),
      ),
    [allCategories, t],
  );
  const filteredCategories = useMemo(
    () =>
      defaultCategories.filter(
        category =>
          !existingCategoryNamesSet.has(category.name) &&
          !existingCategoryNamesSet.has(displayCategoryName(category.name, t)),
      ),
    [existingCategoryNamesSet, t],
  );

  // Categories are referenced by NAME in backups and the Reports donut, so two
  // active categories called "Fuel" and "fuel" merge on import and in the
  // chart. Refuse the second one at the door rather than untangle it later (B2).
  // Soft-deleted categories are not in the way: the user cannot see them.
  const activeNamesLower = useMemo(
    () =>
      new Set(
        (allCategories ?? [])
          .filter(category => category.categoryStatus && category.id !== editing?.id)
          .flatMap(category => [category.name, displayCategoryName(category.name, t)])
          .map(name => name.trim().toLowerCase()),
      ),
    [allCategories, editing?.id, t],
  );
  const trimmedName = categoryName.trim();
  const isDuplicate = trimmedName.length > 0 && activeNamesLower.has(trimmedName.toLowerCase());

  const userId = useAppSelector(selectUserId);
  const isValid = categorySchema.safeParse(categoryName).success && !isDuplicate;

  const reportFailure = useReportSaveFailure('category.saveFailed');
  const reportSaveFailure = useCallback(
    async (error: unknown) => {
      // Some may have been created before the failure; refetch so the screen
      // reflects what actually landed.
      void dispatch(fetchCategories());
      await reportFailure(error);
    },
    [dispatch, reportFailure],
  );

  const handleAddCategory = useCallback(async () => {
    try {
      await createCategory(trimmedName, userId, selectedIcon, selectedColor);
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    void dispatch(fetchCategories());
    goBack();
  }, [trimmedName, userId, selectedIcon, selectedColor, dispatch, reportSaveFailure]);

  const handleAddFromDefaultCategory = useCallback(async () => {
    // Was the one handler here with no try/catch: a rejected createCategory
    // skipped both the refetch and goBack, leaving the user on a screen that
    // looked like the tap did nothing at all.
    try {
      for (const category of selectedCategories) {
        await createCategory(category.name, userId, category.icon ?? null, category.color ?? null);
      }
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    void dispatch(fetchCategories());
    goBack();
  }, [selectedCategories, userId, dispatch, reportSaveFailure]);

  const handleUpdateCategory = useCallback(async () => {
    if (!editing) {
      return;
    }
    try {
      await updateCategoryById(editing.id, trimmedName, selectedIcon ?? undefined, selectedColor ?? undefined);
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    void dispatch(fetchCategories());
    goBack();
  }, [editing, trimmedName, selectedIcon, selectedColor, dispatch, reportSaveFailure]);

  /** Creates the picked default chips AND the typed name, in one pass. */
  const handleAddBothDefaultsAndTyped = useCallback(async () => {
    try {
      for (const category of selectedCategories) {
        await createCategory(category.name, userId, category.icon ?? null, category.color ?? null);
      }
      await createCategory(trimmedName, userId, selectedIcon, selectedColor);
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    void dispatch(fetchCategories());
    goBack();
  }, [selectedCategories, trimmedName, userId, selectedIcon, selectedColor, dispatch, reportSaveFailure]);

  /**
   * A typed name and picked default chips are two different intents, and this
   * used to resolve the ambiguity by silently preferring the chips — the user
   * typed a category name, tapped Add, and got something else with no
   * explanation. Now both are honoured: the chips are created AND the typed
   * name is created alongside them.
   */
  const save = useCallback(async () => {
    if (editing) {
      await handleUpdateCategory();
      return;
    }

    const hasTypedName = trimmedName.length > 0 && isValid;

    if (selectedCategories.length === 0) {
      await handleAddCategory();
      return;
    }

    if (hasTypedName && !selectedCategoryNames.has(trimmedName)) {
      await handleAddBothDefaultsAndTyped();
      return;
    }

    await handleAddFromDefaultCategory();
  }, [
    editing,
    trimmedName,
    isValid,
    selectedCategories.length,
    selectedCategoryNames,
    handleAddBothDefaultsAndTyped,
    handleAddFromDefaultCategory,
    handleAddCategory,
    handleUpdateCategory,
  ]);

  const toggleCategorySelection = useCallback(
    (category: CategorySelection) => {
      if (selectedCategoryNames.has(category.name)) {
        setSelectedCategories(prev => prev.filter(item => item.name !== category.name));
      } else {
        setSelectedCategories(prev => [...prev, category]);
      }
    },
    [selectedCategoryNames],
  );

  return {
    categoryName,
    setCategoryName,
    selectedIcon,
    setSelectedIcon,
    selectedColor,
    setSelectedColor,
    selectedCategories,
    selectedCategoryNames,
    toggleCategorySelection,
    filteredCategories,
    isDuplicate,
    isValid,
    save,
  };
};
