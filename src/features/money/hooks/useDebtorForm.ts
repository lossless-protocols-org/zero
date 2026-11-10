import {useCallback, useMemo, useState} from 'react';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {selectDebtorData} from '../../../store/slices/debtorDataSlice';
import {createDebtor, updateDebtorById} from '../../../data/services/debtorService';
import type {DebtorData} from '../../../domain/types';
import {nameSchema} from '../../../i18n/validationSchema';
import {goBack} from '../../../platform/navigationUtils';
import {useReportSaveFailure} from '../../../ui/hooks/useReportFailure';
import debtCategories from '../../../../assets/jsons/defaultDebtAccounts.json';

interface DebtCategory {
  name: string;
  icon?: string;
  color?: string;
}

/** The debtor being edited, as read from the database (M19). */
export type EditedDebtor = DebtorData;

/** State and save for the add/edit debtor form; `editing` absent = add. */
export const useDebtorForm = (editing?: EditedDebtor) => {
  const userId = useAppSelector(selectUserId);
  const debtors = useAppSelector(selectDebtorData);
  const [debtorTitle, setDebtorTitle] = useState(editing?.title ?? '');
  const [selectedCategories, setSelectedCategories] = useState<DebtCategory[]>(
    editing ? debtCategories.filter(category => category.name === editing.type) : [],
  );

  // Debtors are referenced by TITLE in backups; two active "Ravi"s merge on
  // import and their debts land on one person. Refuse the duplicate here (B2).
  const otherTitlesLower = useMemo(
    () =>
      new Set(
        debtors
          .filter(debtor => debtor.debtorStatus && debtor.id !== editing?.id)
          .map(debtor => debtor.title.trim().toLowerCase()),
      ),
    [debtors, editing?.id],
  );
  const trimmedTitle = debtorTitle.trim();
  const isDuplicate = trimmedTitle.length > 0 && otherTitlesLower.has(trimmedTitle.toLowerCase());
  const isValid = nameSchema.isValid(debtorTitle) && !isDuplicate;

  const reportSaveFailure = useReportSaveFailure('debtor.saveFailed');

  const toggleCategorySelection = useCallback(
    (category: DebtCategory) => {
      if (selectedCategories.some(c => c.name === category.name)) {
        setSelectedCategories([]);
      } else {
        setSelectedCategories([category]);
      }
    },
    [selectedCategories],
  );

  const save = useCallback(async () => {
    const chosen = selectedCategories[0];
    try {
      if (editing) {
        await updateDebtorById(editing.id, trimmedTitle, chosen?.name ?? '', chosen?.icon, chosen?.color);
      } else {
        await createDebtor(trimmedTitle, userId, chosen?.icon ?? null, chosen?.name ?? '', chosen?.color ?? null);
      }
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    goBack(); // the screen underneath reads its debtors again on focus (useFreshWhileFocused)
  }, [editing, trimmedTitle, userId, selectedCategories, reportSaveFailure]);

  return {
    debtCategories,
    debtorTitle,
    setDebtorTitle,
    selectedCategories,
    toggleCategorySelection,
    isDuplicate,
    isValid,
    save,
  };
};
