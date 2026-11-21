/** Reports' "Unexplained" (Pro, P8): the month's hand-set cash and bank balances; nothing read without Pro. */
import {act, waitFor} from '@testing-library/react-native';
import * as netWorth from '../../../../../src/data/services/netWorthService';
import {acceptCheckpoint} from '../../../../../src/data/services/checkpointService';
import {useUnexplained} from '../../../../../src/features/reports/hooks/useUnexplained';
import {resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  await acceptCheckpoint(seed.userId, {accountId: seed.bank, balance: 4700, date: '2026-11-10', note: ''});
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  jest.restoreAllMocks();
});

it('with Pro: the month’s unexplained amount', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const {result} = await renderHookInApp(() => useUnexplained('2026-11'));
  await waitFor(() => expect(result.current).toBe(-300));
});

it('without Pro: 0, and nothing is read', async () => {
  const spy = jest.spyOn(netWorth, 'getUnexplained');
  const {result} = await renderHookInApp(() => useUnexplained('2026-11'));
  await act(() => Promise.resolve());
  expect(result.current).toBe(0);
  expect(spy).not.toHaveBeenCalled();
});
