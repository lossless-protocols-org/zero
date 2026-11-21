/**
 * The quick-add sheet offers income categories as the tier lists them
 * (3.0): one chip without Pro, every active one with it.
 */
import {act} from '@testing-library/react-native';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {fetchCurrency} from '../../../../../src/store/slices/currencyDataSlice';
import {defaultIncomeCategoryId} from '../../../../../src/data/database/defaultIncomeCategory';
import {useQuickAdd} from '../../../../../src/features/widgets/quickAdd/useQuickAdd';
import * as services from '../../../../harness/services';
import {seedIncomeCategory} from '../../../../harness/incomeCategories';
import {resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let userId = '';

beforeEach(async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  await seedIncomeCategory(userId, 'freelance', {name: 'Freelance', sortOrder: 20});
  await seedIncomeCategory(userId, 'old', {name: 'Old', sortOrder: 30, active: false});
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCurrency());
});
afterEach(async () => {
  await act(async () => resetEntitlement());
});

const chips = async (widgetCategory = '') => {
  const {result} = await renderHookInApp(() => useQuickAdd('income', widgetCategory, jest.fn(), jest.fn()));
  await act(() => Promise.resolve()); // the categories load
  return {ids: result.current.categories?.map(c => c.id), chosen: result.current.categoryId};
};

it('without Pro, one chip: the category money lands in, whatever the widget asked for', async () => {
  expect(await chips('freelance')).toEqual({
    ids: [defaultIncomeCategoryId(userId)],
    chosen: defaultIncomeCategoryId(userId),
  });
});

it('with Pro, every active income category, keeping the one the widget opened on', async () => {
  await act(async () => setEntitlement({state: 'subscribed'}));
  expect(await chips('freelance')).toEqual({ids: [defaultIncomeCategoryId(userId), 'freelance'], chosen: 'freelance'});
});
