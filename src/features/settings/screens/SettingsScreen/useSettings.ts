import {useCallback} from 'react';
import {useFreshWhileFocused} from '../../../../ui/hooks/useFreshWhileFocused';
import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import {fetchBudgetsByMonth, selectCurrentBudget} from '../../../../store/slices/budgetDataSlice';
import {getAppVersion} from '../../../../platform/getVersion';
import {formatDisplayDate} from '../../../../platform/dateFormat';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useUserName} from '../../../../ui/hooks/useUserName';
import {useMonthNavigation} from '../../../../ui/hooks/useMonthNavigation';
import {useBudgetActions} from '../../../../ui/hooks/useBudgetActions';
import {useSettingsPreferences} from '../../hooks/useSettingsPreferences';
import {useSettingsLinks} from '../../hooks/useSettingsLinks';
import {useDataActions} from '../../hooks/useDataActions';

/**
 * The Settings screen's state, grouped by section: preferences, the budget
 * for Home's month, outbound links, and data actions. It used to return 33
 * flat fields mixing all four (audit 2026-11-08 §5); each group comes from
 * its own hook in features/settings/hooks.
 */
export const useSettings = () => {
  const dispatch = useAppDispatch();
  const {userName} = useUserName();

  // Settings' budget row edits the month Home and Reports show.
  const {yearMonth} = useMonthNavigation();
  const currentBudget = useAppSelector(state => selectCurrentBudget(state, yearMonth));
  // In the locale's own order ("Nov 2026", "2026年11月"), not name-then-year assembled here.
  const monthLabel = formatDisplayDate(`${yearMonth}-01`, 'monthYear');
  const {handleBudgetSave, handleBudgetRemove} = useBudgetActions(yearMonth, monthLabel);

  // Exports read the database at tap time (B8), so nothing is preloaded for them (L2).
  // The categories follow the session (store/followSession); the budget is this screen's own.
  useFreshWhileFocused(
    useCallback(() => {
      void dispatch(fetchBudgetsByMonth(yearMonth));
    }, [dispatch, yearMonth]),
    ['budgets'],
  );

  return {
    appVersion: getAppVersion(),
    colors: useThemeColors(),
    userName,
    preferences: useSettingsPreferences(),
    budget: {current: currentBudget, monthLabel, yearMonth, save: handleBudgetSave, remove: handleBudgetRemove},
    links: useSettingsLinks(),
    data: useDataActions(),
  };
};
