/**
 * Budget save: a recurring save is two writes. When the second one fails the
 * first has landed, so the screen must refetch rather than keep the old value
 * under a "not saved" alert. With no user loaded the sheet used to close as
 * if it had saved.
 */
import {renderHook} from '@testing-library/react-native';
import {useBudgetActions} from '../../../../src/ui/hooks/useBudgetActions';

const mockReportFailure = jest.fn((_error: unknown) => Promise.resolve());
const mockDispatch = jest.fn();
const mockUserId = {current: 'u1'};
const mockUpsertBudget = jest.fn(() => Promise.resolve());
const mockDeleteMonthOverride = jest.fn(() => Promise.reject(new Error('disk I/O error')));

jest.mock('../../../../src/ui/hooks/useReportFailure', () => ({useReportFailure: () => mockReportFailure}));
jest.mock('../../../../src/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => mockUserId.current,
}));
jest.mock('../../../../src/store/slices/budgetDataSlice', () => ({
  fetchBudgetsByMonth: (month: string) => ({type: 'fetch', month}),
}));
jest.mock('../../../../src/ui/context/DialogContext', () => ({useDialog: () => ({showDialog: jest.fn()})}));
jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('../../../../src/data/services/budgetService', () => ({
  upsertBudget: () => mockUpsertBudget(),
  deleteMonthOverride: () => mockDeleteMonthOverride(),
  stopRecurringBudgetFrom: jest.fn(),
  clearBudgetForMonth: jest.fn(),
}));

const mountActions = async () => (await renderHook(() => useBudgetActions('2026-10', 'October 2026'))).result;

beforeEach(() => {
  mockReportFailure.mockClear();
  mockDispatch.mockClear();
  mockUserId.current = 'u1';
});

it('refetches after a partly failed recurring save, then reports it', async () => {
  const actions = await mountActions();
  await actions.current.handleBudgetSave(500, true);
  expect(mockUpsertBudget).toHaveBeenCalled();
  expect(mockDispatch).toHaveBeenCalledWith({type: 'fetch', month: '2026-10'});
  expect(mockReportFailure).toHaveBeenCalledTimes(1);
});

it('reports a save with no user loaded instead of closing silently', async () => {
  mockUserId.current = '';
  const actions = await mountActions();
  await actions.current.handleBudgetSave(500, false);
  expect(mockReportFailure).toHaveBeenCalledTimes(1);
  expect(String(mockReportFailure.mock.calls[0]?.[0])).toContain('user id is empty');
});
