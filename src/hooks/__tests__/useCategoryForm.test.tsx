/**
 * M32 review (v2.7.1): seeded names are stored in English and shown
 * translated, so the duplicate check (B2) and the suggestion chips compare
 * against both — otherwise "Comida" typed by hand sits beside the seeded
 * "Food" shown as "Comida", two rows that look the same.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockCategories = [
  {id: 'c1', name: 'Food', categoryStatus: true, icon: 'utensils-crossed', color: '#111111'},
  {id: 'c2', name: 'Rent', categoryStatus: true, icon: 'house', color: '#222222'},
];
jest.mock('../../redux/hooks', () => ({
  useAppDispatch: () => jest.fn(),
  useAppSelector: (select: (s: unknown) => unknown) => select(undefined),
}));
jest.mock('../../redux/slice/userIdSlice', () => ({selectUserId: () => 'u1'}));
jest.mock('../../redux/slice/categoryDataSlice', () => ({
  selectCategoryData: () => mockCategories,
  fetchCategories: jest.fn(),
}));
jest.mock('../../watermelondb/services', () => ({createCategory: jest.fn(), updateCategoryById: jest.fn()}));
jest.mock('../../utils/navigationUtils', () => ({goBack: jest.fn()}));
jest.mock('../useReportFailure', () => ({useReportSaveFailure: () => jest.fn()}));
jest.mock('react-i18next', () => ({
  // validationSchema initialises i18next with this plugin.
  initReactI18next: {type: '3rdParty', init: () => undefined},
  useTranslation: () => ({
    t: (key: string) => ({'defaultCategories.food': 'Comida', 'defaultCategories.travel': 'Viajes'})[key] ?? key,
  }),
}));

// required after jest.mock so the mocks apply; the cast names the module's own type
const {useCategoryForm} = require('../useCategoryForm') as typeof import('../useCategoryForm');

const mount = async () => {
  const latest: {current?: ReturnType<typeof useCategoryForm>} = {};
  const Probe = () => {
    latest.current = useCategoryForm();
    return null;
  };
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<Probe />);
  });
  return latest;
};

const typed = async (name: string) => {
  const form = await mount();
  await ReactTestRenderer.act(async () => form.current?.setCategoryName(name));
  return form.current;
};

it('refuses the translation of a seeded category the user already has', async () => {
  expect((await typed('comida'))?.isDuplicate).toBe(true);
  expect((await typed('Food'))?.isDuplicate).toBe(true);
  expect((await typed('Viajes'))?.isDuplicate).toBe(false);
});

it('does not suggest a seeded category the user already has', async () => {
  const names = (await mount()).current?.filteredCategories.map(c => c.name);
  expect(names).not.toContain('Food');
  expect(names).toContain('Travel');
});
