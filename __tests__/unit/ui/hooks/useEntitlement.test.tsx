/** The entitlement as the store last decided it, for the places that say it in words. */
import {act, renderHook} from '@testing-library/react-native';
import {useEntitlement} from '../../../../src/ui/hooks/useEntitlement';
import {resetEntitlement, setEntitlement} from '../../../harness/mocks/entitlement';

jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);

afterEach(resetEntitlement);

it('follows every new decision', async () => {
  const {result} = await renderHook(() => useEntitlement());
  expect(result.current.state).toBe('none');
  await act(async () =>
    setEntitlement({state: 'grace', productId: 'zero_pro_monthly', expiresAtMs: 5, willRenew: true}),
  );
  expect(result.current).toMatchObject({state: 'grace', productId: 'zero_pro_monthly', expiresAtMs: 5});
});
