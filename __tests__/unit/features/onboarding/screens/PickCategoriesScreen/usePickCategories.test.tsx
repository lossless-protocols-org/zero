/**
 * Onboarding's categories step: coming back from the currency step and
 * continuing again works, and creates each pick once. Continue used to stay
 * disabled after the first success, and a second pass would now be refused by
 * the duplicate-name rule (audit 2026-11-08 §4.3).
 *
 * The real store, services, providers and LokiJS database; navigation is the
 * one stand-in (no navigator under test).
 */
import {act} from '@testing-library/react-native';
import {store} from '../../../../../../src/store/store';
import {resetSession} from '../../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../../src/store/slices/userIdSlice';
import {usePickCategories} from '../../../../../../src/features/onboarding/screens/PickCategoriesScreen/usePickCategories';
import * as services from '../../../../../harness/services';
import {renderHookInApp} from '../../../../../harness/render';

const mockNavigate = jest.fn();
jest.mock('../../../../../../src/platform/navigationUtils', () => ({
  navigate: (name: string) => mockNavigate(name),
  goBack: jest.fn(),
}));
jest.mock('react-i18next', () => require('../../../../../harness/mocks/reactI18next'));

it('continuing, going back and continuing again creates each pick once and keeps Continue working', async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('Asha', '');
  await store.dispatch(fetchUserData());
  const {result: step} = await renderHookInApp(() => usePickCategories());

  await act(() => step.current.toggleCategorySelection({name: 'Food'}));
  await act(() => step.current.toggleCategorySelection({name: 'Fuel'}));
  await act(() => step.current.handleSubmit());
  expect(step.current.isSubmitting).toBe(false);
  // Back from the currency step: the screen is still mounted with the same picks.
  await act(() => step.current.handleSubmit());

  expect(mockNavigate.mock.calls).toEqual([['ChooseCurrencyScreen'], ['ChooseCurrencyScreen']]);
  const names = (await services.getAllCategoriesByUserId(userId, 'expense')).map(c => c.name);
  expect(names).toEqual(['Food', 'Fuel']);
});
