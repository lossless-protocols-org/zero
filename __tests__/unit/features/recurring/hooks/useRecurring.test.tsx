/** The Recurring list's reads and actions (P9): rules and the week ahead; an action reruns the producers. */
import {act, waitFor} from '@testing-library/react-native';
import {useRecurring} from '../../../../../src/features/recurring/hooks/useRecurring';
import * as producers from '../../../../../src/pro/producers';
import * as recurring from '../../../../../src/data/services/recurringService';
import {todayIsoDay} from '../../../../../src/domain/dates';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {seedRule} from '../../../../harness/recurringSeed';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  resetDialogs();
  jest.spyOn(producers, 'rerunProducers').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('reads the rules and what is coming this week', async () => {
  await seedRule(seed, {startDate: todayIsoDay(), cadence: 'everyNDays'}, todayIsoDay());
  const {result} = await renderHookInApp(() => useRecurring());
  await waitFor(() => expect(result.current.rules).toHaveLength(1));
  expect(result.current.upcoming.length).toBeGreaterThan(1);
});

it('a failed action says so; the producers still only run after a success', async () => {
  const id = await seedRule(seed);
  jest.spyOn(recurring, 'catchUp').mockRejectedValue(new Error('disk full'));
  const {result} = await renderHookInApp(() => useRecurring());
  await act(() => result.current.addMissed(id));
  expect(dialogsSaid()).toEqual(['error: recurring.saveFailed']);
  expect(producers.rerunProducers).not.toHaveBeenCalled();
});
