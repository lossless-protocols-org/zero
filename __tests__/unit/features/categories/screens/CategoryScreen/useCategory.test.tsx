/**
 * The categories tab lists income categories as the tier shows them (3.0):
 * one without Pro. That one is the only one there is to the user, so it
 * cannot be deleted, whatever a restored backup holds unlisted.
 */
import {act, waitFor} from '@testing-library/react-native';
import {store} from '../../../../../../src/store/store';
import {resetSession} from '../../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../../src/store/slices/userIdSlice';
import {fetchCategories} from '../../../../../../src/store/slices/categoryDataSlice';
import {defaultIncomeCategoryId} from '../../../../../../src/data/database/defaultIncomeCategory';
import {useCategory} from '../../../../../../src/features/categories/screens/CategoryScreen/useCategory';
import * as services from '../../../../../harness/services';
import {seedIncomeCategory} from '../../../../../harness/incomeCategories';
import {answerNextDialog, dialogsSaid, resetDialogs} from '../../../../../harness/mocks/dialogs';
import {resetEntitlement, setEntitlement} from '../../../../../harness/mocks/entitlement';
import {renderHookInApp} from '../../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../../src/ui/context/DialogContext', () =>
  require('../../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('../../../../../../src/pro/entitlementStore', () =>
  require('../../../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let userId = '';
let primary = '';

beforeEach(async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Asha', '');
  primary = defaultIncomeCategoryId(userId);
  await seedIncomeCategory(userId, 'freelance', {name: 'Freelance', sortOrder: 20});
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCategories());
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  resetDialogs();
});

const active = async (id: string) => (await services.getCategoryById(id))?.categoryStatus;

it('without Pro, lists the one income category and refuses to delete it, asking nothing', async () => {
  const {result} = await renderHookInApp(() => useCategory());
  expect(result.current.incomeCategories.map(c => c.id)).toEqual([primary]);
  await act(() => result.current.handleDelete(primary));
  expect(dialogsSaid()).toEqual(['info: categories.lastIncomeCategory']);
  expect(await active(primary)).toBe(true);
  expect(await active('freelance')).toBe(true);
});

it('with Pro, lists both, and one of them may go', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const {result} = await renderHookInApp(() => useCategory());
  expect(result.current.incomeCategories.map(c => c.id)).toEqual([primary, 'freelance']);
  answerNextDialog(true);
  await act(() => result.current.handleDelete('freelance'));
  await waitFor(async () => expect(await active('freelance')).toBe(false));
});
