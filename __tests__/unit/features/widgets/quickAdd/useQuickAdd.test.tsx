/**
 * The quick-add sheet's state and save (2.8): one amount, one category, an
 * optional title; saved through the same services as the full forms, with
 * the app's store refreshed and the user told how it went. Real store,
 * services and LokiJS database; the sheet's two exits (leave, open the full
 * form) are the caller's and are spies here. Before this suite the hook had
 * 3 of 70 lines covered (audit 2026-11-08 §7.6).
 */
import {act} from '@testing-library/react-native';
import {AccessibilityInfo, Alert, Platform} from 'react-native';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {fetchCurrency} from '../../../../../src/store/slices/currencyDataSlice';
import {selectExpenseData} from '../../../../../src/store/slices/expenseDataSlice';
import * as expenseService from '../../../../../src/data/services/expenseService';
import {getIncomesByMonth} from '../../../../../src/data/services/incomeService';
import {takeQuickAddDraft} from '../../../../../src/ui/quickAddDraft';
import {useQuickAdd, type QuickAddKind} from '../../../../../src/features/widgets/quickAdd/useQuickAdd';
import * as services from '../../../../harness/services';
import {renderHookInApp} from '../../../../harness/render';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {getErrorLog, clearErrorLog} from '../../../../../src/platform/errorLog';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

const NOW = new Date(2026, 10, 15, 12, 0, 0);
let userId = '';
let food = '';
let fuel = '';

beforeEach(async () => {
  jest.useFakeTimers({now: NOW, advanceTimers: true});
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  fuel = await services.createCategory('Fuel', userId, 'car', '#222222', 'expense');
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCurrency());
  clearErrorLog();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const open = async (kind: QuickAddKind, initialCategoryId = '') => {
  const leave = jest.fn((then?: () => void) => then?.());
  const openFull = jest.fn();
  const {result} = await renderHookInApp(() => useQuickAdd(kind, initialCategoryId, leave, openFull));
  await act(() => Promise.resolve()); // the categories load
  return {sheet: result, leave, openFull};
};

it('runs on iOS under jest, where success is announced and failure is an alert', () => {
  expect(Platform.OS).toBe('ios');
});

it('offers the active categories and keeps the one the widget opened on', async () => {
  const {sheet} = await open('expense', fuel);
  expect(sheet.current.categories?.map(c => c.name).sort()).toEqual(['Food', 'Fuel']);
  expect(sheet.current.categoryId).toBe(fuel);
});

it('falls back to the first category when the widget drew one deleted since', async () => {
  const gone = await services.createCategory('Gone', userId, 'x', '#333333', 'expense');
  await services.softDeleteCategoryById(gone);
  const {sheet} = await open('expense', gone);
  expect([food, fuel]).toContain(sheet.current.categoryId);
});

it('saves an expense titled after its category as shown, refreshes the month on screen, says so and leaves', async () => {
  setMockTranslations({'defaultCategories.food': 'Comida'}); // a seeded name, shown translated
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const {sheet, leave} = await open('expense', food);
  await act(() => sheet.current.setAmount('120.5'));
  expect(sheet.current.isValid).toBe(true);
  await act(() => sheet.current.save());
  const rows = selectExpenseData(store.getState(), '2026-11');
  expect(rows.map(r => [r.title, r.amount, r.category?.id])).toEqual([['Comida', 120.5, food]]);
  expect(announce).toHaveBeenCalledWith('quickAdd.added');
  expect(leave).toHaveBeenCalledTimes(1);
});

it('refuses a title longer than an expense title can be, and saves nothing', async () => {
  const {sheet, leave} = await open('expense', food);
  await act(() => sheet.current.setAmount('10'));
  await act(() => sheet.current.setText('x'.repeat(26)));
  expect(sheet.current.isValid).toBe(false);
  await act(() => sheet.current.save());
  expect(await services.getAllExpensesByMonth(userId, '2026-11')).toEqual([]);
  expect(leave).not.toHaveBeenCalled();
});

it('saves money in for today, with the note, in an income category', async () => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const {sheet, leave} = await open('income');
  expect(sheet.current.categoryId).toBe(`inc_${userId}`);
  await act(() => sheet.current.setAmount('40000'));
  await act(() => sheet.current.setText('Salary'));
  await act(() => sheet.current.save());
  const incomes = await getIncomesByMonth(userId, '2026-11');
  expect(incomes.map(i => [i.amount, i.date, i.note])).toEqual([[40_000, '2026-11-15', 'Salary']]);
  expect(leave).toHaveBeenCalledTimes(1);
});

it('a failed save stays open, says so, and records why', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(expenseService, 'createExpense').mockRejectedValueOnce(new Error('database is locked'));
  const {sheet, leave} = await open('expense', food);
  await act(() => sheet.current.setAmount('10'));
  await act(() => sheet.current.save());
  expect(alert).toHaveBeenCalledWith('quickAdd.saveFailed');
  expect(sheet.current.saving).toBe(false);
  expect(leave).not.toHaveBeenCalled();
  expect(getErrorLog().map(e => e.message)).toContain('database is locked');
});

it('"More details" hands what was typed to the full form', async () => {
  const {sheet, openFull} = await open('expense', fuel);
  await act(() => sheet.current.setAmount('900'));
  await act(() => sheet.current.setText('Fill up'));
  await act(() => sheet.current.moreDetails());
  expect(openFull).toHaveBeenCalledWith('expense');
  expect(takeQuickAddDraft()).toEqual({title: 'Fill up', amount: '900', categoryId: fuel});
});
