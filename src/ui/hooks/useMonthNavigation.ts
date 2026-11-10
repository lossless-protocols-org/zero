import {useCallback, useEffect, useMemo, useReducer} from 'react';
import {AppState} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {
  monthSelectionReducer,
  followToday,
  selectMonthIndex,
  selectYear,
  setMonthSelection,
} from '../../store/slices/monthSelectionSlice';
import {getMonthNames} from '../../platform/dateFormat';
import {toYearMonth} from '../../domain/dates';

/**
 * The selected month plus ‹ › stepping. Home and Reports share one selection
 * (Redux); the Money tab passes `{shared: false}` and keeps its own, so
 * looking at December's money in never moves Home's expenses (owner, 2.8).
 *
 * "Today" is computed per render on purpose. Both hooks used to capture the
 * current month and year in module-level constants, so an app left open (or
 * resumed from the background) across a month boundary kept treating the old
 * month as "current" — the Today total and the daily allowance went stale
 * until a full restart (B10).
 *
 * The selection itself follows today too: picked as "this month", it moves to
 * the new month when the app comes back to the foreground in one (Android
 * keeps the process alive for days); a month picked on purpose stays put
 * (audit 2026-11-08 §3.9). The Money tab's own month uses the same reducer.
 */
export const useMonthNavigation = ({shared = true}: {shared?: boolean} = {}) => {
  const dispatch = useAppDispatch();
  const {i18n} = useTranslation();
  const sharedMonthIndex = useAppSelector(selectMonthIndex);
  const sharedYear = useAppSelector(selectYear);
  // Both read every render (hooks run unconditionally); `shared` picks which one counts.
  const [own, dispatchOwn] = useReducer(monthSelectionReducer, undefined, () =>
    monthSelectionReducer(undefined, {type: 'monthSelection/init'}),
  );
  const selectedMonthIndex = shared ? sharedMonthIndex : own.monthIndex;
  const selectedYear = shared ? sharedYear : own.year;
  const select = useCallback(
    (monthIndex: number, year: number) => {
      (shared ? dispatch : dispatchOwn)(setMonthSelection({monthIndex, year}));
    },
    [dispatch, shared],
  );

  // Every instance listens; the shared reducer ignores a second, identical move.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        (shared ? dispatch : dispatchOwn)(followToday());
      }
    });
    return () => subscription.remove();
  }, [dispatch, shared]);

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

  const handleMonthYearSelect = select;

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
      select(monthIndex, year);
    },
    [select, selectedMonthIndex, selectedYear],
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
