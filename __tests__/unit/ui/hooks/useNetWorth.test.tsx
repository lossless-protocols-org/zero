/** Net worth for the Money card and the Pro screens: read on focus and after writes; nothing read when off. */
import {act, waitFor} from '@testing-library/react-native';
import * as netWorth from '../../../../src/data/services/netWorthService';
import {useNetWorth} from '../../../../src/ui/hooks/useNetWorth';
import {seedAccounts, type AccountsSeed} from '../../../harness/accountsSeed';
import * as services from '../../../harness/services';
import {renderHookInApp} from '../../../harness/render';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../harness/mocks/focusEffect'),
}));

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
});
afterEach(() => jest.restoreAllMocks());

it('reads net worth and this month, and again after a write', async () => {
  const {result} = await renderHookInApp(() => useNetWorth(true));
  await waitFor(() => expect(result.current.worth?.total).toBe(12500));
  expect(result.current.since?.holds).toBe(true);
  await act(async () => {
    await services.createExpense(
      seed.userId,
      'Lunch',
      500,
      '',
      seed.snacks,
      `${new Date().toISOString().slice(0, 10)}T08:00:00`,
    );
  });
  await waitFor(() => expect(result.current.worth?.total).toBe(12000));
});

it('reads nothing when off', async () => {
  const spy = jest.spyOn(netWorth, 'getNetWorth');
  const {result} = await renderHookInApp(() => useNetWorth(false));
  await act(() => Promise.resolve());
  expect(spy).not.toHaveBeenCalled();
  expect(result.current.worth).toBeNull();
});

it('a failed read says so and keeps nothing stale', async () => {
  jest.spyOn(netWorth, 'getNetWorth').mockRejectedValue(new Error('database closed'));
  const {result} = await renderHookInApp(() => useNetWorth(true));
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.worth).toBeNull();
});
