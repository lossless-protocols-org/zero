import React from 'react';
import SplashScreen from '../screens/SplashScreen';
import PersonalizeScreen from '../screens/PersonalizeScreen';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {OnboardingStackParamList} from './types';
import PickCategoriesScreen from '../screens/PickCategoriesScreen';
import ChooseCurrencyScreen from '../screens/ChooseCurrencyScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import ExistingUserScreen from '../screens/ExistingUserScreen';

const screenOptions = {
  headerShown: false,
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingStack = () => {
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

export default OnboardingStack;
