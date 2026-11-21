/**
 * Restore and "manage subscription", from wherever the purchase is shown.
 * Each says how it went: a store that could not be reached is never reported
 * as "nothing found".
 */
import {act, renderHook} from '@testing-library/react-native';
import {useProActions} from '../../../../src/ui/hooks/useProActions';
import {createFakeBilling} from '../../../harness/fakeBilling';
import {dialogsSaid, resetDialogs} from '../../../harness/mocks/dialogs';
import {nextStoreAnswer, resetEntitlement, storeAsked} from '../../../harness/mocks/entitlement';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('../../../../src/ui/context/DialogContext', () =>
  require('../../../harness/mocks/dialogs').dialogContextMock(),
);

afterEach(() => {
  resetEntitlement();
  resetDialogs();
});

const said = dialogsSaid;

it('restore that finds Pro says so', async () => {
  nextStoreAnswer({state: 'lifetime', productId: 'zero_pro_lifetime'}, {kind: 'known', records: 1});
  const {result} = await renderHook(() => useProActions(createFakeBilling()));
  await act(() => result.current.restore());
  expect(storeAsked()).toEqual(['restore']);
  expect(said()).toEqual(['success: pro.restored']);
  expect(result.current.restoring).toBe(false);
});

it('restore that finds nothing says nothing was found', async () => {
  nextStoreAnswer({}, {kind: 'known', records: 0});
  const {result} = await renderHook(() => useProActions(createFakeBilling()));
  await act(() => result.current.restore());
  expect(said()).toEqual(['info: pro.nothingToRestore']);
});

it('restore with a store that cannot say reports that, not "nothing found"', async () => {
  nextStoreAnswer({}, {kind: 'unknown', reason: 'NETWORK_ERROR'});
  const {result} = await renderHook(() => useProActions(createFakeBilling()));
  await act(() => result.current.restore());
  expect(said()).toEqual(['error: pro.storeUnreachable']);
});

it('restore that finds a payment still clearing, or a subscription on hold, says that', async () => {
  const {result} = await renderHook(() => useProActions(createFakeBilling()));
  nextStoreAnswer({state: 'pending', productId: 'zero_pro_lifetime'}, {kind: 'known', records: 1});
  await act(() => result.current.restore());
  nextStoreAnswer({state: 'onHold', productId: 'zero_pro'}, {kind: 'known', records: 1});
  await act(() => result.current.restore());
  expect(said()).toEqual(['info: pro.pending', 'info: pro.statusOnHold']);
});

it('a second tap while restoring asks the store once', async () => {
  const {result} = await renderHook(() => useProActions(createFakeBilling()));
  nextStoreAnswer({}, {kind: 'known', records: 0});
  await act(async () => {
    await Promise.all([result.current.restore(), result.current.restore()]);
  });
  expect(storeAsked()).toEqual(['restore']);
  expect(said()).toHaveLength(1);
});

it('opens the store page for the subscription, and says when it could not', async () => {
  const billing = createFakeBilling();
  const {result} = await renderHook(() => useProActions(billing));
  await act(() => result.current.manageSubscription());
  expect(billing.calls).toEqual(['openManageSubscriptions']);
  expect(said()).toEqual([]);

  billing.openManageSubscriptions = async () => false;
  await act(() => result.current.manageSubscription());
  expect(said()).toEqual(['error: pro.manageFailed']);
});
