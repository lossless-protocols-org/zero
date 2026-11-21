/**
 * The Accounts list (3.0 Pro; UX revamp v2): every account with today's
 * balance, grouped by what the money is for (to spend · you owe · put away),
 * each group with its subtotal; a card below zero shows what is owed and
 * offers "Pay bill"; net worth closes the screen as the last line of the sum;
 * archived folded away. Real LokiJS database.
 */
import React from 'react';
import {SheetManager} from 'react-native-actions-sheet';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {AccountsScreen} from '../../../../../src/features/accounts/screens/AccountsScreen';
import {setAccountArchived} from '../../../../../src/data/services/accountService';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

const showSheet = jest.spyOn(SheetManager, 'show').mockResolvedValue(undefined);

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  setMockTranslations({'accounts.youOweAmount': 'You owe {{amount}}', 'accounts.rowA11y': '{{name}}, {{amount}}'});
  jest.mocked(navigate).mockClear();
});
afterEach(() => setMockTranslations({}));

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

it('groups the accounts and shows each balance; a card below zero is what you owe', async () => {
  await renderInApp(<AccountsScreen />);
  await settle();
  for (const group of ['accounts.classSpend', 'accounts.classCard', 'accounts.classSave']) {
    expect(screen.getByText(group)).toBeTruthy();
  }
  expect(screen.getByText('HDFC')).toBeTruthy();
  expect(screen.getByText('accounts.cash')).toBeTruthy();
  expect(screen.getByText('accounts.defaultBadge')).toBeTruthy();
  // The card: what is owed as a plain figure (twice: the row and its group's subtotal), spoken as "You owe".
  expect(screen.getAllByText(/^₹1,500/)).toHaveLength(2);
  expect(screen.getByLabelText(/You owe .*1,500/)).toBeTruthy();
  // Net worth, the last line: 5,000 + 9,000 − 1,500. No debts with people, so no line for them.
  expect(screen.getByText(/12,500/)).toBeTruthy();
  expect(screen.queryByText('accounts.debtsWithPeople')).toBeNull();
});

it('keeps archived accounts folded until asked, and still counts them', async () => {
  await setAccountArchived(seed.fund, true);
  await renderInApp(<AccountsScreen />);
  await settle();
  expect(screen.queryByText('Index fund')).toBeNull();
  expect(screen.getByText(/12,500/)).toBeTruthy();
  await fireEvent.press(screen.getByText('accounts.groupArchived'));
  expect(screen.getByText('Index fund')).toBeTruthy();
});

it('opens an account, a new account, moving money, a card bill and net worth', async () => {
  await renderInApp(<AccountsScreen />);
  await settle();
  await fireEvent.press(screen.getByText('HDFC'));
  expect(navigate).toHaveBeenLastCalledWith('AccountScreen', {accountId: seed.bank});
  await fireEvent.press(screen.getByText('accounts.transfer'));
  expect(navigate).toHaveBeenLastCalledWith('TransferScreen', {});
  await fireEvent.press(screen.getByLabelText('accounts.add'));
  // It lists every class, so its plus offers every class; the choice goes to the form.
  const payload = showSheet.mock.calls[0]?.[1]?.payload as
    {choices: ReadonlyArray<{name: string; onPress: () => void}>} | undefined; // the add-choice sheet's payload, as AccountsScreen builds it
  expect(payload?.choices.map(choice => choice.name)).toEqual(['spend', 'save', 'card', 'loan']);
  payload?.choices[3]?.onPress();
  expect(navigate).toHaveBeenLastCalledWith('AccountFormScreen', {accountClass: 'loan'});
  // A card that is owed on: its bill, with the card and the amount filled in.
  await fireEvent.press(screen.getByText('accounts.payBill'));
  expect(navigate).toHaveBeenLastCalledWith('TransferScreen', {toAccountId: seed.card, amount: 1500});
  await fireEvent.press(screen.getByText('accounts.netWorthTitle'));
  expect(navigate).toHaveBeenLastCalledWith('NetWorthScreen');
});
