import React from 'react';
import {isOnboardedPreference} from '../utils/onboarding';
import HomeStack from './HomeStack';
import OnboardingStack from './OnboardingStack';
import {usePreference} from '../hooks/usePreference';

const MainStack = () => {
  const isOnboarded = usePreference(isOnboardedPreference);
  return isOnboarded ? <HomeStack /> : <OnboardingStack />;
};

export default MainStack;
