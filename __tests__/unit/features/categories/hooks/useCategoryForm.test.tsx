/**
 * M32 review (v2.7.1): seeded names are stored in English and shown
 * translated, so the duplicate check (B2) and the suggestion chips compare
 * against both — otherwise "Comida" typed by hand sits beside the seeded
 * "Food" shown as "Comida", two rows that look the same.
 *
 * The real store, services, providers and LokiJS database; the copy is the
 * shared key mock with two Spanish names.
 */
import {act} from '@testing-library/react-native';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {fetchCategories} from '../../../../../src/store/slices/categoryDataSlice';
import {useCategoryForm} from '../../../../../src/features/categories/hooks/useCategoryForm';
import * as services from '../../../../harness/services';
import {renderHookInApp} from '../../../../harness/render';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));

beforeAll(async () => {
  setMockTranslations({'defaultCategories.food': 'Comida', 'defaultCategories.travel': 'Viajes'});
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('Ravi', '');
  await services.createCategory('Food', userId, 'utensils-crossed', '#111111', 'expense');
  await services.createCategory('Rent', userId, 'house', '#222222', 'expense');
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCategories());
});

const mount = async () => (await renderHookInApp(() => useCategoryForm())).result;

const typed = async (name: string) => {
  const form = await mount();
  await act(() => form.current.setCategoryName(name));
  return form.current;
};

it('refuses the translation of a seeded category the user already has', async () => {
  expect((await typed('comida')).isDuplicate).toBe(true);
  expect((await typed('Food')).isDuplicate).toBe(true);
  expect((await typed('Viajes')).isDuplicate).toBe(false);
});

it('does not suggest a seeded category the user already has', async () => {
  const names = (await mount()).current.filteredCategories.map(c => c.name);
  expect(names).not.toContain('Food');
  expect(names).toContain('Travel');
});
