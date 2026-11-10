import {useCallback, useRef, useState} from 'react';
import {useFreshWhileFocused} from '../../../ui/hooks/useFreshWhileFocused';
import {getRefundsByExpense} from '../../../data/services/refundService';
import {appendErrorLog} from '../../../platform/errorLog';
import type {RefundData} from '../../../domain/types';

/** An expense's refunds, read on focus and after any refund or expense write while focused (useFreshWhileFocused). */
export const useExpenseRefunds = (expenseId: string | undefined): RefundData[] => {
  const [refunds, setRefunds] = useState<RefundData[]>([]);
  // The newest read wins: an older one that lands later is dropped.
  const latest = useRef(0);
  useFreshWhileFocused(
    useCallback(() => {
      if (!expenseId) {
        return;
      }
      const request = ++latest.current;
      getRefundsByExpense(expenseId)
        .then(list => {
          if (request === latest.current) {
            setRefunds(list);
          }
        })
        .catch((error: unknown) => appendErrorLog(error, false));
    }, [expenseId]),
    ['refunds', 'expenses'],
  );
  return refunds;
};
