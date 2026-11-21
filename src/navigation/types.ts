import type {NavigatorScreenParams} from '@react-navigation/native';
import type {IsoDay} from '../domain/types';
import type {AccountClass} from '../domain/accounts';

export type TabParamList = {
  HomeScreen: undefined;
  ReportsScreen: undefined;
  CategoryScreen: undefined;
  MoneyScreen: undefined;
  /** What is owed: people for everyone; cards and loans with Pro (approved model A2). */
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
  /** "What's new in 3.0": opened once by the app itself, on an install that updated from before 3.0. */
  WhatsNewScreen: undefined;
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
  /** `kind` 'income': a money-in category (Pro, 3.0); otherwise an expense one. */
  AddCategoryScreen: {kind?: 'income'} | undefined;
  UpdateCategoryScreen: {categoryId: string};
  EverydayTransactionScreen: {isDate: IsoDay};
  CategoryTransactionScreen: {categoryId: string; yearMonth: string};
  AddDebtorScreen: undefined;
  IndividualDebtsScreen: {debtorId: string};
  AddDebtsScreen: {debtorId: string};
  UpdateDebtScreen: {debtId: string};
  UpdateDebtorScreen: {debtorId: string};
  // Pro (3.0, plan P8). Mounted only while Pro is applied (ProStack.tsx, L8); names also in proLinks.ts.
  AccountsScreen: undefined;
  AccountScreen: {accountId: string};
  /** No accountId: a new account. */
  /** `accountClass`: what a new account starts as (the Debts tab opens it on Card). */
  AccountFormScreen: {accountId?: string; accountClass?: AccountClass} | undefined;
  /** Renames one group of accounts (Categories tab, Accounts): the class it is in and its key (accountKindKey). */
  GroupFormScreen: {accountClass: AccountClass; groupKey: string};
  /** No transferId: a new transfer, from `fromAccountId` when given. */
  /** `toAccountId` and `amount`: paying a card's bill starts with the card and what is owed filled in. */
  TransferScreen: {transferId?: string; fromAccountId?: string; toAccountId?: string; amount?: number} | undefined;
  ReconcileScreen: {accountId: string};
  NetWorthScreen: undefined;
  // Pro (3.0, plan P9).
  RecurringScreen: undefined;
  /** No ruleId: a new rule. */
  RuleFormScreen: {ruleId?: string} | undefined;
  /** The occurrence of a "varies" rule waiting for its amount. */
  ConfirmRecurringScreen: {ruleId: string; index: number};
  AutoBackupScreen: undefined;
  BackupPassphraseScreen: undefined;
  RangeReportScreen: undefined;
  TrendsScreen: undefined;
};

export type OnboardingStackParamList = {
  SplashScreen: undefined;
  WelcomeScreen: undefined;
  ExistingUserScreen: undefined;
  PersonalizeScreen: undefined;
  PickCategoriesScreen: undefined;
  ChooseCurrencyScreen: undefined;
};
