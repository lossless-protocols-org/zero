import React from 'react';
import {SplashScreen} from '../features/onboarding/screens/SplashScreen';
import {PersonalizeScreen} from '../features/onboarding/screens/PersonalizeScreen';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {OnboardingStackParamList} from './types';
import {PickCategoriesScreen} from '../features/onboarding/screens/PickCategoriesScreen';
import {ChooseCurrencyScreen} from '../features/onboarding/screens/ChooseCurrencyScreen';
import {WelcomeScreen} from '../features/onboarding/screens/WelcomeScreen';
import {ExistingUserScreen} from '../features/onboarding/screens/ExistingUserScreen';

const screenOptions = {
  headerShown: false,
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="SplashScreen" component={SplashScreen} />
      <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
      <Stack.Screen name="ExistingUserScreen" component={ExistingUserScreen} />
      <Stack.Screen name="PersonalizeScreen" component={PersonalizeScreen} />
      <Stack.Screen name="PickCategoriesScreen" component={PickCategoriesScreen} />
      <Stack.Screen name="ChooseCurrencyScreen" component={ChooseCurrencyScreen} />
    </Stack.Navigator>
  );
};
