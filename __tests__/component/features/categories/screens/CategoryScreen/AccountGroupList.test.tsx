/**
 * The Accounts tab's list (Pro): one section per class with a group in use,
 * each group with how many accounts are in it; suggestions nobody uses are
 * not listed; a tap opens the rename. Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {AccountGroupList} from '../../../../../../src/features/categories/screens/CategoryScreen/AccountGroupList';
import {createAccount, setAccountArchived} from '../../../../../../src/data/services/accountService';
import {database} from '../../../../../../src/data/database/database';
import type {Account} from '../../../../../../src/data/database/models/Account';
import {navigate} from '../../../../../../src/platform/navigationUtils';
import {setMockTranslations} from '../../../../../harness/mocks/reactI18next';
import {seedAccounts, type AccountsSeed} from '../../../../../harness/accountsSeed';
import {renderInApp} from '../../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../../harness/mocks/focusEffect'),
}));

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  setMockTranslations({
    'accounts.typeBank': 'Bank',
    'accounts.typeCash': 'Cash',
    'accounts.kindCredit': 'Credit',
    'accounts.kindCount': '{{count}} in it',
  });
  jest.mocked(navigate).mockClear();
});
afterEach(() => setMockTranslations({}));

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
const show = async () => {
  await renderInApp(<AccountGroupList />);
  await settle();
};

it('lists the groups in use under their class, with their accounts counted, and says where groups come from', async () => {
  await createAccount(seed.userId, {
    name: 'ICICI',
    type: 'bank',
    openingBalance: 0,
    openingDate: null,
    icon: 'landmark',
    color: '#224466',
  });
  await show();
  expect(screen.getByText('categories.groupsNote')).toBeTruthy();
  const headers = screen.getAllByRole('header');
  expect(headers).toHaveLength(2);
  expect(headers[0]).toHaveTextContent('accounts.classSpend');
  expect(headers[1]).toHaveTextContent('accounts.classCard');
  expect(screen.getByTestId('group-spend:bank')).toHaveTextContent(/Bank.*2 in it/);
  expect(screen.getByTestId('group-spend:cash')).toHaveTextContent(/Cash.*1 in it/);
  expect(screen.getByTestId('group-card:credit')).toHaveTextContent(/Credit.*1 in it/);
  // A suggestion no account uses is the form's to offer, not this list's.
  expect(screen.queryByText('accounts.typeWallet')).toBeNull();
  expect(screen.queryByText('categories.noAccounts')).toBeNull();
});

it('a tap opens the rename for that group of that class', async () => {
  await show();
  await fireEvent.press(screen.getByTestId('group-card:credit'));
  expect(navigate).toHaveBeenCalledWith('GroupFormScreen', {accountClass: 'card', groupKey: 'credit'});
});

it('says there are no accounts when no group is in use', async () => {
  // Every account with a word is archived, and the one left has a type that stands for no word (a restored 'other').
  await setAccountArchived(seed.bank, true);
  await setAccountArchived(seed.card, true);
  await database.write(async () => {
    const account = await database.get<Account>('accounts').find(seed.cash);
    await account.update(changed => {
      changed.type = 'other';
    });
  });
  await show();
  expect(screen.getByText('categories.noAccounts')).toBeTruthy();
  expect(screen.queryAllByRole('header')).toEqual([]);
});
