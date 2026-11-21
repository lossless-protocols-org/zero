/**
 * The one place zero Pro is sold (3.0): what it adds, what stays free, and
 * every way to buy with its price and terms in full before the button. The
 * store here is a script; the sheet, its hooks and the entitlement gate are real.
 */
import React from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {PRIVACY_POLICY_URL, TERMS_URL} from '../../../../../src/constants/links';
import {UpgradeSheet} from '../../../../../src/features/pro/sheets/UpgradeSheet';
import {nativeBilling} from '../../../../../src/pro/billing';
import type {StoreProduct} from '../../../../../src/pro/schema';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {nextStoreAnswer, resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import type {FakeBilling} from '../../../../harness/fakeBilling';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {renderWithTheme} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/ui/atoms/CustomBottomSheet', () => require('../../../../harness/mocks/bottomSheet'));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
// As if two features had shipped; `search` has no line on the sheet, and the rest are not built.
jest.mock('../../../../../src/pro/features', () => ({
  ...jest.requireActual('../../../../../src/pro/features'),
  SHIPPED_PRO_FEATURES: ['accounts', 'recurring', 'search'],
}));
jest.mock('../../../../../src/pro/billing', () => ({
  nativeBilling: require('../../../../harness/fakeBilling').createFakeBilling(),
}));

// The store of this suite: the fake the mock above put in place of the native one.
const billing = nativeBilling as FakeBilling;
const NOW = new Date(2026, 10, 10, 12, 0, 0);

const product = (id: string, more: Partial<StoreProduct> = {}): StoreProduct => ({
  id,
  displayPrice: '$1',
  currencyCode: 'USD',
  period: null,
  trialDays: null,
  offerToken: null,
  ...more,
});
const MONTHLY = product('zero_pro_monthly', {displayPrice: '$2.99', period: 'month', trialDays: 14});
const LIFETIME = product('zero_pro_lifetime', {displayPrice: '$29.99'});

beforeEach(() => {
  jest.useFakeTimers({now: NOW, advanceTimers: true});
  billing.products = [MONTHLY, LIFETIME];
  billing.isAvailable = async () => true;
  billing.calls.length = 0;
  jest.spyOn(SheetManager, 'hide').mockResolvedValue(undefined);
  setMockTranslations({
    'pro.trialLineIos': 'Free for {{days}} days, then {{price}} from {{date}} in the App Store',
    'pro.pricePerMonth': '{{price}} a month',
    'pro.priceOnce': '{{price}} once',
    'pro.thanksNote': 'Usually {{price}}',
  });
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  resetDialogs();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const open = async () => {
  await renderWithTheme(<UpgradeSheet sheetId="upgrade-sheet" />);
  await waitFor(() => expect(screen.queryByLabelText('pro.loading')).toBeNull());
};
const headers = () => screen.getAllByRole('header').map(node => node.props['children'] as string);

it('says what Pro adds and what stays free before any price', async () => {
  await open();
  for (const key of ['pro.lead', 'pro.adds', 'pro.featureAccounts', 'pro.featureRecurring', 'pro.staysFree']) {
    expect(screen.getByText(key)).toBeTruthy();
  }
});

it('lists only what this build does: a feature that has not shipped is not promised', async () => {
  await open();
  expect(screen.queryByText('pro.featureIncome')).toBeNull();
  expect(screen.queryByText('pro.featureBackup')).toBeNull();
});

it('while a payment is clearing it says so and sells nothing more', async () => {
  await act(async () => setEntitlement({state: 'pending', productId: 'zero_pro_lifetime'}));
  await open();
  expect(screen.getByText('pro.pending')).toBeTruthy();
  expect(screen.queryByText('pro.monthly')).toBeNull();
  expect(screen.queryByText('pro.lifetime')).toBeNull();
  // Restore is still there: it is how a cleared payment is picked up by hand.
  expect(screen.getByRole('button', {name: 'pro.restore'})).toBeTruthy();
});

it('prints the trial with the date of the first charge and the store’s own price', async () => {
  await open();
  const line = screen.getByText(/^Free for 14 days, then \$2\.99 from /);
  // Fourteen days after 10 November.
  expect(line.props['children']).toMatch(/24/);
  expect(line.props['children']).toMatch(/Nov/);
  expect(screen.getByText('$2.99 a month')).toBeTruthy();
  expect(screen.getByRole('button', {name: 'pro.startTrial'})).toBeTruthy();
});

it('a buyer with no trial is told it renews, and the button says Subscribe', async () => {
  billing.products = [{...MONTHLY, trialDays: null}, LIFETIME];
  await open();
  expect(screen.getByText('pro.renewLineIos')).toBeTruthy();
  expect(screen.getByRole('button', {name: 'pro.subscribe'})).toBeTruthy();
  expect(screen.queryByRole('button', {name: 'pro.startTrial'})).toBeNull();
});

it('shows monthly first, and lifetime first where the store prices in rupees or pesos', async () => {
  await open();
  expect(headers()).toEqual(['pro.title', 'pro.adds', 'pro.monthly', 'pro.lifetime']);
  await screen.unmount();
  billing.products = [
    {...MONTHLY, currencyCode: 'INR'},
    {...LIFETIME, currencyCode: 'INR'},
  ];
  await open();
  expect(headers()).toEqual(['pro.title', 'pro.adds', 'pro.lifetime', 'pro.monthly']);
});

it('says purchases follow the store account, and links the terms and the privacy policy', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await open();
  expect(screen.getByText('pro.accountNote')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', {name: 'pro.terms'}));
  await fireEvent.press(screen.getByRole('link', {name: 'pro.privacy'}));
  expect(openURL.mock.calls.map(([url]) => url)).toEqual([TERMS_URL, PRIVACY_POLICY_URL]);
});

it('buys what is tapped, announces Pro, and closes', async () => {
  nextStoreAnswer({state: 'lifetime', productId: 'zero_pro_lifetime'}, {kind: 'known', records: 1});
  await open();
  await fireEvent.press(screen.getByRole('button', {name: 'pro.buyLifetime'}));
  await waitFor(() => expect(dialogsSaid()).toEqual(['success: pro.purchased']));
  expect(billing.calls).toContain('purchase zero_pro_lifetime');
  expect(SheetManager.hide).toHaveBeenCalledWith('upgrade-sheet');
});

it('restores from the sheet', async () => {
  nextStoreAnswer({}, {kind: 'known', records: 0});
  await open();
  await fireEvent.press(screen.getByRole('button', {name: 'pro.restore'}));
  await waitFor(() => expect(dialogsSaid()).toEqual(['info: pro.nothingToRestore']));
});

it('a build with no store sells nothing and says so: no price, no Restore', async () => {
  billing.isAvailable = async () => false;
  await open();
  expect(screen.getByText('pro.unavailable')).toBeTruthy();
  expect(screen.queryByRole('button', {name: 'pro.restore'})).toBeNull();
  expect(screen.queryByText('pro.monthly')).toBeNull();
  // What Pro is can still be read.
  expect(screen.getByText('pro.featureAccounts')).toBeTruthy();
});

it('a store that returns nothing is said plainly, with a way to ask again', async () => {
  billing.products = [];
  await open();
  expect(screen.getByText('pro.noProducts')).toBeTruthy();
  billing.products = [LIFETIME];
  await fireEvent.press(screen.getByRole('button', {name: 'pro.tryAgain'}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'pro.buyLifetime'})).toBeTruthy());
});

it('a subscriber is offered lifetime, not a second subscription', async () => {
  await act(async () => setEntitlement({state: 'subscribed', productId: 'zero_pro_monthly'}));
  await open();
  expect(screen.queryByText('pro.monthly')).toBeNull();
  expect(screen.getByRole('button', {name: 'pro.buyLifetime'})).toBeTruthy();
});

it('a lifetime owner is offered nothing more', async () => {
  await act(async () => setEntitlement({state: 'lifetime', productId: 'zero_pro_lifetime'}));
  await open();
  expect(screen.queryByText('pro.monthly')).toBeNull();
  expect(screen.queryByText('pro.lifetime')).toBeNull();
  expect(screen.queryByText('pro.alsoSubscribed')).toBeNull();
});

it('a lifetime owner whose subscription still renews is told to cancel it, with the way there', async () => {
  await act(async () => setEntitlement({state: 'lifetime', productId: 'zero_pro_lifetime', alsoSubscribed: true}));
  await open();
  expect(screen.getByText('pro.alsoSubscribed')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', {name: 'pro.manage'}));
  expect(billing.calls).toContain('openManageSubscriptions');
});

it('every control has a role and a name a screen reader can say', async () => {
  await open();
  for (const role of ['button', 'link'] as const) {
    expect(screen.getAllByRole(role, {name: /.+/})).toHaveLength(screen.getAllByRole(role).length);
  }
  // Start trial, buy lifetime, restore, and the sheet's own close button; the two links.
  expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  expect(screen.getAllByRole('link')).toHaveLength(2);
});

it('closes on its close button', async () => {
  await open();
  await fireEvent.press(screen.getByLabelText('close-sheet'));
  expect(SheetManager.hide).toHaveBeenCalledWith('upgrade-sheet');
});
