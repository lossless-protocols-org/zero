/**
 * The Categories tab's third segment (Pro, accounts): the groups the user's
 * accounts are in. It is there only with Pro; open, the screen shows the
 * groups in place of the categories, with no reorder, no add and no swipe
 * hint. Without Pro the screen has its two tabs and reads no account.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {CategoryScreen} from '../../../../../src/features/categories/screens/CategoryScreen';
import * as accountService from '../../../../../src/data/services/accountService';
import {resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import {seedAccounts} from '../../../../harness/accountsSeed';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('@shopify/flash-list', () => ({FlashList: () => null}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

beforeEach(async () => {
  await seedAccounts();
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  jest.restoreAllMocks();
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));

it('without Pro: two tabs, and no account is read', async () => {
  const read = jest.spyOn(accountService, 'getAccounts');
  await renderInApp(<CategoryScreen />);
  await settle();
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.queryByText('categories.tabAccounts')).toBeNull();
  expect(screen.queryByText('categories.groupsNote')).toBeNull();
  expect(screen.getByLabelText('categories.addCategory')).toBeVisible();
  expect(read).not.toHaveBeenCalled();
});

it('with Pro: the Accounts tab lists the groups, with no reorder and no add; the other tabs are as they were', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const read = jest.spyOn(accountService, 'getAccounts');
  await renderInApp(<CategoryScreen />);
  await settle();
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(3);
  // On the expense tab nothing of the groups is drawn or read.
  expect(screen.queryByText('categories.groupsNote')).toBeNull();
  expect(read).not.toHaveBeenCalled();
  expect(screen.getByLabelText('categories.addCategory')).toBeVisible();

  await fireEvent.press(tabs[2]!); // three tabs, counted above
  await settle();
  expect(screen.getByText('categories.groupsNote')).toBeTruthy();
  // Each of the seeded accounts with a word (cash, bank, card) is a group; under the key-returning mock the word is its key.
  expect(screen.getByTestId('group-spend:accounts.typecash')).toBeTruthy();
  expect(screen.getByTestId('group-card:accounts.kindcredit')).toBeTruthy();
  expect(screen.queryByText('categories.reorder')).toBeNull();
  expect(screen.queryByLabelText('categories.addCategory')).toBeNull();
  expect(screen.queryByLabelText('categories.addIncomeCategory')).toBeNull();

  await fireEvent.press(screen.getAllByRole('tab')[1]!); // still three tabs
  await settle();
  expect(screen.queryByText('categories.groupsNote')).toBeNull();
  expect(screen.getByLabelText('categories.addIncomeCategory')).toBeVisible();
});

it('Pro going away while the tab is open falls back to the expense list', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  await renderInApp(<CategoryScreen />);
  await fireEvent.press(screen.getAllByRole('tab')[2]!); // Pro: three tabs
  await settle();
  expect(screen.getByText('categories.groupsNote')).toBeTruthy();
  await act(async () => resetEntitlement());
  await settle();
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.queryByText('categories.groupsNote')).toBeNull();
  expect(screen.getByLabelText('categories.addCategory')).toBeVisible();
});
