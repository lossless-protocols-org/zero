/**
 * Pro screens do not exist for someone without Pro (3.0 law L8): they are in
 * the navigator only while Pro is applied, so there is nothing to lock and
 * nothing to reach. The real HomeStack, with one made-up Pro screen in the
 * registry and every other screen blank.
 */
import React from 'react';
import {Text} from 'react-native';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {act, screen} from '@testing-library/react-native';
import {HomeStack} from '../../../src/navigation/HomeStack';
import {getAppliedPro} from '../../../src/pro/proGate';
import {resetEntitlement, setEntitlement} from '../../harness/mocks/entitlement';
import {renderWithTheme} from '../../harness/render';

jest.mock('react-i18next', () => require('../../harness/mocks/reactI18next'));
jest.mock('../../../src/pro/entitlementStore', () => require('../../harness/mocks/entitlement').entitlementStoreMock());
jest.mock('../../../src/navigation/ProAnnouncements', () => ({ProAnnouncements: () => null}));
jest.mock('../../../src/navigation/proLinks', () => ({
  ...jest.requireActual('../../../src/navigation/proLinks'),
  isProRoute: (name?: string) => name === 'FakeProScreen',
}));
jest.mock('../../../src/navigation/ProStack', () => {
  const {Text: T} = require('react-native');
  return {PRO_SCREENS: [{name: 'FakeProScreen', component: () => <T>a Pro screen</T>}]};
});
// Every real screen is blank here: this suite is about which routes exist.
jest.mock('../../../src/features/spending/screens/HomeScreen', () => ({HomeScreen: () => null}));
jest.mock('../../../src/features/reports/screens/ReportsScreen', () => ({ReportsScreen: () => null}));
jest.mock('../../../src/features/money/screens/MoneyScreen', () => ({MoneyScreen: () => null}));
jest.mock('../../../src/features/categories/screens/CategoryScreen', () => ({CategoryScreen: () => null}));
jest.mock('../../../src/features/settings/screens/SettingsScreen', () => ({SettingsScreen: () => null}));
jest.mock('../../../src/features/settings/screens/DiagnosticsScreen', () => ({DiagnosticsScreen: () => null}));
jest.mock('../../../src/features/pro/screens/WhatsNewScreen', () => ({WhatsNewScreen: () => null}));
jest.mock('../../../src/features/spending/screens/AddTransactionsScreen', () => ({AddTransactionsScreen: () => null}));
jest.mock('../../../src/features/widgets/screens/QuickAddScreen', () => ({QuickAddScreen: () => null}));
jest.mock('../../../src/features/spending/screens/UpdateTransactionScreen', () => ({
  UpdateTransactionScreen: () => null,
}));
jest.mock('../../../src/features/spending/screens/RefundScreen', () => ({RefundScreen: () => null}));
jest.mock('../../../src/features/money/screens/AddIncomeScreen', () => ({AddIncomeScreen: () => null}));
jest.mock('../../../src/features/money/screens/UpdateIncomeScreen', () => ({UpdateIncomeScreen: () => null}));
jest.mock('../../../src/features/categories/screens/AddCategoryScreen', () => ({AddCategoryScreen: () => null}));
jest.mock('../../../src/features/categories/screens/UpdateCategoryScreen', () => ({UpdateCategoryScreen: () => null}));
jest.mock('../../../src/features/money/screens/AddDebtorScreen', () => ({AddDebtorScreen: () => null}));
jest.mock('../../../src/features/money/screens/IndividualDebtsScreen', () => ({IndividualDebtsScreen: () => null}));
jest.mock('../../../src/features/money/screens/AddDebtsScreen', () => ({AddDebtsScreen: () => null}));
jest.mock('../../../src/features/money/screens/UpdateDebtScreen', () => ({UpdateDebtScreen: () => null}));
jest.mock('../../../src/features/spending/screens/EverydayTransactionScreen', () => ({
  EverydayTransactionScreen: () => null,
}));
jest.mock('../../../src/features/spending/screens/CategoryTransactionScreen', () => ({
  CategoryTransactionScreen: () => null,
}));
jest.mock('../../../src/features/money/screens/UpdateDebtorScreen', () => ({UpdateDebtorScreen: () => null}));

const navigation = createNavigationContainerRef<Record<string, undefined>>();

const mount = async () => {
  await renderWithTheme(
    <NavigationContainer ref={navigation}>
      <HomeStack />
      <Text>mounted</Text>
    </NavigationContainer>,
  );
};
const routeNames = (): string[] => navigation.getRootState()?.routeNames ?? [];
const current = (): string | undefined => navigation.getCurrentRoute()?.name;

afterEach(async () => {
  await act(async () => resetEntitlement());
});

it.each(['none', 'pending', 'onHold', 'expired', 'revoked'] as const)(
  'without Pro (%s) the Pro screen is not in the navigator and cannot be opened',
  async state => {
    await act(async () => setEntitlement({state}));
    await mount();
    expect(routeNames()).not.toContain('FakeProScreen');
    // React Navigation says, in development, that nothing handled the action: there is no such route.
    const complaint = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => navigation.navigate('FakeProScreen'));
    expect(String(complaint.mock.calls[0]?.[0])).toContain('was not handled');
    complaint.mockRestore();
    expect(current()).toBe('HomeScreen');
    expect(screen.queryByText('a Pro screen')).toBeNull();
  },
);

it.each(['trial', 'subscribed', 'grace', 'lifetime'] as const)('with Pro (%s) it exists and opens', async state => {
  await act(async () => setEntitlement({state}));
  await mount();
  expect(routeNames()).toContain('FakeProScreen');
  await act(async () => navigation.navigate('FakeProScreen'));
  expect(current()).toBe('FakeProScreen');
  expect(screen.getByText('a Pro screen')).toBeTruthy();
});

it('Pro ending while a Pro screen is open leaves it open, and removes it once the user goes back', async () => {
  await act(async () => setEntitlement({state: 'subscribed'}));
  await mount();
  await act(async () => navigation.navigate('FakeProScreen'));
  await act(async () => setEntitlement({state: 'expired'}));
  // Still there: nobody is thrown out of a screen they are using.
  expect(current()).toBe('FakeProScreen');
  expect(getAppliedPro()).toBe(true);
  await act(async () => navigation.goBack());
  expect(current()).toBe('HomeScreen');
  expect(getAppliedPro()).toBe(false);
  expect(routeNames()).not.toContain('FakeProScreen');
});

it('a Pro screen under another screen still holds the downgrade: what was typed there is not thrown away', async () => {
  await act(async () => setEntitlement({state: 'subscribed'}));
  await mount();
  await act(async () => navigation.navigate('FakeProScreen'));
  // A picker, or a widget link, opens over the Pro form.
  await act(async () => navigation.navigate('AddTransactionsScreen'));
  await act(async () => setEntitlement({state: 'expired'}));
  expect(getAppliedPro()).toBe(true);
  expect(routeNames()).toContain('FakeProScreen');
  await act(async () => navigation.goBack());
  expect(current()).toBe('FakeProScreen');
  await act(async () => navigation.goBack());
  expect(getAppliedPro()).toBe(false);
  expect(routeNames()).not.toContain('FakeProScreen');
});

it('Pro arriving adds the screen at once', async () => {
  await mount();
  expect(routeNames()).not.toContain('FakeProScreen');
  await act(async () => setEntitlement({state: 'lifetime'}));
  expect(routeNames()).toContain('FakeProScreen');
});
