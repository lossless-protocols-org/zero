import {useCallback} from 'react';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {navigate} from '../../../../platform/navigationUtils';

export const useSplash = () => {
  const handleClick = useCallback(() => {
    navigate('WelcomeScreen');
  }, []);

  const colors = useThemeColors();
  return {
    handleClick,
    colors,
  };
};
