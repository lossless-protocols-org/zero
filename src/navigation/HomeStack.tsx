import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import {createBottomTabNavigator, type BottomTabBarButtonProps} from '@react-navigation/bottom-tabs';
import {Platform, Pressable, Text, View} from 'react-native';
import type {HomeStackParamList, TabParamList} from './types';
import {useTranslation} from 'react-i18next';
import Icon from '../components/atoms/Icons';
import useThemeColors from '../hooks/useThemeColors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ReportsScreen from '../screens/ReportsScreen';
import DebtsScreen from '../screens/DebtsScreen';
import CategoryScreen from '../screens/CategoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DiagnosticsScreen from '../screens/DiagnosticsScreen';
import AddTransactionsScreen from '../screens/AddTransactionsScreen';
import UpdateTransactionScreen from '../screens/UpdateTransactionScreen';
import AddCategoryScreen from '../screens/AddCategoryScreen';
import UpdateCategoryScreen from '../screens/UpdateCategoryScreen';
import AddDebtorScreen from '../screens/AddDebtorScreen';
import IndividualDebtsScreen from '../screens/IndividualDebtsScreen';
import AddDebtsScreen from '../screens/AddDebtsScreen';
import UpdateDebtScreen from '../screens/UpdateDebtScreen';
import EverydayTransactionScreen from '../screens/EverydayTransactionScreen';
import CategoryTransactionScreen from '../screens/CategoryTransactionScreen';
import UpdateDebtorScreen from '../screens/UpdateDebtorScreen';
import {gs} from '../styles/globalStyles';
import {tabBarLayout} from './tabBarLayout';

const screenOptions = {
  headerShown: false,
};

const ICON_SIZE = 24;

// Tab labels sit in a fixed-height bar: at the largest system font "Reports"
// broke mid-word. One line, grown at most 1.5×, shrunk to fit if needed (M30).
const TAB_LABEL_TEXT = {numberOfLines: 1, maxFontSizeMultiplier: 1.5, adjustsFontSizeToFit: true} as const;

const HomeIcon = ({color}: {color: string}) => {
  const {t} = useTranslation();
  return (
    <View style={[gs.center, gs.minW70]}>
      <View style={[gs.h26, gs.center]}>
        <Icon name="home" size={ICON_SIZE} color={color} />
      </View>
      <Text {...TAB_LABEL_TEXT} style={[gs.text10, gs.fontMedium, gs.noFontPadding, gs.textCenter, gs.mt2, {color}]}>
        {t('tabs.home')}
      </Text>
    </View>
  );
};

const ReportsIcon = ({color}: {color: string}) => {
  const {t} = useTranslation();
  return (
    <View style={[gs.center, gs.minW70]}>
      <View style={[gs.h26, gs.center]}>
        <Icon name="bar-chart-3" size={ICON_SIZE} color={color} />
      </View>
      <Text {...TAB_LABEL_TEXT} style={[gs.text10, gs.fontMedium, gs.noFontPadding, gs.textCenter, gs.mt2, {color}]}>
        {t('tabs.reports')}
      </Text>
    </View>
  );
};

const DebtIcon = ({color}: {color: string}) => {
  const {t} = useTranslation();
  return (
    <View style={[gs.center, gs.minW70]}>
      <View style={[gs.h26, gs.center]}>
        <Icon name="credit-card" size={ICON_SIZE} color={color} />
      </View>
      <Text {...TAB_LABEL_TEXT} style={[gs.text10, gs.fontMedium, gs.noFontPadding, gs.textCenter, gs.mt2, {color}]}>
        {t('tabs.debts')}
      </Text>
    </View>
  );
};

const CategoriesIcon = ({color}: {color: string}) => {
  const {t} = useTranslation();
  return (
    <View style={[gs.center, gs.minW70]}>
      <View style={[gs.h26, gs.center]}>
        <Icon name="shapes" size={ICON_SIZE} color={color} />
      </View>
      <Text {...TAB_LABEL_TEXT} style={[gs.text10, gs.fontMedium, gs.noFontPadding, gs.textCenter, gs.mt2, {color}]}>
        {t('tabs.categories')}
      </Text>
    </View>
  );
};

const Stack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// `ref` is dropped: @react-navigation types it more loosely than Pressable
// accepts under React 19, and a custom tab button has no use for it.
const TabBarButton = ({ref: _ref, ...props}: BottomTabBarButtonProps) => (
  <Pressable {...props} android_ripple={{color: 'transparent'}} />
);

const TabStack = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    backgroundColor: colors.containerColor,
    ...tabBarLayout(insets.bottom, Platform.OS === 'ios' ? 'ios' : 'android'),
    borderTopWidth: 0,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentGreen,
        tabBarInactiveTintColor: colors.primaryText,
        tabBarShowLabel: false,
        tabBarStyle: tabBarStyle,
        tabBarButton: TabBarButton,
      }}>
      <Tab.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{headerShown: false, tabBarIcon: HomeIcon, tabBarAccessibilityLabel: t('tabs.home')}}
      />
      <Tab.Screen
        name="ReportsScreen"
        component={ReportsScreen}
        // The label is drawn inside the icon, so VoiceOver needs it named here
        // (it read the route name: "ReportsScreen, tab, 2 of 4").
        options={{headerShown: false, tabBarIcon: ReportsIcon, tabBarAccessibilityLabel: t('tabs.reports')}}
      />
      <Tab.Screen
        name="CategoryScreen"
        component={CategoryScreen}
        options={{headerShown: false, tabBarIcon: CategoriesIcon, tabBarAccessibilityLabel: t('tabs.categories')}}
      />
      <Tab.Screen
        name="DebtsScreen"
        component={DebtsScreen}
        options={{headerShown: false, tabBarIcon: DebtIcon, tabBarAccessibilityLabel: t('tabs.debts')}}
      />
    </Tab.Navigator>
  );
};

const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="TabStack" component={TabStack} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="AddTransactionsScreen" component={AddTransactionsScreen} />
      <Stack.Screen name="UpdateTransactionScreen" component={UpdateTransactionScreen} />
      <Stack.Screen name="AddCategoryScreen" component={AddCategoryScreen} />
      <Stack.Screen name="UpdateCategoryScreen" component={UpdateCategoryScreen} />
      <Stack.Screen name="EverydayTransactionScreen" component={EverydayTransactionScreen} />
      <Stack.Screen name="CategoryTransactionScreen" component={CategoryTransactionScreen} />
      <Stack.Screen name="AddDebtorScreen" component={AddDebtorScreen} />
      <Stack.Screen name="IndividualDebtsScreen" component={IndividualDebtsScreen} />
      <Stack.Screen name="AddDebtsScreen" component={AddDebtsScreen} />
      <Stack.Screen name="UpdateDebtScreen" component={UpdateDebtScreen} />
      <Stack.Screen name="UpdateDebtorScreen" component={UpdateDebtorScreen} />
      <Stack.Screen name="DiagnosticsScreen" component={DiagnosticsScreen} />
    </Stack.Navigator>
  );
};

export default HomeStack;
