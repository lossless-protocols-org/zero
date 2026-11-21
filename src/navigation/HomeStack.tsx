import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {HomeScreen} from '../features/spending/screens/HomeScreen';
import {createBottomTabNavigator, type BottomTabBarButtonProps} from '@react-navigation/bottom-tabs';
import {Platform, Pressable, Text, View} from 'react-native';
import type {HomeStackParamList, TabParamList} from './types';
import {useTranslation} from 'react-i18next';
import {Icon} from '../ui/atoms/Icons';
import {useThemeColors} from '../ui/hooks/useThemeColors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ReportsScreen} from '../features/reports/screens/ReportsScreen';
import {MoneyScreen} from '../features/money/screens/MoneyScreen';
import {DebtsScreen} from '../features/money/screens/DebtsScreen';
import {CategoryScreen} from '../features/categories/screens/CategoryScreen';
import {SettingsScreen} from '../features/settings/screens/SettingsScreen';
import {DiagnosticsScreen} from '../features/settings/screens/DiagnosticsScreen';
import {WhatsNewScreen} from '../features/pro/screens/WhatsNewScreen';
import {setProScreenOpen} from '../pro/proGate';
import {useAppliedPro} from '../ui/hooks/useProFeature';
import {ProAnnouncements} from './ProAnnouncements';
import {isProRoute} from './proLinks';
import {PRO_SCREENS} from './ProStack';
import {AddTransactionsScreen} from '../features/spending/screens/AddTransactionsScreen';
import {QuickAddScreen} from '../features/widgets/screens/QuickAddScreen';
import {UpdateTransactionScreen} from '../features/spending/screens/UpdateTransactionScreen';
import {RefundScreen} from '../features/spending/screens/RefundScreen';
import {AddIncomeScreen} from '../features/money/screens/AddIncomeScreen';
import {UpdateIncomeScreen} from '../features/money/screens/UpdateIncomeScreen';
import {AddCategoryScreen} from '../features/categories/screens/AddCategoryScreen';
import {UpdateCategoryScreen} from '../features/categories/screens/UpdateCategoryScreen';
import {AddDebtorScreen} from '../features/money/screens/AddDebtorScreen';
import {IndividualDebtsScreen} from '../features/money/screens/IndividualDebtsScreen';
import {AddDebtsScreen} from '../features/money/screens/AddDebtsScreen';
import {UpdateDebtScreen} from '../features/money/screens/UpdateDebtScreen';
import {EverydayTransactionScreen} from '../features/spending/screens/EverydayTransactionScreen';
import {CategoryTransactionScreen} from '../features/spending/screens/CategoryTransactionScreen';
import {UpdateDebtorScreen} from '../features/money/screens/UpdateDebtorScreen';
import {gs} from '../ui/globalStyles';
import {tabBarLayout} from './tabBarLayout';

const screenOptions = {
  headerShown: false,
};

/** The quick-add sheet sits over the app and animates itself (useSheetMotion). */
const quickAddOptions = {
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: {backgroundColor: 'transparent'},
} as const;

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

const MoneyIcon = ({color}: {color: string}) => {
  const {t} = useTranslation();
  return (
    <View style={[gs.center, gs.minW70]}>
      <View style={[gs.h26, gs.center]}>
        <Icon name="wallet" size={ICON_SIZE} color={color} />
      </View>
      <Text {...TAB_LABEL_TEXT} style={[gs.text10, gs.fontMedium, gs.noFontPadding, gs.textCenter, gs.mt2, {color}]}>
        {t('tabs.money')}
      </Text>
    </View>
  );
};

const DebtsIcon = ({color}: {color: string}) => {
  const {t} = useTranslation();
  return (
    <View style={[gs.center, gs.minW70]}>
      <View style={[gs.h26, gs.center]}>
        <Icon name="users-2" size={ICON_SIZE} color={color} />
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
        // A tab out of sight keeps its state but does not render (react-native-screens):
        // a month change or refetch on Home re-rendered Reports, Categories and Money too,
        // heatmap and donut included (audit 2026-11-08 §8.3). It catches up when shown.
        freezeOnBlur: true,
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
      {/* Held and owed (A2): Money is what is held, Debts is what is owed. 2.8 had both under Money. */}
      <Tab.Screen
        name="MoneyScreen"
        component={MoneyScreen}
        options={{headerShown: false, tabBarIcon: MoneyIcon, tabBarAccessibilityLabel: t('tabs.money')}}
      />
      <Tab.Screen
        name="DebtsScreen"
        component={DebtsScreen}
        options={{headerShown: false, tabBarIcon: DebtsIcon, tabBarAccessibilityLabel: t('tabs.debts')}}
      />
      <Tab.Screen
        name="CategoryScreen"
        component={CategoryScreen}
        options={{headerShown: false, tabBarIcon: CategoriesIcon, tabBarAccessibilityLabel: t('tabs.categories')}}
      />
    </Tab.Navigator>
  );
};

/**
 * Tells the gate whether a Pro screen is open: a downgrade waits until none is. Anywhere in the
 * stack, not only on top: a Pro form with a picker or a widget link opened over it is still open,
 * and removing it underneath would throw away what was typed.
 */
const proScreenListeners = {
  state: (event: {data: {state: {routes: Array<{name: string}>}}}) => {
    setProScreenOpen(event.data.state.routes.some(route => isProRoute(route.name)));
  },
};

export const HomeStack = () => {
  // L8: Pro screens are in the navigator only while Pro is applied. Without it they do not exist.
  const pro = useAppliedPro();
  return (
    <>
      <ProAnnouncements />
      <Stack.Navigator screenOptions={screenOptions} screenListeners={proScreenListeners}>
        <Stack.Screen name="TabStack" component={TabStack} />
        <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
        <Stack.Screen name="AddTransactionsScreen" component={AddTransactionsScreen} />
        <Stack.Screen name="QuickAddScreen" component={QuickAddScreen} options={quickAddOptions} />
        <Stack.Screen name="UpdateTransactionScreen" component={UpdateTransactionScreen} />
        <Stack.Screen name="RefundScreen" component={RefundScreen} />
        <Stack.Screen name="AddIncomeScreen" component={AddIncomeScreen} />
        <Stack.Screen name="UpdateIncomeScreen" component={UpdateIncomeScreen} />
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
        <Stack.Screen name="WhatsNewScreen" component={WhatsNewScreen} />
        {pro
          ? PRO_SCREENS.map(({name, component}) => (
              // A Pro route's name and params are declared by the phase that adds it (plan P8 onward).
              <Stack.Screen key={name} name={name as keyof HomeStackParamList} component={component} />
            ))
          : null}
      </Stack.Navigator>
    </>
  );
};
