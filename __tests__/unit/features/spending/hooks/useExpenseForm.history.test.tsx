/**
 * Categorise from history (2.8 §5.3): adding an expense, a pause in typing
 * the title preselects the category the same title had last time; a tap on a
 * chip always wins, and a title with no history takes back only a
 * preselection it made itself.
 *
 * The real store, services, providers and LokiJS database. One stand-in: the
 * title-history query itself, which is SQL LokiJS cannot run (it is proven on
 * SQLite in __tests__/sqlite/titleHistory.bun.test.ts). Navigation has no
 * navigator under test.
 *
 * Tickets: audit 2026-11-08 §3.3.
 */
import {act} from '@testing-library/react-native';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {fetchCurrency} from '../../../../../src/store/slices/currencyDataSlice';
import {fetchCategories} from '../../../../../src/store/slices/categoryDataSlice';
import {useExpenseForm} from '../../../../../src/features/spending/hooks/useExpenseForm';
import * as expenseService from '../../../../../src/data/services/expenseService';
import * as services from '../../../../harness/services';
import {renderHookInApp} from '../../../../harness/render';
import type {CategoryData} from '../../../../../src/domain/types';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));

/** title (as the history matches it) → category id; filled per test from real rows. */
let history: Record<string, string> = {};
/** When set, lookups wait for `release()`: a query still running when the user taps a chip. */
const slowLookup: {held: boolean; release: () => void} = {held: false, release: () => undefined};

const seed = async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await services.createCategory('Food', userId, 'utensils', '#111111', 'expense');
  const bus = await services.createCategory('Transport', userId, 'bus', '#222222', 'expense');
  const archived = await services.createCategory('Old', userId, 'archive', '#333333', 'expense');
  await services.softDeleteCategoryById(archived);
  history = {chai: food, bus, ghost: archived};
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCurrency());
  await store.dispatch(fetchCategories());
  return {food, bus};
};

const mount = async () => (await renderHookInApp(() => useExpenseForm())).result;

const categoryNamed = (name: string): CategoryData => {
  const category = store.getState().category.entities;
  const found = Object.values(category).find(c => c?.name === name);
  if (!found) {
    throw new Error(`no category ${name}`);
  }
  return found;
};

/** Types a title and lets the pause pass. */
const typeTitle = async (form: {current: ReturnType<typeof useExpenseForm>}, title: string) => {
  await act(() => form.current.setExpenseTitle(title));
  await act(() => jest.advanceTimersByTime(450));
  await act(() => Promise.resolve());
};

let ids: {food: string; bus: string};
beforeEach(async () => {
  ids = await seed();
  jest.spyOn(expenseService, 'findCategoryIdForTitle').mockImplementation((_user, title) => {
    const answer = history[title.trim().toLowerCase()] ?? null;
    if (!slowLookup.held) {
      return Promise.resolve(answer);
    }
    return new Promise(resolve => {
      slowLookup.release = () => resolve(answer);
    });
  });
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('preselects the category a title had last time, marked as from history', async () => {
  const form = await mount();
  await typeTitle(form, '  Chai ');
  expect(form.current.selectedCategories.map(c => c.id)).toEqual([ids.food]);
  expect(form.current.fromHistory).toBe(true);
});

it('takes back its own preselection when the title has no history', async () => {
  const form = await mount();
  await typeTitle(form, 'chai');
  await typeTitle(form, 'something new');
  expect(form.current.selectedCategories).toEqual([]);
  expect(form.current.fromHistory).toBe(false);
});

it('never overrides a category the user chose', async () => {
  const form = await mount();
  await act(() => form.current.toggleCategorySelection(categoryNamed('Transport')));
  await typeTitle(form, 'chai');
  expect(form.current.selectedCategories.map(c => c.id)).toEqual([ids.bus]);
  expect(form.current.fromHistory).toBe(false);
});

it('a lookup still running when the user taps a chip cannot replace that choice', async () => {
  const form = await mount();
  slowLookup.held = true;
  try {
    await typeTitle(form, 'chai'); // the pause passed: the history query is in flight
    await act(() => form.current.toggleCategorySelection(categoryNamed('Transport')));
    await act(() => slowLookup.release()); // the query answers "Food" after the tap
    await act(() => Promise.resolve());
  } finally {
    slowLookup.held = false;
  }
  expect(form.current.selectedCategories.map(c => c.id)).toEqual([ids.bus]);
  expect(form.current.fromHistory).toBe(false);
});

it('ignores a history category that is no longer active', async () => {
  const form = await mount();
  await typeTitle(form, 'ghost');
  expect(form.current.selectedCategories).toEqual([]);
});

describe('"Add Category" from the form', () => {
  it('the category made there comes back chosen', async () => {
    await seed();
    const form = await mount();
    await act(() => form.current.addCategory());
    // What AddCategoryScreen does, then what the session follower reads back.
    await act(async () => {
      await services.createCategory('Snacks', store.getState().userId.userId, null, null, 'expense');
      await store.dispatch(fetchCategories());
    });
    expect(form.current.selectedCategories.map(c => c.name)).toEqual(['Snacks']);
  });

  it('going back without making one keeps the choice as it was', async () => {
    await seed();
    const form = await mount();
    await act(() => form.current.toggleCategorySelection(categoryNamed('Food')));
    await act(() => form.current.addCategory());
    await act(async () => {
      await store.dispatch(fetchCategories()); // a re-read with nothing new
    });
    expect(form.current.selectedCategories.map(c => c.name)).toEqual(['Food']);
  });
});
