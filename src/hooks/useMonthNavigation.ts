import {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '../redux/hooks';
import {selectMonthIndex, selectYear, setMonthSelection} from '../redux/slice/monthSelectionSlice';
import {getMonthNames, toYearMonth} from '../utils/dateUtils';

/**
 * The selected month, shared by Home and Reports, plus ‹ › stepping.
 *
 * "Today" is computed per render on purpose. Both hooks used to capture the
 * current month and year in module-level constants, so an app left open (or
 * resumed from the background) across a month boundary kept treating the old
 * month as "current" — the Today total and the daily allowance went stale
 * until a full restart (B10).
 */
const useMonthNavigation = () => {
  const dispatch = useAppDispatch();
  const {i18n} = useTranslation();
  const selectedMonthIndex = useAppSelector(selectMonthIndex);
  const selectedYear = useAppSelector(selectYear);

  // Month names follow the active language; i18n.language is the signal that
  // dayjs's locale (which getMonthNames reads) has changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const months = useMemo(() => getMonthNames(), [i18n.language]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();

  // The name is only a label; keys and maths use the index.
  const selectedMonthName = months[selectedMonthIndex] ?? '';
  const yearMonth = toYearMonth(selectedYear, selectedMonthIndex);
  const isCurrentMonth = selectedYear === currentYear && selectedMonthIndex === currentMonthIndex;

  const handleMonthYearSelect = useCallback(
    (monthIndex: number, year: number) => {
      dispatch(setMonthSelection({monthIndex, year}));
    },
    [dispatch],
  );

  // Future months are not browsable (the picker greys them out too): there is
  // nothing to show, and the "current month" maths assumes the past.
  const canGoForward = !isCurrentMonth && (selectedYear < currentYear || selectedMonthIndex < currentMonthIndex);

  const shiftMonth = useCallback(
    (delta: 1 | -1) => {
      let monthIndex = selectedMonthIndex + delta;
      let year = selectedYear;
      if (monthIndex < 0) {
        monthIndex = 11;
        year -= 1;
      } else if (monthIndex > 11) {
        monthIndex = 0;
        year += 1;
      }
      const now = new Date();
      if (year > now.getFullYear() || (year === now.getFullYear() && monthIndex > now.getMonth())) {
        return;
      }
      dispatch(setMonthSelection({monthIndex, year}));
    },
    [dispatch, selectedMonthIndex, selectedYear],
  );

  return {
    months,
    selectedMonthIndex,
    selectedYear,
    selectedMonthName,
    yearMonth,
    isCurrentMonth,
    currentYear,
    canGoForward,
    handleMonthYearSelect,
    shiftMonth,
  };
};

export default useMonthNavigation;
