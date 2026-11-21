/**
 * The money-in form lists income categories as the tier shows them (3.0):
 * one without Pro, all with it. An entry on a category Free does not list is
 * edited without being moved (law L6): its category goes back unchanged.
 * Real store, services and LokiJS database; the entitlement is set per test.
 */
import {act, waitFor} from '@testing-library/react-native';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {fetchCurrency} from '../../../../../src/store/slices/currencyDataSlice';
import {fetchCategories} from '../../../../../src/store/slices/categoryDataSlice';
import {defaultIncomeCategoryId} from '../../../../../src/data/database/defaultIncomeCategory';
import {getIncomeById, getIncomesByMonth} from '../../../../../src/data/services/incomeService';
import {useIncomeForm} from '../../../../../src/features/money/hooks/useIncomeForm';
import * as navigationUtils from '../../../../../src/platform/navigationUtils';
import * as services from '../../../../harness/services';
import {seedIncomeCategory} from '../../../../harness/incomeCategories';
import {resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import {renderHookInApp} from '../../../../harness/render';
import {periodFor} from '../../../../../src/domain/period';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let userId = '';
let primary = '';

beforeEach(async () => {
  jest.spyOn(navigationUtils, 'goBack').mockReturnValue(true);
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Asha', '');
  primary = defaultIncomeCategoryId(userId);
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  // A restored Pro backup: a second income category Free does not list.
  await seedIncomeCategory(userId, 'freelance', {name: 'Freelance', sortOrder: 20});
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCurrency());
  await store.dispatch(fetchCategories());
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  jest.restoreAllMocks();
});

const ids = (categories: ReadonlyArray<{id: string}>) => categories.map(c => c.id);

it('without Pro lists the one category and puts new money in on it', async () => {
  const {result} = await renderHookInApp(() => useIncomeForm(undefined, '2026-11'));
  await waitFor(() => expect(result.current.categoryId).toBe(primary));
  expect(ids(result.current.categories)).toEqual([primary]);
  await act(() => result.current.setAmount('500'));
  await act(() => result.current.save());
  expect((await getIncomesByMonth(userId, periodFor('2026-11'))).map(i => [i.amount, i.categoryId])).toEqual([
    [500, primary],
  ]);
});

it('with Pro lists every active income category', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const {result} = await renderHookInApp(() => useIncomeForm(undefined, '2026-11'));
  await waitFor(() => expect(result.current.categoryId).toBe(primary));
  expect(ids(result.current.categories)).toEqual([primary, 'freelance']);
});

it('without Pro, editing an entry on a category Free does not list keeps it there (L6)', async () => {
  const id = await services.createIncome(userId, {
    categoryId: 'freelance',
    amount: 1000,
    date: '2026-11-05',
    note: 'logo',
  });
  const editing = await getIncomeById(id);
  if (!editing) {
    throw new Error('the seeded income is missing');
  }
  const {result} = await renderHookInApp(() => useIncomeForm(editing));
  expect(ids(result.current.categories)).toEqual([primary]);
  expect(result.current.categoryId).toBe('freelance');
  await act(() => result.current.setAmount('1200'));
  await act(() => result.current.save());
  expect(await getIncomeById(id)).toMatchObject({amount: 1200, categoryId: 'freelance', note: 'logo'});
});
