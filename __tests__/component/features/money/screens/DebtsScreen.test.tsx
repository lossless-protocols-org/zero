/**
 * The Debts tab (approved A2; round two item 5): what is owed, either way.
 * One top card, then sections in one row style. Free: people and the simple
 * card and loan tallies, and nothing of Pro's. Pro: what you owe and are owed
 * across cards, loans and people, the cards and loans as accounts, and one
 * plus that asks what to add. A section with nothing in it is not drawn
 * (world review W7). Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {DebtsScreen} from '../../../../../src/features/money/screens/DebtsScreen';
import {createAccount} from '../../../../../src/data/services/accountService';
import {createDebt} from '../../../../../src/data/services/debtService';
import {SheetManager} from 'react-native-actions-sheet';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import * as services from '../../../../harness/services';
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

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts(); // cash 0, bank 5,000, card owing 1,500, fund 9,000
  const riya = await services.createDebtor('Riya', seed.userId, 'user', 'Person', '#222222');
  await createDebt(seed.userId, 700, 'lent', riya, '2026-11-08T10:00:00', 'Lend');
  setMockTranslations({'accounts.youOweAmount': 'You owe {{amount}}', 'accounts.rowA11y': '{{name}}, {{amount}}'});
  jest.mocked(navigate).mockClear();
  showSheet.mockClear();
});
afterEach(() => {
  setMockTranslations({});
  setEntitlement();
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async () => {
  await renderInApp(<DebtsScreen />);
  await settle();
  await settle();
};

it('free: people as a section, no empty tallies section, the plus adds a person, and nothing of Pro’s', async () => {
  await show();
  expect(screen.getByText('debts.title')).toBeTruthy();
  expect(screen.getByText('debts.tabPerson')).toBeTruthy();
  expect(screen.getByText('Riya')).toBeTruthy();
  expect(screen.getByText('debts.owesYou')).toBeTruthy();
  // No tally exists, so its section is not drawn (W7).
  expect(screen.queryByText('debts.tabAccounts')).toBeNull();
  // The accounts exist in the database (a lapsed Pro user's), and none of them shows.
  expect(screen.queryByText('accounts.classCard')).toBeNull();
  expect(screen.queryByText('Amex')).toBeNull();
  expect(screen.queryByText('accounts.lineYouOwe')).toBeNull();
  expect(screen.queryByTestId('net-worth-line')).toBeNull();
  await fireEvent.press(screen.getByLabelText('debts.addDebtor'));
  expect(navigate).toHaveBeenLastCalledWith('AddDebtorScreen');
  expect(showSheet).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Riya'));
  expect(navigate).toHaveBeenLastCalledWith(
    'IndividualDebtsScreen',
    expect.objectContaining({debtorId: expect.any(String)}),
  );
});

it('free: the simple card and loan tallies are their own section, under the free app’s name for them', async () => {
  await services.createDebtor('Old card', seed.userId, 'credit-card', 'Credit Card', '#111111');
  await show();
  expect(screen.getByText('debts.tabAccounts')).toBeTruthy();
  expect(screen.getByText('Old card')).toBeTruthy();
  expect(screen.getByText('Riya')).toBeTruthy();
});

describe('with Pro', () => {
  beforeEach(() => setEntitlement({state: 'lifetime'}));

  it('opens with what you owe and are owed across cards, loans and people, then Card, Loan and People', async () => {
    await createAccount(seed.userId, {
      name: 'Bike loan',
      type: 'loan',
      openingBalance: -20_000,
      openingDate: null,
      icon: 'hand-coins',
      color: '',
    });
    await show();
    // You owe: 1,500 on the card and 20,000 on the loan. Owed to you: the 700 Riya borrowed.
    expect(screen.getByText('₹21,500')).toBeTruthy();
    expect(screen.getAllByText('₹700')).toHaveLength(3); // the top card, the People heading, and Riya's own row
    expect(screen.getByText('accounts.classCard')).toBeTruthy();
    expect(screen.getByText('accounts.classLoan')).toBeTruthy();
    expect(screen.getByText('debts.tabPerson')).toBeTruthy();
    expect(screen.getByText('Amex')).toBeTruthy();
    expect(screen.getByText('Bike loan')).toBeTruthy();
    // What is held is the Money tab's: the bank and the fund are not here.
    expect(screen.queryByText('HDFC')).toBeNull();
    expect(screen.queryByText('Index fund')).toBeNull();
    expect(screen.getByText('Riya')).toBeTruthy();
    // Net worth closes the tab, as it closes Money: 5,000 + 9,000 + 700 − 1,500 − 20,000.
    expect(screen.getByText('−₹6,800')).toBeTruthy();
  });

  it('one plus, and it asks: Person, Card or Loan', async () => {
    await show();
    await fireEvent.press(screen.getByLabelText('debts.addToDebts'));
    expect(showSheet).toHaveBeenCalledTimes(1);
    const payload = showSheet.mock.calls[0]?.[1]?.payload as
      {choices: ReadonlyArray<{name: string; onPress: () => void}>} | undefined; // the add-choice sheet's payload, as DebtsScreen builds it
    expect(payload?.choices.map(choice => choice.name)).toEqual(['person', 'card', 'loan']);
    payload?.choices[2]?.onPress();
    expect(navigate).toHaveBeenLastCalledWith('AccountFormScreen', {accountClass: 'loan'});
    payload?.choices[0]?.onPress();
    expect(navigate).toHaveBeenLastCalledWith('AddDebtorScreen');
  });

  it('a section with nothing in it is not drawn: no loan, no tally', async () => {
    await show();
    expect(screen.getByText('accounts.classCard')).toBeTruthy();
    expect(screen.queryByText('accounts.classLoan')).toBeNull();
    expect(screen.queryByText('debts.tabTallies')).toBeNull();
    expect(screen.queryByText('debts.tabAccounts')).toBeNull();
    await screen.unmount();
    await services.createDebtor('Old card', seed.userId, 'credit-card', 'Credit Card', '#111111');
    await show();
    expect(screen.getByText('debts.tabTallies')).toBeTruthy();
    expect(screen.getByText('Old card')).toBeTruthy();
    // People and tallies are both on screen: sections, not a switch between them.
    expect(screen.getByText('Riya')).toBeTruthy();
  });
});
