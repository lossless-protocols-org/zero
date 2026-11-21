/**
 * The Money tab (approved A2; round two items 4 and 6): one screen has one
 * time frame, so the tab has two views. Free: Money in alone, with no control
 * and nothing of Pro's. Pro: Accounts first, Money in beside it, and a plus
 * that adds what the view lists. Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {MoneyScreen} from '../../../../../src/features/money/screens/MoneyScreen';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import {seedAccounts} from '../../../../harness/accountsSeed';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

const showSheet = jest.spyOn(SheetManager, 'show').mockResolvedValue(undefined);

beforeEach(async () => {
  await seedAccounts(); // cash 0, bank 5,000, card owing 1,500, fund 9,000
  jest.mocked(navigate).mockClear();
  showSheet.mockClear();
});
afterEach(() => setEntitlement());

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async () => {
  await renderInApp(<MoneyScreen />);
  await settle();
  await settle();
};

it('free: Money in alone, no control, no account surface, and the plus adds money in', async () => {
  await show();
  expect(screen.queryByText('money.viewAccounts')).toBeNull();
  expect(screen.queryByText('accounts.classSpend')).toBeNull();
  expect(screen.queryByText('HDFC')).toBeNull();
  expect(screen.queryByTestId('net-worth-line')).toBeNull();
  await fireEvent.press(screen.getByLabelText('money.addIncome'));
  expect(navigate).toHaveBeenLastCalledWith(
    'AddIncomeScreen',
    expect.objectContaining({yearMonth: expect.any(String)}),
  );
  expect(showSheet).not.toHaveBeenCalled();
});

describe('with Pro', () => {
  beforeEach(() => setEntitlement({state: 'lifetime'}));

  it('opens on Accounts: what is held now, and no month of money in below it', async () => {
    await show();
    expect(screen.getByText('money.viewAccounts')).toBeTruthy();
    expect(screen.getByText('accounts.classSpend')).toBeTruthy();
    expect(screen.getByText('HDFC')).toBeTruthy();
    // The month's money in is the other view: its add button is not on this one.
    expect(screen.queryByLabelText('money.addIncome')).toBeNull();
  });

  it('the plus on Accounts asks Spend or Save, never Card or Loan', async () => {
    await show();
    await fireEvent.press(screen.getByLabelText('accounts.add'));
    const payload = showSheet.mock.calls[0]?.[1]?.payload as
      {choices: ReadonlyArray<{name: string; onPress: () => void}>} | undefined; // the add-choice sheet's payload, as MoneyScreen builds it
    expect(payload?.choices.map(choice => choice.name)).toEqual(['spend', 'save']);
    payload?.choices[1]?.onPress();
    expect(navigate).toHaveBeenLastCalledWith('AccountFormScreen', {accountClass: 'save'});
  });

  it('Money in is the free view, one tap away, with its own plus', async () => {
    await show();
    await fireEvent.press(screen.getByText('money.received'));
    expect(screen.queryByText('HDFC')).toBeNull();
    await fireEvent.press(screen.getByLabelText('money.addIncome'));
    expect(navigate).toHaveBeenLastCalledWith(
      'AddIncomeScreen',
      expect.objectContaining({yearMonth: expect.any(String)}),
    );
  });
});
