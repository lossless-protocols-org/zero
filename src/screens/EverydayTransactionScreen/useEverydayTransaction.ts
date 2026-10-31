import {formatDisplayDate} from '../../utils/dateUtils';
import useThemeColors from '../../hooks/useThemeColors';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {RouteProp, useFocusEffect} from '@react-navigation/native';
import {useCallback, useMemo} from 'react';
import {fetchEverydayExpenses, selectFilterKey, selectFilteredExpenses} from '../../redux/slice/expenseDataSlice';
import type {HomeStackParamList} from '../../navigation/types';
import {sumAmounts} from '../../utils/numberUtils';

export type EverydayTransactionRouteProp = RouteProp<HomeStackParamList, 'EverydayTransactionScreen'>;

const useEverydayTransaction = (route: EverydayTransactionRouteProp) => {
  const dispatch = useAppDispatch();
  const filteredExpenses = useAppSelector(selectFilteredExpenses);
  const filterKey = useAppSelector(selectFilterKey);
  const expenseDate = route.params.isDate;
  const formattedDate = formatDisplayDate(expenseDate, 'date');
  const colors = useThemeColors();

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchEverydayExpenses(expenseDate));
    }, [dispatch, expenseDate]),
  );

  /**
   * `filteredExpenses` is ONE slot shared with CategoryTransactionScreen, so
   * between navigating here and this day's fetch resolving it still holds the
   * previous screen's rows. The slice has always written a `filterKey` for
   * exactly this — it just was never read, so the stale list flashed anyway.
   *
   * Gate on it: until the store's key matches the day we asked for, this
   * screen has no data rather than the wrong data.
   */
  const allEverydayTransactions = useMemo(
    () => (filterKey === expenseDate ? filteredExpenses : []),
    [filterKey, expenseDate, filteredExpenses],
  );

  const totalAmountForTheDay = useMemo(() => sumAmounts(allEverydayTransactions), [allEverydayTransactions]);

  return {
    formattedDate,
    colors,
    expenseDate,
    allEverydayTransactions,
    totalAmountForTheDay,
  };
};

export default useEverydayTransaction;
