import {useCallback, useRef, useState} from 'react';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {getUnexplained} from '../../../data/services/netWorthService';
import {lastDayOf} from '../../../domain/period';
import {useMonthPeriod} from '../../../ui/hooks/useMonthStartDay';
import {appendErrorLog} from '../../../platform/errorLog';
import {useFreshWhileFocused} from '../../../ui/hooks/useFreshWhileFocused';
import {useProFeature} from '../../../ui/hooks/useProFeature';
import {POSITION_TABLES} from '../../../ui/hooks/useNetWorth';

/**
 * How much of a month the entries do not account for (Pro, P8): what the
 * balances the user set on cash and bank accounts explained in that month.
 * 0 without Pro (nothing is read), and 0 in a month with no such balance.
 */
export const useUnexplained = (yearMonth: string): number => {
  const pro = useProFeature('accounts');
  const userId = useAppSelector(selectUserId);
  const [amount, setAmount] = useState(0);
  const request = useRef(0);
  const period = useMonthPeriod(yearMonth);

  const read = useCallback(() => {
    const mine = ++request.current;
    if (!pro || !userId) {
      setAmount(0);
      return;
    }
    getUnexplained(userId, period.start, lastDayOf(period))
      .then(next => {
        if (mine === request.current) {
          setAmount(next);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
  }, [pro, userId, period]);

  useFreshWhileFocused(read, POSITION_TABLES);
  return amount;
};
