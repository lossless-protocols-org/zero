import {useState, useCallback} from 'react';
import useThemeColors from '../../hooks/useThemeColors';
import {createUser} from '../../watermelondb/services';
import {navigate} from '../../utils/navigationUtils';
import {nameSchema} from '../../i18n/validationSchema';
import {DEFAULT_USER_NAME} from '../../i18n/displayNames';
import {useReportFailure} from '../../hooks/useReportFailure';

const usePersonalize = () => {
  const colors = useThemeColors();
  const [name, setName] = useState('');

  // Onboarding writes used to fail silently (a __DEV__ console only): the
  // Continue tap did nothing and the user was stuck with no explanation (B5).
  const reportSaveFailure = useReportFailure('onboarding.saveFailed');

  const handleSubmit = useCallback(async () => {
    try {
      await nameSchema.parseAsync(name);
    } catch {
      // The input already shows the validation message; nothing to report.
      return;
    }
    try {
      await createUser(name, '');
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    navigate('PickCategoriesScreen');
  }, [name, reportSaveFailure]);

  const handleSkip = useCallback(async () => {
    try {
      await createUser(DEFAULT_USER_NAME, '');
    } catch (error) {
      await reportSaveFailure(error);
      return;
    }
    navigate('PickCategoriesScreen');
  }, [reportSaveFailure]);

  return {
    colors,
    setName,
    name,
    handleSubmit,
    handleSkip,
    nameSchema,
  };
};

export default usePersonalize;
