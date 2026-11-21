/**
 * Settings → zero Pro (3.0): the one upgrade entry, with a line saying where
 * the purchase stands; Restore; the store's page for a subscription; and the
 * rows only Pro shows, counted and removable (law L9).
 */
import React from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import * as proData from '../../../../../src/data/services/proDataService';
import {ProSection} from '../../../../../src/features/settings/components/ProSection';
import {nativeBilling} from '../../../../../src/pro/billing';
import type {Entitlement} from '../../../../../src/pro/schema';
import {answerNextDialog, dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {nextStoreAnswer, resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import type {FakeBilling} from '../../../../harness/fakeBilling';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {renderWithTheme} from '../../../../harness/render';

// Settings counts kept Pro data on focus (useFreshWhileFocused); rendered alone, mounted is focused.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('../../../../../src/pro/billing', () => ({
  nativeBilling: require('../../../../harness/fakeBilling').createFakeBilling(),
}));

const billing = nativeBilling as FakeBilling;
let kept = 0;

beforeEach(() => {
  kept = 0;
  billing.calls.length = 0;
  jest.spyOn(SheetManager, 'show').mockResolvedValue(undefined);
  jest.spyOn(proData, 'countKeptProData').mockImplementation(async () => kept);
  jest.spyOn(proData, 'removeProData').mockImplementation(async () => {
    kept = 0;
  });
  setMockTranslations({'pro.endsOn': 'Pro ends on {{date}}', 'pro.keptSubtitle': '{{count}} hidden'});
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  resetDialogs();
  jest.restoreAllMocks();
});

const open = async (entitlement: Partial<Entitlement> = {}) => {
  await act(async () => setEntitlement(entitlement));
  await renderWithTheme(<ProSection />);
  await waitFor(() => expect(screen.getByRole('header', {name: 'settings.sectionPro'})).toBeTruthy());
};
/** The first row's accessible name: "<label>. <subtitle>". */
const proRow = (subtitle: string) => screen.getByRole('button', {name: `pro.title. ${subtitle}`});
const has = (label: string) =>
  screen.queryByRole('button', {name: new RegExp(`^${label.replace('.', '\\.')}`)}) !== null;

it('the first row opens the upgrade sheet', async () => {
  await open();
  await fireEvent.press(proRow('pro.rowSubtitle'));
  expect(SheetManager.show).toHaveBeenCalledWith('upgrade-sheet');
});

it.each([
  ['none', 'pro.rowSubtitle'],
  ['trial', 'pro.statusTrial'],
  ['subscribed', 'pro.statusSubscribed'],
  ['lifetime', 'pro.statusLifetime'],
  ['grace', 'pro.statusGrace'],
  ['pending', 'pro.statusPending'],
  ['onHold', 'pro.statusOnHold'],
  ['expired', 'pro.statusExpired'],
  ['revoked', 'pro.statusRevoked'],
] as const)('in state %s the row says %s', async (state, subtitle) => {
  await open({state});
  expect(proRow(subtitle)).toBeTruthy();
});

it('a cancelled subscription says when Pro ends, where the store reports the date', async () => {
  await open({state: 'subscribed', willRenew: false, expiresAtMs: new Date(2026, 11, 12, 10).getTime()});
  const row = screen.getByRole('button', {name: /^pro\.title\. Pro ends on /});
  expect(row.props['accessibilityLabel']).toMatch(/12/);
  expect(row.props['accessibilityLabel']).toMatch(/Dec/);
});

it('with no date from the store (Google Play), a cancelled subscription just reads as subscribed', async () => {
  await open({state: 'subscribed', willRenew: false, expiresAtMs: null});
  expect(proRow('pro.statusSubscribed')).toBeTruthy();
});

it('a lifetime owner with a live subscription is told to cancel it, and given the way there', async () => {
  await open({state: 'lifetime', alsoSubscribed: true});
  expect(proRow('pro.alsoSubscribed')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', {name: /^pro\.manage\./}));
  expect(billing.calls).toEqual(['openManageSubscriptions']);
});

it('"Manage subscription" shows exactly when a store subscription exists', async () => {
  for (const state of ['trial', 'subscribed', 'grace', 'onHold'] as const) {
    await open({state});
    expect({state, manage: has('pro.manage')}).toEqual({state, manage: true});
    await screen.unmount();
  }
  for (const state of ['none', 'pending', 'expired', 'revoked', 'lifetime'] as const) {
    await open({state});
    expect({state, manage: has('pro.manage')}).toEqual({state, manage: false});
    await screen.unmount();
  }
});

it('"Restore purchases" shows exactly when Pro is not on, and says how it went', async () => {
  for (const state of ['trial', 'subscribed', 'grace', 'lifetime'] as const) {
    await open({state});
    expect({state, restore: has('pro.restore')}).toEqual({state, restore: false});
    await screen.unmount();
  }
  await open({state: 'expired'});
  nextStoreAnswer({state: 'lifetime'}, {kind: 'known', records: 1});
  await fireEvent.press(screen.getByRole('button', {name: /^pro\.restore\./}));
  await waitFor(() => expect(dialogsSaid()).toEqual(['success: pro.restored']));
});

describe('data only Pro shows (L9)', () => {
  it('is not mentioned when there is none', async () => {
    await open({state: 'expired'});
    expect(has('pro.keptTitle')).toBe(false);
    expect(has('pro.keptRemove')).toBe(false);
  });

  it('is not mentioned while Pro is on: nothing is hidden then', async () => {
    kept = 4;
    await open({state: 'lifetime'});
    expect(has('pro.keptTitle')).toBe(false);
  });

  it('is counted and explained when Pro is off', async () => {
    kept = 4;
    await open({state: 'expired'});
    const row = await screen.findByRole('button', {name: 'pro.keptTitle. 4 hidden'});
    await fireEvent.press(row);
    expect(dialogsSaid()).toEqual(['info: pro.keptBody']);
  });

  it('is removed only after a confirmation, and the rows then go', async () => {
    kept = 4;
    await open({state: 'expired'});
    await fireEvent.press(await screen.findByRole('button', {name: 'pro.keptRemove'}));
    await waitFor(() => expect(dialogsSaid()).toEqual(['warning: pro.keptRemoveConfirm', 'success: pro.keptRemoved']));
    expect(proData.removeProData).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(has('pro.keptRemove')).toBe(false));
  });

  it('is left alone when the confirmation is declined', async () => {
    kept = 4;
    await open({state: 'expired'});
    answerNextDialog(false);
    await fireEvent.press(await screen.findByRole('button', {name: 'pro.keptRemove'}));
    await waitFor(() => expect(dialogsSaid()).toEqual(['warning: pro.keptRemoveConfirm']));
    expect(proData.removeProData).not.toHaveBeenCalled();
    expect(has('pro.keptRemove')).toBe(true);
  });

  it('a removal that fails says nothing was changed', async () => {
    kept = 4;
    jest.mocked(proData.removeProData).mockRejectedValue(new Error('disk full'));
    await open({state: 'expired'});
    await fireEvent.press(await screen.findByRole('button', {name: 'pro.keptRemove'}));
    await waitFor(() =>
      expect(dialogsSaid()).toEqual(['warning: pro.keptRemoveConfirm', 'error: pro.keptRemoveFailed']),
    );
    expect(has('pro.keptRemove')).toBe(true);
  });
});
