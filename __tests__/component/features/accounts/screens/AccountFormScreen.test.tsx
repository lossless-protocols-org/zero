/**
 * Adding and editing an account (3.0 Pro; round two item 8, world review W2
 * to W5). What it is was chosen at the plus, so the form has no class tiles
 * and is titled by the class. A name already used, however it is spelled, is
 * refused with the reason. An edit sends only what changed (L6): a rename
 * leaves the opening balance as stored. A loan's repayment repeats as often
 * as the user says. Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {AccountFormScreen} from '../../../../../src/features/accounts/screens/AccountFormScreen';
import {getAccountById, getAccounts} from '../../../../../src/data/services/accountService';
import {getRules} from '../../../../../src/data/services/recurringService';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import type {AccountClass} from '../../../../../src/domain/accounts';
import {goBack} from '../../../../../src/platform/navigationUtils';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {renderInApp} from '../../../../harness/render';

let mockParams: {accountId?: string; accountClass?: AccountClass} | undefined;
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({params: mockParams}),
  ...require('../../../../harness/mocks/focusEffect'),
}));

const NOW = new Date(2026, 10, 13, 12, 0, 0);
let seed: AccountsSeed;
beforeEach(async () => {
  jest.useFakeTimers({now: NOW, advanceTimers: true});
  seed = await seedAccounts();
  setEntitlement({state: 'lifetime'});
  resetDialogs();
  jest.mocked(goBack).mockClear();
});
afterEach(() => {
  setEntitlement();
  jest.useRealTimers();
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async (params?: {accountId?: string; accountClass?: AccountClass}) => {
  mockParams = params;
  await renderInApp(<AccountFormScreen />);
  await settle();
  await settle();
};

it('a new account is what was chosen at the plus: titled by it, with no class to pick', async () => {
  await show({accountClass: 'card'});
  expect(screen.getAllByText('accounts.addCard').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('accounts.meansCard')).toBeTruthy();
  expect(screen.queryByText('accounts.classSpend')).toBeNull();
  expect(screen.queryByText('accounts.classLoan')).toBeNull();
  expect(screen.getByText('accounts.todayOwed')).toBeTruthy();
});

it('adds a card from what is owed on it today: no minus sign to type, stored below zero', async () => {
  await show({accountClass: 'card'});
  await fireEvent.changeText(screen.getByPlaceholderText('accounts.namePlaceholder'), 'ICICI card');
  await fireEvent.changeText(screen.getByPlaceholderText('0'), '2400.50');
  await fireEvent.press(screen.getByRole('button', {name: 'accounts.addCard'}));
  await settle();
  const added = (await getAccounts(seed.userId)).find(a => a.name === 'ICICI card');
  expect(added).toMatchObject({type: 'card', active: true, isDefault: false});
  expect((await getAccountById(added!.id))?.openingBalance).toBe(-2400.5);
  expect(goBack).toHaveBeenCalled();
});

it('a comma is the decimal mark, shown as it will be read (W5)', async () => {
  await show({accountClass: 'spend'});
  await fireEvent.changeText(screen.getByPlaceholderText('accounts.namePlaceholder'), 'Girokonto');
  await fireEvent.changeText(screen.getByPlaceholderText('0'), '-1400,50');
  // What the user sees is what is stored: never 140050.
  expect(screen.getByDisplayValue('-1400.50')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', {name: 'accounts.addSpend'}));
  await settle();
  const added = (await getAccounts(seed.userId)).find(a => a.name === 'Girokonto');
  expect((await getAccountById(added!.id))?.openingBalance).toBe(-1400.5);
});

it('a group is picked like a category, or typed new, and is stored as the user’s own word', async () => {
  await show({accountClass: 'save'});
  await fireEvent.changeText(screen.getByPlaceholderText('accounts.namePlaceholder'), 'Workplace pension');
  await fireEvent.press(screen.getByTestId('group-new'));
  await fireEvent.changeText(screen.getByPlaceholderText('accounts.groupPlaceholder'), 'Retirement');
  await fireEvent.press(screen.getByRole('button', {name: 'accounts.addSave'}));
  await settle();
  const added = (await getAccounts(seed.userId)).find(a => a.name === 'Workplace pension');
  expect(added).toMatchObject({kind: 'Retirement'});
});

it('a new loan’s repayment repeats as often as the user says, from the account new entries go to (W3)', async () => {
  await show({accountClass: 'loan'});
  await fireEvent.changeText(screen.getByPlaceholderText('accounts.namePlaceholder'), 'Student loan');
  const [owed, repay] = screen.getAllByPlaceholderText('0');
  await fireEvent.changeText(owed!, '18400'); // the form draws what is owed, then the repayment
  // How often is asked only once there is a repayment to schedule.
  expect(screen.queryByText('accounts.everyTwoWeeks')).toBeNull();
  await fireEvent.changeText(repay!, '105');
  await fireEvent.press(screen.getByText('accounts.everyTwoWeeks'));
  await fireEvent.press(screen.getByRole('button', {name: 'accounts.addLoan'}));
  await settle();
  await settle();
  const loan = (await getAccounts(seed.userId)).find(a => a.name === 'Student loan');
  expect(loan).toMatchObject({type: 'loan'});
  expect((await getAccountById(loan!.id))?.openingBalance).toBe(-18_400);
  const rules = await getRules(seed.userId);
  expect(rules).toHaveLength(1);
  // Every two weeks is the weekly cadence at an interval of two; the first one a fortnight from today.
  expect(rules[0]).toMatchObject({
    target: 'transfer',
    toAccountId: loan!.id,
    amount: 105,
    cadence: 'weekly',
    interval: 2,
    startDate: '2026-11-27',
  });
});

it('refuses a name already used and says why', async () => {
  await show({accountClass: 'spend'});
  await fireEvent.changeText(screen.getByPlaceholderText('accounts.namePlaceholder'), ' hdfc ');
  await fireEvent.press(screen.getByRole('button', {name: 'accounts.addSpend'}));
  await settle();
  expect(dialogsSaid()).toEqual(['error: accounts.nameTaken']);
  expect(goBack).not.toHaveBeenCalled();
});

it('an edit sends only what changed: a rename keeps the opening balance and day', async () => {
  await show({accountId: seed.bank});
  expect(screen.getByDisplayValue('HDFC')).toBeTruthy();
  expect(screen.getByDisplayValue('5000')).toBeTruthy();
  // An edit may move an account between the two classes of its own side only.
  expect(screen.getByText('accounts.classSpend')).toBeTruthy();
  expect(screen.getByText('accounts.classSave')).toBeTruthy();
  expect(screen.queryByText('accounts.classCard')).toBeNull();
  await fireEvent.changeText(screen.getByDisplayValue('HDFC'), 'HDFC salary');
  await fireEvent.press(screen.getByRole('button', {name: 'common.update'}));
  await settle();
  expect(await getAccountById(seed.bank)).toMatchObject({
    name: 'HDFC salary',
    openingBalance: 5000,
    openingDate: null,
    type: 'bank',
  });
});

it('editing a card shows what is owed, and saving it unchanged keeps the stored balance', async () => {
  await show({accountId: seed.card});
  // The seed's card opened at −1,500: the form shows 1500 owed.
  expect(screen.getByDisplayValue('1500')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('accounts.namePlaceholder'), 'Amex Gold');
  await fireEvent.press(screen.getByRole('button', {name: 'common.update'}));
  await settle();
  expect(await getAccountById(seed.card)).toMatchObject({name: 'Amex Gold', openingBalance: -1500});
});
