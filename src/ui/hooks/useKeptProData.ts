import {useCallback, useState} from 'react';
import {countKeptProData, removeProData} from '../../data/services/proDataService';
import {appendErrorLog} from '../../platform/errorLog';
import {useAppliedPro} from './useProFeature';
import {useFreshWhileFocused} from './useFreshWhileFocused';
import type {WatchedTable} from '../../data/services/tableChanges';

/** Where Pro data lives: a restore, a removal, or a lapse while Settings is open changes the count. */
const PRO_DATA_TABLES: readonly WatchedTable[] = ['accounts', 'transfers', 'checkpoints', 'categories'];

/**
 * The rows this person owns and cannot see (3.0 law L9): how many, and their
 * removal. Zero while Pro is on (nothing is hidden then) and until counted.
 * Counted on focus and again after a write to a table Pro data lives in.
 */
export const useKeptProData = () => {
  const pro = useAppliedPro();
  const [count, setCount] = useState(0);

  const recount = useCallback(async (): Promise<void> => {
    try {
      setCount(pro ? 0 : await countKeptProData());
    } catch (error) {
      // Not knowing the count hides the row; it loses nothing.
      appendErrorLog(error, false);
      setCount(0);
    }
  }, [pro]);

  // Read when Settings gains focus and after every write to a table Pro data lives in (P7 review).
  const read = useCallback(() => {
    void recount();
  }, [recount]);
  useFreshWhileFocused(read, PRO_DATA_TABLES);

  const remove = useCallback(async (): Promise<void> => {
    await removeProData();
    await recount();
  }, [recount]);

  return {count, remove};
};
