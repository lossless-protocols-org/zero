/** Income categories as the tier shows them, following the store and the tier as both change. */
import {act} from '@testing-library/react-native';
import {store} from '../../../../src/store/store';
import {resetSession} from '../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../src/store/slices/userIdSlice';
import {fetchCategories} from '../../../../src/store/slices/categoryDataSlice';
import {defaultIncomeCategoryId} from '../../../../src/data/database/defaultIncomeCategory';
import {useIncomeCategories} from '../../../../src/ui/hooks/useIncomeCategories';
import * as services from '../../../harness/services';
import {seedIncomeCategory} from '../../../harness/incomeCategories';
import {resetEntitlement, setEntitlement} from '../../../harness/mocks/entitlement';
import {renderHookInApp} from '../../../harness/render';

jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let primary = '';

beforeEach(async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('Asha', '');
  primary = defaultIncomeCategoryId(userId);
  await seedIncomeCategory(userId, 'freelance', {sortOrder: 20});
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCategories());
});
afterEach(async () => {
  await act(async () => resetEntitlement());
});

it('lists one without Pro and every active one with it, as the tier changes', async () => {
  const {result} = await renderHookInApp(() => useIncomeCategories());
  expect(result.current.listed.map(c => c.id)).toEqual([primary]);
  expect(result.current.oneCategory?.id).toBe(primary);
  await act(async () => setEntitlement({state: 'trial'}));
  expect(result.current.listed.map(c => c.id)).toEqual([primary, 'freelance']);
  expect(result.current.oneCategory).toBeNull();
  await act(async () => setEntitlement({state: 'expired'}));
  expect(result.current.listed.map(c => c.id)).toEqual([primary]);
});
