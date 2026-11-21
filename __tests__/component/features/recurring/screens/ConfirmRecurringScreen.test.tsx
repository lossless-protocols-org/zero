/** Confirming an occurrence that varies (P9): the amount typed makes the entry on its day, once. */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {database} from '../../../../../src/data/database/database';
import {ConfirmRecurringScreen} from '../../../../../src/features/recurring/screens/ConfirmRecurringScreen';
import {getRuleById} from '../../../../../src/data/services/recurringService';
import * as producers from '../../../../../src/pro/producers';
import {goBack} from '../../../../../src/platform/navigationUtils';
import {seedAccounts} from '../../../../harness/accountsSeed';
import {seedRule} from '../../../../harness/recurringSeed';
import {renderInApp} from '../../../../harness/render';

let mockParams = {ruleId: '', index: 0};
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({params: mockParams}),
}));

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

it('makes the entry with the typed amount and moves the rule on', async () => {
  jest.spyOn(producers, 'rerunProducers').mockResolvedValue(undefined);
  const seed = await seedAccounts();
  const id = await seedRule(seed, {title: 'Electricity', amount: null});
  mockParams = {ruleId: id, index: 0};
  await renderInApp(<ConfirmRecurringScreen />);
  await settle();
  expect(screen.getByRole('button', {name: 'common.add'})).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('recurring.amountLabel'), '1234.5');
  await fireEvent.press(screen.getByText('common.add'));
  await settle();
  const rows = (await database.get('expenses').query().unsafeFetchRaw()) as Array<Record<string, unknown>>;
  expect(rows.map(r => [r['title'], r['amount'], r['recurring_id']])).toEqual([['Electricity', 1234.5, id]]);
  expect((await getRuleById(id))?.nextIndex).toBe(1);
  expect(goBack).toHaveBeenCalled();
});

it('a rule deleted elsewhere says so', async () => {
  mockParams = {ruleId: 'gone', index: 0};
  await renderInApp(<ConfirmRecurringScreen />);
  await settle();
  expect(screen.getByText('common.recordMissing')).toBeTruthy();
});
