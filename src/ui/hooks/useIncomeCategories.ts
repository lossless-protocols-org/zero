import {useMemo} from 'react';
import {capsOf} from '../../pro/features';
import {projectIncomeCategories, type IncomeCategoryView} from '../../pro/projection';
import {selectIncomeCategories} from '../../store/slices/categoryDataSlice';
import {useAppSelector} from '../../store/hooks';
import type {CategoryData} from '../../domain/types';
import {useAppliedPro} from './useProFeature';

/**
 * The user's income categories as this tier shows them (src/pro/projection.ts):
 * all the active ones with Pro, the one money lands in without.
 */
export const useIncomeCategories = (): IncomeCategoryView<CategoryData> => {
  const all = useAppSelector(selectIncomeCategories);
  const pro = useAppliedPro();
  return useMemo(() => projectIncomeCategories(all, capsOf(pro)), [all, pro]);
};
