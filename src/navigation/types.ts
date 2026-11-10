import type {NavigatorScreenParams} from '@react-navigation/native';
import type {IsoDay} from '../domain/types';

export type TabParamList = {
  HomeScreen: undefined;
  ReportsScreen: undefined;
  CategoryScreen: undefined;
  MoneyScreen: undefined;
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
  /** The quick-add sheet over the app (zero://quick): which entry, and a widget chip's category. */
  /** `amount` and `title`: "Add again" opens the sheet filled in (validated in linking.ts). */
  QuickAddScreen: {kind?: 'expense' | 'income'; categoryId?: string; amount?: string; title?: string} | undefined;
  UpdateTransactionScreen: {expenseId: string};
  /** Records (no refundId) or edits money that came back on an expense. */
  RefundScreen: {expenseId: string; refundId?: string};
  /** `yearMonth`: the month the Money tab showed; the date defaults into it. */
  AddIncomeScreen: {yearMonth?: string};
  UpdateIncomeScreen: {incomeId: string};
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
