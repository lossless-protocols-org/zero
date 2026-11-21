/**
 * The one question a screen asks about the tier (plan rule 3): is this
 * feature on. It follows what is applied to the screen, which a downgrade
 * reaches only at a safe point (src/pro/proGate.ts).
 */
import {act, renderHook} from '@testing-library/react-native';
import {setProScreenOpen} from '../../../../src/pro/proGate';
import {useAppliedPro, useProFeature} from '../../../../src/ui/hooks/useProFeature';
import {resetEntitlement, setEntitlement} from '../../../harness/mocks/entitlement';

jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);

afterEach(async () => {
  await act(async () => {
    setProScreenOpen(false);
    resetEntitlement();
  });
});

it('is off without Pro and on with it, for every state', async () => {
  const {result} = await renderHook(() => ({pro: useAppliedPro(), accounts: useProFeature('accounts')}));
  expect(result.current).toEqual({pro: false, accounts: false});
  for (const state of ['trial', 'subscribed', 'grace', 'lifetime'] as const) {
    await act(async () => setEntitlement({state, productId: 'zero_pro_lifetime'}));
    expect(result.current).toEqual({pro: true, accounts: true});
  }
  for (const state of ['none', 'pending', 'onHold', 'expired', 'revoked'] as const) {
    await act(async () => setEntitlement({state}));
    expect(result.current).toEqual({pro: false, accounts: false});
  }
});

it('stays on through a downgrade while a Pro screen is open, until the user leaves it', async () => {
  const {result} = await renderHook(() => useProFeature('recurring'));
  await act(async () => setEntitlement({state: 'lifetime'}));
  await act(async () => setProScreenOpen(true));
  await act(async () => setEntitlement({state: 'revoked'}));
  expect(result.current).toBe(true);
  await act(async () => setProScreenOpen(false));
  expect(result.current).toBe(false);
});
