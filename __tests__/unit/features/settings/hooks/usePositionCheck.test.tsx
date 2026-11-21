/** R16 on the device: Diagnostics says whether this month's articulation holds, and times the balances. */
import {act, waitFor} from '@testing-library/react-native';
import * as netWorth from '../../../../../src/data/services/netWorthService';
import {usePositionCheck} from '../../../../../src/features/settings/hooks/usePositionCheck';
import {seedAccounts} from '../../../../harness/accountsSeed';
import {resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);

beforeEach(async () => {
  await seedAccounts();
  await act(async () => setEntitlement({state: 'lifetime'}));
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  jest.restoreAllMocks();
});

it('without Pro there is no accounts block at all, and nothing is worked out', async () => {
  await act(async () => resetEntitlement());
  const spy = jest.spyOn(netWorth, 'getNetWorth');
  const {result} = await renderHookInApp(() => usePositionCheck());
  await act(() => Promise.resolve());
  expect(result.current).toEqual([]);
  expect(spy).not.toHaveBeenCalled();
});

it('says the check holds, and how long the balances took', async () => {
  const {result} = await renderHookInApp(() => usePositionCheck());
  await waitFor(() =>
    expect(result.current).toEqual([
      'diagnostics.netWorthCheck',
      'diagnostics.balanceTiming',
      'diagnostics.balanceSlowest',
      // P12: how long Trends' twelve months take to read.
      'diagnostics.trendsTiming',
    ]),
  );
});

it('says when it does not hold', async () => {
  jest.spyOn(netWorth, 'articulate').mockResolvedValue({
    netWorthChange: 100,
    kept: 90,
    revaluations: 0,
    adjustments: 0,
    openings: 0,
    debtsOutsideAccounts: 0,
    holds: false,
  });
  const {result} = await renderHookInApp(() => usePositionCheck());
  await waitFor(() => expect(result.current[0]).toBe('diagnostics.netWorthCheckOff'));
});
