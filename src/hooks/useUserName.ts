import {useAppDispatch, useAppSelector} from '../redux/hooks';
import {selectUserId} from '../redux/slice/userIdSlice';
import {selectUserName, setUserName} from '../redux/slice/userNameSlice';
import {updateUserById} from '../watermelondb/services';
import {useTranslation} from 'react-i18next';
import {DEFAULT_USER_NAME, displayUserName} from '../i18n/displayNames';

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

  const rename = async (newName: string): Promise<void> => {
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
  };

  return {userName, rename};
};
