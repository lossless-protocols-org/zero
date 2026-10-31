/**
 * Budget save: a recurring save is two writes. When the second one fails the
 * first has landed, so the screen must refetch rather than keep the old value
 * under a "not saved" alert. With no user loaded the sheet used to close as
 * if it had saved.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockReportFailure = jest.fn((_error: unknown) => Promise.resolve());
const mockDispatch = jest.fn();
const mockUserId = {current: 'u1'};
const mockUpsertBudget = jest.fn(() => Promise.resolve());
const mockDeleteMonthOverride = jest.fn(() => Promise.reject(new Error('disk I/O error')));

jest.mock('../useReportFailure', () => ({useReportFailure: () => mockReportFailure}));
jest.mock('../../redux/hooks', () => ({useAppDispatch: () => mockDispatch, useAppSelector: () => mockUserId.current}));
jest.mock('../../redux/slice/budgetDataSlice', () => ({
  fetchBudgetsByMonth: (month: string) => ({type: 'fetch', month}),
}));
jest.mock('../../context/DialogContext', () => ({useDialog: () => ({showDialog: jest.fn()})}));
jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
jest.mock('../../watermelondb/services/budgetService', () => ({
  upsertBudget: () => mockUpsertBudget(),
  deleteMonthOverride: () => mockDeleteMonthOverride(),
  stopRecurringBudgetFrom: jest.fn(),
  clearBudgetForMonth: jest.fn(),
}));

// required after jest.mock so the mocks apply; the type is the module's own
const useBudgetActions = (require('../useBudgetActions') as typeof import('../useBudgetActions')).default;

const mountActions = async () => {
  const latest: {current?: ReturnType<typeof useBudgetActions>} = {};
  const Probe = () => {
    latest.current = useBudgetActions('2026-10', 'October 2026');
    return null;
  };
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  return latest;
};

beforeEach(() => {
  mockReportFailure.mockClear();
  mockDispatch.mockClear();
  mockUserId.current = 'u1';
});

it('refetches after a partly failed recurring save, then reports it', async () => {
  const actions = await mountActions();
  await actions.current?.handleBudgetSave(500, true);
  expect(mockUpsertBudget).toHaveBeenCalled();
  expect(mockDispatch).toHaveBeenCalledWith({type: 'fetch', month: '2026-10'});
  expect(mockReportFailure).toHaveBeenCalledTimes(1);
});

it('reports a save with no user loaded instead of closing silently', async () => {
  mockUserId.current = '';
  const actions = await mountActions();
  await actions.current?.handleBudgetSave(500, false);
  expect(mockReportFailure).toHaveBeenCalledTimes(1);
  expect(String(mockReportFailure.mock.calls[0]?.[0])).toContain('user id is empty');
});
