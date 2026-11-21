/**
 * Adding and editing a recurring rule (3.0 Pro, P9): a rule is saved with
 * what was set, and the producers run at once; the first rule with a
 * reminder asks for the permission (never earlier), and a refusal is said
 * once; an edit sends only what changed; pause and delete act after asking.
 * Real LokiJS database; the reminders module is a stand-in.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {RuleFormScreen} from '../../../../../src/features/recurring/screens/RuleFormScreen';
import {getRuleById, getRules} from '../../../../../src/data/services/recurringService';
import {goBack} from '../../../../../src/platform/navigationUtils';
import * as reminders from '../../../../../src/pro/reminders';
import * as producers from '../../../../../src/pro/producers';
import {remindersAskedPreference} from '../../../../../src/platform/proNotices';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {seedRule} from '../../../../harness/recurringSeed';
import {renderInApp} from '../../../../harness/render';

let mockParams: {ruleId?: string} | undefined;
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({params: mockParams}),
}));

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  remindersAskedPreference.set(false);
  resetDialogs();
  jest.mocked(goBack).mockClear();
  jest.spyOn(producers, 'rerunProducers').mockResolvedValue(undefined);
  jest.spyOn(reminders, 'reminderPermission').mockResolvedValue('undetermined');
  jest.spyOn(reminders, 'requestReminderPermission').mockResolvedValue('granted');
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async (params?: {ruleId?: string}) => {
  mockParams = params;
  await renderInApp(<RuleFormScreen />);
  await settle();
};

it('adds an expense rule, runs the producers, and asks nothing when there is no reminder', async () => {
  await show();
  await fireEvent.changeText(screen.getByPlaceholderText('recurring.titlePlaceholder'), 'Gym');
  await fireEvent.changeText(screen.getByLabelText('recurring.amountLabel'), '999');
  await fireEvent.press(screen.getByText('Snacks'));
  await fireEvent.press(screen.getByRole('button', {name: 'recurring.add'}));
  await settle();
  expect((await getRules(seed.userId)).map(r => [r.title, r.amount, r.categoryId, r.accountId])).toEqual([
    ['Gym', 999, seed.snacks, seed.cash],
  ]);
  expect(producers.rerunProducers).toHaveBeenCalled();
  expect(reminders.requestReminderPermission).not.toHaveBeenCalled();
  expect(goBack).toHaveBeenCalled();
});

it('the first rule with a reminder asks for the permission; a refusal is said', async () => {
  jest.mocked(reminders.requestReminderPermission).mockResolvedValue('denied');
  await show();
  await fireEvent.changeText(screen.getByPlaceholderText('recurring.titlePlaceholder'), 'Rent');
  await fireEvent.changeText(screen.getByLabelText('recurring.amountLabel'), '18000');
  await fireEvent.press(screen.getByText('Snacks'));
  await fireEvent.press(screen.getByText('recurring.remindSameDay'));
  await fireEvent.press(screen.getByRole('button', {name: 'recurring.add'}));
  await settle();
  expect(reminders.requestReminderPermission).toHaveBeenCalledTimes(1);
  expect(dialogsSaid()).toEqual(['info: recurring.permissionOff']);
  const [rule] = await getRules(seed.userId);
  expect(rule?.remindDaysBefore).toBe(0);
  // Saved again (Android cannot tell "no" from "never asked"): not asked again, not explained again.
  await show({ruleId: rule?.id});
  await fireEvent.changeText(screen.getByDisplayValue('Rent'), 'House rent');
  await fireEvent.press(screen.getByText('common.update'));
  await settle();
  expect(reminders.requestReminderPermission).toHaveBeenCalledTimes(1);
  expect(dialogsSaid()).toEqual(['info: recurring.permissionOff']);
});

it('a rule that varies has no amount; a transfer needs two different accounts', async () => {
  await show();
  await fireEvent.press(screen.getByText('recurring.targetTransfer'));
  await fireEvent.changeText(screen.getByPlaceholderText('recurring.titlePlaceholder'), 'SIP');
  await fireEvent.press(screen.getByText('recurring.varies'));
  await fireEvent.press(screen.getByRole('button', {name: 'recurring.add'}));
  await settle();
  const [sip] = await getRules(seed.userId);
  expect(sip).toMatchObject({target: 'transfer', amount: null, categoryId: '', accountId: seed.cash});
  expect(sip?.toAccountId).not.toBe(seed.cash);
});

it('an edit sends only what changed; pause and delete act', async () => {
  const id = await seedRule(seed, {remindDaysBefore: 2});
  await show({ruleId: id});
  expect(screen.getByDisplayValue('Rent')).toBeTruthy();
  await fireEvent.changeText(screen.getByDisplayValue('Rent'), 'House rent');
  await fireEvent.press(screen.getByText('common.update'));
  await settle();
  expect(await getRuleById(id)).toMatchObject({title: 'House rent', amount: 18000, remindDaysBefore: 2});
  await show({ruleId: id});
  await fireEvent.press(screen.getByText('recurring.pause'));
  await settle();
  expect((await getRuleById(id))?.status).toBe('paused');
  await show({ruleId: id});
  await fireEvent.press(screen.getByText('recurring.delete'));
  await settle();
  expect(dialogsSaid()).toContain('warning: recurring.deleteConfirm');
  expect(await getRuleById(id)).toBeNull();
});
