import {useMemo} from 'react';
import {useAppSelector} from '../../../../store/hooks';
import {selectMonthSpendRows} from '../../../../store/slices/expenseDataSlice';
import {selectCurrencyCode, selectCurrencySymbol} from '../../../../store/slices/currencyDataSlice';
import {selectCategoryBudgets} from '../../../../store/slices/budgetDataSlice';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useBudgetActions} from '../../../../ui/hooks/useBudgetActions';
import {useMonthView} from '../../../../ui/hooks/useMonthView';
import {usePreference} from '../../../../ui/hooks/usePreference';
import {getWeekdayShortNames, formatDisplayDate} from '../../../../platform/dateFormat';
import {rotateWeekdays, weekStartPreference} from '../../../../platform/weekStart';

/**
 * Reports: the month (useMonthView: which month, its totals and budget),
 * what the charts draw, the per-category budgets and the currency. Grouped by
 * what the screen draws; it returned 25 flat fields (audit 2026-11-08 §5).
 */
export const useReports = () => {
  const {month, totals, budget} = useMonthView();
  const {yearMonth} = month;

  // The categories' names and colours can change in the Categories tab while this tab stays mounted.
  // Expenses and the month's refunds as signed rows (refunds negative): every chart nets (R2).
  const rows = useAppSelector(state => selectMonthSpendRows(state, yearMonth));
  const categoryBudgets = useAppSelector(state => selectCategoryBudgets(state, yearMonth));
  const currencySymbol = useAppSelector(selectCurrencySymbol);
  const currencyCode = useAppSelector(selectCurrencyCode);
  // Subscribed: this screen stays mounted while Settings changes the option.
  const weekStart = usePreference(weekStartPreference);
  const dayNames = useMemo(() => rotateWeekdays(getWeekdayShortNames(), weekStart), [weekStart]);

  const monthLabel = month.label;
  const {handleBudgetSave, handleBudgetRemove} = useBudgetActions(yearMonth, monthLabel);

  return {
    colors: useThemeColors(),
    month: {
      ...month,
      label: monthLabel,
      // The header pill shares its row with two stat tiles: "Oct 2026", in the locale's form.
      shortLabel: formatDisplayDate(`${yearMonth}-01`, 'monthYear'),
    },
    totals,
    budget: {status: budget, byCategory: categoryBudgets, save: handleBudgetSave, remove: handleBudgetRemove},
    chart: {rows, dayNames, weekStart},
    currency: {symbol: currencySymbol, code: currencyCode},
  };
};
