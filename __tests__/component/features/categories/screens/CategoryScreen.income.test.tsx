/**
 * A second income category (3.0, P9): the Income tab's add button is there
 * with Pro and opens the form for an income category; without Pro the tab
 * says one category is Free's and offers no add. The rule is the screen's,
 * not the service's (law L1).
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {CategoryScreen} from '../../../../../src/features/categories/screens/CategoryScreen';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('@shopify/flash-list', () => ({FlashList: () => null}));

afterEach(async () => {
  await act(async () => resetEntitlement());
  jest.mocked(navigate).mockClear();
});

const openIncomeTab = async () => {
  await renderInApp(<CategoryScreen />);
  // The tab is read with its count ("common.fieldValue" under the key-returning i18n mock): the second tab is Income.
  const [, income] = screen.getAllByRole('tab');
  await fireEvent.press(income!);
};

it('without Pro: no add on the Income tab, and the note says why', async () => {
  await openIncomeTab();
  expect(screen.getByText('categories.incomeFreeNote')).toBeTruthy();
  // Hidden (display: none), so not in what a person or a screen reader can reach.
  expect(screen.queryByLabelText('categories.addIncomeCategory')).toBeNull();
});

it('with Pro: the add opens the form for an income category, and the Free note is gone', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  await openIncomeTab();
  expect(screen.queryByText('categories.incomeFreeNote')).toBeNull();
  const add = screen.getByLabelText('categories.addIncomeCategory');
  expect(add).toBeVisible();
  await fireEvent.press(add);
  expect(navigate).toHaveBeenCalledWith('AddCategoryScreen', {kind: 'income'});
});

it('the Expense tab’s add is there in both tiers, for an expense category', async () => {
  await renderInApp(<CategoryScreen />);
  await fireEvent.press(screen.getByLabelText('categories.addCategory'));
  expect(navigate).toHaveBeenCalledWith('AddCategoryScreen', {});
});
