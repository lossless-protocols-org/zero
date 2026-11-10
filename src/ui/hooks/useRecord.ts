import {useEffect, useState} from 'react';
import {appendErrorLog} from '../../platform/errorLog';

export type RecordState<T> =
  {status: 'loading'} | {status: 'missing'} | {status: 'failed'} | {status: 'ready'; record: T};

/**
 * Reads one row by id for a screen (M19, v2.7.1). `missing` means the row was
 * deleted elsewhere; `failed` means the read itself failed, and is logged.
 * `load` should be a module-level service function, so it is stable.
 */
export const useRecord = <T>(id: string, load: (id: string) => Promise<T | null>): RecordState<T> => {
  const [state, setState] = useState<RecordState<T>>({status: 'loading'});
  useEffect(() => {
    let live = true;
    setState({status: 'loading'});
    load(id)
      .then(record => {
        if (live) {
          setState(record === null ? {status: 'missing'} : {status: 'ready', record});
        }
      })
      .catch((error: unknown) => {
        appendErrorLog(error, false);
        if (live) {
          setState({status: 'failed'});
        }
      });
    return () => {
      live = false;
    };
  }, [id, load]);
  return state;
};
