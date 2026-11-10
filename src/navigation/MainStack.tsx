import React from 'react';
import {isOnboardedPreference} from '../platform/onboarding';
import {HomeStack} from './HomeStack';
import {OnboardingStack} from './OnboardingStack';
import {usePreference} from '../ui/hooks/usePreference';

export const MainStack = () => {
  const isOnboarded = usePreference(isOnboardedPreference);
  return isOnboarded ? <HomeStack /> : <OnboardingStack />;
};
