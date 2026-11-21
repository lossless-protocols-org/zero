/**
 * Renaming a group of accounts (Pro; Categories tab, Accounts): the field
 * starts on the group's own word; saving gives every account of that class
 * in the group the new one and goes back; nothing is saved while the word is
 * empty or unchanged. Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {GroupFormScreen} from '../../../../../src/features/accounts/screens/GroupFormScreen';
import * as accountService from '../../../../../src/data/services/accountService';
import {getAccountById} from '../../../../../src/data/services/accountService';
import {goBack} from '../../../../../src/platform/navigationUtils';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {renderInApp} from '../../../../harness/render';

let mockParams: {accountClass: string; groupKey: string};
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
  useRoute: () => ({params: mockParams}),
}));

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  setMockTranslations({'accounts.typeBank': 'Bank', 'accounts.typeCash': 'Cash'});
  resetDialogs();
  jest.mocked(goBack).mockClear();
});
afterEach(() => {
  setMockTranslations({});
  jest.restoreAllMocks();
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
const show = async (groupKey: string) => {
  mockParams = {accountClass: 'spend', groupKey};
  await renderInApp(<GroupFormScreen />);
  await settle();
};
const field = () => screen.getByPlaceholderText('accounts.kindPlaceholder');
const saveButton = () => screen.getByRole('button', {name: 'common.update'});

it('starts on the group’s word, and saves a new one on its accounts only', async () => {
  await show('bank');
  expect(field()).toHaveDisplayValue('Bank');
  // Unchanged: nothing to save.
  expect(saveButton()).toBeDisabled();
  await fireEvent.changeText(field(), ' Salary ');
  await fireEvent.press(saveButton());
  await settle();
  expect((await getAccountById(seed.bank))?.kind).toBe('Salary');
  expect((await getAccountById(seed.cash))?.kind).toBe('');
  expect(goBack).toHaveBeenCalledTimes(1);
  expect(dialogsSaid()).toEqual([]);
});

it('does not save an empty word', async () => {
  await show('bank');
  await fireEvent.changeText(field(), '   ');
  expect(saveButton()).toBeDisabled();
  await fireEvent.press(saveButton());
  await settle();
  expect((await getAccountById(seed.bank))?.kind).toBe('');
  expect(goBack).not.toHaveBeenCalled();
});

it('a group that is not there (a stale link) offers nothing to save', async () => {
  await show('nowhere');
  expect(field()).toHaveDisplayValue('');
  await fireEvent.changeText(field(), 'Salary');
  expect(saveButton()).toBeDisabled();
});

it('says so when the save fails, and stays', async () => {
  await show('bank');
  jest.spyOn(accountService, 'renameAccountKind').mockRejectedValueOnce(new Error('disk full'));
  await fireEvent.changeText(field(), 'Salary');
  await fireEvent.press(saveButton());
  await settle();
  expect(dialogsSaid()).toEqual(['error: accounts.saveFailed']);
  expect(goBack).not.toHaveBeenCalled();
  expect(saveButton()).toBeEnabled();
});
