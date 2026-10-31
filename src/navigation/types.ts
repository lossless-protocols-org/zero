import type {NavigatorScreenParams} from '@react-navigation/native';
import type {IsoDay} from '../domain/types';

export type TabParamList = {
  HomeScreen: undefined;
  ReportsScreen: undefined;
  CategoryScreen: undefined;
  DebtsScreen: undefined;
};

/**
 * Routes carry ids, never display copies (M19, v2.7.1): a name, amount or
 * colour passed along goes stale the moment it is edited elsewhere. Screens
 * read the current row.
 */
export type HomeStackParamList = {
  TabStack: NavigatorScreenParams<TabParamList>;
  SettingsScreen: undefined;
  DiagnosticsScreen: undefined;
  AddTransactionsScreen: undefined;
  UpdateTransactionScreen: {expenseId: string};
  AddCategoryScreen: undefined;
  UpdateCategoryScreen: {categoryId: string};
  EverydayTransactionScreen: {isDate: IsoDay};
  CategoryTransactionScreen: {categoryId: string; yearMonth: string};
  AddDebtorScreen: undefined;
  IndividualDebtsScreen: {debtorId: string};
  AddDebtsScreen: {debtorId: string};
  UpdateDebtScreen: {debtId: string};
  UpdateDebtorScreen: {debtorId: string};
};

export type OnboardingStackParamList = {
  SplashScreen: undefined;
  WelcomeScreen: undefined;
  ExistingUserScreen: undefined;
  PersonalizeScreen: undefined;
  PickCategoriesScreen: undefined;
  ChooseCurrencyScreen: undefined;
};
