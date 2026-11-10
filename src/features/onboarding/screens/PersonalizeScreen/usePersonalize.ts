import {useState, useCallback} from 'react';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {createUser} from '../../../../data/services/userService';
import {navigate} from '../../../../platform/navigationUtils';
import {nameSchema} from '../../../../i18n/validationSchema';
import {DEFAULT_USER_NAME} from '../../../../i18n/displayNames';
import {useReportFailure} from '../../../../ui/hooks/useReportFailure';
import {useAppDispatch} from '../../../../store/hooks';
import {bootstrapSession} from '../../../../store/bootstrapSession';

export const usePersonalize = () => {
  const colors = useThemeColors();
  const [name, setName] = useState('');

  // Onboarding writes used to fail silently (a __DEV__ console only): the
  // Continue tap did nothing and the user was stuck with no explanation (B5).
  const reportSaveFailure = useReportFailure('onboarding.saveFailed');

  const dispatch = useAppDispatch();

  // The user exists from here on: the session starts now, so the next steps
  // (categories, currency) have the id without loading it themselves.
  const start = useCallback(
    async (userName: string) => {
      try {
        await createUser(userName, '');
      } catch (error) {
        await reportSaveFailure(error);
        return;
      }
      await dispatch(bootstrapSession());
      navigate('PickCategoriesScreen');
    },
    [dispatch, reportSaveFailure],
  );

  const handleSubmit = useCallback(async () => {
    if (!nameSchema.isValid(name)) {
      return; // the input already shows the validation message
    }
    await start(name);
  }, [name, start]);

  const handleSkip = useCallback(() => start(DEFAULT_USER_NAME), [start]);

  return {
    colors,
    setName,
    name,
    handleSubmit,
    handleSkip,
    nameSchema,
  };
};
