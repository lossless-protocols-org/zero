import {useAppSelector} from '../../store/hooks';
import {selectDataError, selectHasAnyDataError} from '../../store/slices/dataErrorSlice';
import {NO_USER_ROW} from '../../store/slices/userIdSlice';

/** The last failed load among `domains` ('expense', 'debt', …), or null. */
export const useDataError = (domains: readonly string[]): string | null =>
  useAppSelector(state => selectDataError(state, domains));

/** Whether any load failed this session, and whether one failure is the missing user row. */
export const useDataErrorSummary = () => ({
  hasError: useAppSelector(selectHasAnyDataError),
  noUserRow: useAppSelector(state => Object.values(state.dataError.byThunk).includes(NO_USER_ROW)),
});
