import {useCallback} from 'react';
import {SheetManager} from 'react-native-actions-sheet';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {selectUserName, setUserName} from '../../store/slices/userNameSlice';
import {updateUserById} from '../../data/services/userService';
import {useTranslation} from 'react-i18next';
import {DEFAULT_USER_NAME, displayUserName} from '../../i18n/displayNames';
import {useReportFailure} from './useReportFailure';

/**
 * The user's display name (the stored placeholder shown in the app language,
 * M32), and the one way to change it (row first, then the store).
 */
export const useUserName = () => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const storedName = useAppSelector(selectUserName);
  const userName = displayUserName(storedName, t);
  const userId = useAppSelector(selectUserId);

  // Stable between renders, so a memoised caller does not redraw for nothing.
  const rename = useCallback(
    async (newName: string): Promise<void> => {
      // The rename sheet opens with the shown (translated) placeholder; saving it
      // back unchanged must keep the stored English one, which follows the language.
      if (storedName === DEFAULT_USER_NAME && newName.trim() === userName) {
        return;
      }
      if (!userId) {
        throw new Error('Cannot rename: the user id is empty (user not loaded, or the user row is missing)');
      }
      await updateUserById(userId, {username: newName});
      dispatch(setUserName(newName));
    },
    [dispatch, storedName, userId, userName],
  );

  return {userName, rename};
};

/**
 * The one rename flow: the Home header's avatar and Settings' Name row both
 * open the sheet through this (each used to carry its own copy, audit
 * 2026-11-08 §5). A failed save goes to Diagnostics and says so. Separate from
 * useUserName so a screen that only shows the name needs no dialog.
 */
export const useRenameSheet = (): (() => void) => {
  const {userName, rename} = useUserName();
  const reportFailure = useReportFailure('settings.saveFailed');
  return useCallback(() => {
    void SheetManager.show('change-name-sheet', {
      payload: {
        currentName: userName,
        onUpdate: (newName: string) => {
          rename(newName).catch(reportFailure);
        },
      },
    });
  }, [rename, reportFailure, userName]);
};
