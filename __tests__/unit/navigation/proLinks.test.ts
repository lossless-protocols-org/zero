/**
 * A link to a Pro screen without Pro goes nowhere (3.0 law L8): the screen is
 * not mounted, so the link is dropped and the app opens where it would have
 * anyway (Home on a cold start). With Pro it is an ordinary link.
 */
import {isProRoute, PRO_ROUTES, proAwareGetStateFromPath} from '../../../src/navigation/proLinks';

type Read = ReturnType<typeof proAwareGetStateFromPath>;
// A made-up app: one ordinary screen, one Pro screen, one screen inside the tabs.
const config = {
  initialRouteName: 'TabStack',
  screens: {AddTransactionsScreen: 'add', AccountsScreen: 'accounts', TabStack: {screens: {MoneyScreen: 'money'}}},
} as Parameters<Read>[1];
const leaf = (state: ReturnType<ReturnType<typeof proAwareGetStateFromPath>>): string | undefined => {
  const route = state?.routes[state.routes.length - 1];
  return route?.state ? leaf(route.state as typeof state) : route?.name;
};

it('drops a link to a Pro screen when Pro is not on', () => {
  const read = proAwareGetStateFromPath(['AccountsScreen'], () => false);
  expect(read('accounts', config)).toBeUndefined();
});

it('follows it when Pro is on', () => {
  const read = proAwareGetStateFromPath(['AccountsScreen'], () => true);
  expect(leaf(read('accounts', config))).toBe('AccountsScreen');
});

it('leaves every other link alone in both tiers, nested ones included', () => {
  for (const pro of [true, false]) {
    const read = proAwareGetStateFromPath(['AccountsScreen'], () => pro);
    expect(leaf(read('add', config))).toBe('AddTransactionsScreen');
    expect(leaf(read('money', config))).toBe('MoneyScreen');
  }
});

it('a nested Pro route is dropped too', () => {
  const read = proAwareGetStateFromPath(['MoneyScreen'], () => false);
  expect(read('money', config)).toBeUndefined();
});

it('knows a Pro route by name', () => {
  expect(isProRoute('AccountsScreen', ['AccountsScreen'])).toBe(true);
  expect(isProRoute('HomeScreen', ['AccountsScreen'])).toBe(false);
  expect(isProRoute(undefined, ['AccountsScreen'])).toBe(false);
});

it('names the P8 to P12 screens, and no screen a free user already has', () => {
  expect(PRO_ROUTES).toEqual([
    'AccountsScreen',
    'AccountScreen',
    'AccountFormScreen',
    'GroupFormScreen',
    'TransferScreen',
    'ReconcileScreen',
    'NetWorthScreen',
    'RecurringScreen',
    'RuleFormScreen',
    'ConfirmRecurringScreen',
    'AutoBackupScreen',
    'BackupPassphraseScreen',
    'RangeReportScreen',
    'TrendsScreen',
  ]);
  // The forms a free user opens (add expense, money in, refund) stay out: they only grow an account row.
  for (const free of ['AddTransactionsScreen', 'AddIncomeScreen', 'RefundScreen', 'MoneyScreen']) {
    expect(isProRoute(free)).toBe(false);
  }
});
