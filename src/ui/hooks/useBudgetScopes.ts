import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../store/hooks';
import {selectCategoryBudgets, selectCurrentBudget} from '../../store/slices/budgetDataSlice';
import {selectActiveCategories} from '../../store/slices/categoryDataSlice';
import {budgetScopeOptions, type BudgetScopeList} from '../../domain/budgetScopes';

/** The budget sheet's scopes for `yearMonth`. */
export const useBudgetScopes = (yearMonth: string): BudgetScopeList => {
  const {t} = useTranslation();
  const currentBudget = useAppSelector(state => selectCurrentBudget(state, yearMonth));
  const categoryBudgets = useAppSelector(state => selectCategoryBudgets(state, yearMonth));
  const activeCategories = useAppSelector(selectActiveCategories);
  return useMemo(
    () => budgetScopeOptions(t('sheets.scopeOverall'), currentBudget, activeCategories, categoryBudgets),
    [activeCategories, categoryBudgets, currentBudget, t],
  );
};
