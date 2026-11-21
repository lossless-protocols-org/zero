/**
 * Reports for a picked range (plan P11): the rows dated in the range and
 * nothing else, netted as a month is; the ends keep each other in order; and
 * nothing is shown under dates it was not read for. Real LokiJS database.
 */
import {act, waitFor} from '@testing-library/react-native';
import {useRangeReport} from '../../../../../src/features/reports/hooks/useRangeReport';
import * as expenseService from '../../../../../src/data/services/expenseService';
import * as errorLog from '../../../../../src/platform/errorLog';
import type {IsoDay} from '../../../../../src/domain/types';
import {REPORTS_NOW, seedReports} from '../../../../harness/reportsSeed';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

const day = (value: string) => value as IsoDay; // the tests' days are written as YYYY-MM-DD

beforeAll(async () => {
  jest.useFakeTimers({now: REPORTS_NOW, advanceTimers: true});
  await seedReports();
});
afterAll(() => jest.useRealTimers());
afterEach(() => jest.restoreAllMocks());

it('opens on the last 30 days, today included', async () => {
  const {result} = await renderHookInApp(() => useRangeReport());
  expect(result.current).toMatchObject({from: '2026-10-17', to: '2026-11-15', days: 30});
  await waitFor(() => expect(result.current.ready).toBe(true));
  // Petrol 20 Oct, Feast 25 Oct, Petrol 10 Nov, Chai 15 Nov; the feast's refund on 3 Nov.
  expect(result.current.totals).toEqual({spent: 400 + 900 + 450 + 20 - 300, refunded: 300, count: 4, received: 0});
  expect(result.current.rows).toHaveLength(5);
});

it('a range across months reads exactly its days, both ends included, with the money in dated in it', async () => {
  const {result} = await renderHookInApp(() => useRangeReport());
  await act(async () => result.current.pickFrom(day('2026-09-20')));
  await act(async () => result.current.pickTo(day('2026-10-05')));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.period).toEqual({start: '2026-09-20', next: '2026-10-06'});
  expect(result.current.days).toBe(16);
  // Petrol 20 Sep and Groceries 5 Oct; salary on 1 Oct.
  expect(result.current.totals).toEqual({spent: 1000, refunded: 0, count: 2, received: 5000});
  expect(result.current.expenses.map(row => row.title).sort()).toEqual(['Groceries', 'Petrol']);
});

it('the ends keep each other in order: a From after To moves To, and the reverse', async () => {
  const {result} = await renderHookInApp(() => useRangeReport());
  await act(async () => result.current.pickTo(day('2026-09-10')));
  expect(result.current).toMatchObject({from: '2026-09-10', to: '2026-09-10', days: 1});
  await act(async () => result.current.pickFrom(day('2026-09-25')));
  expect(result.current).toMatchObject({from: '2026-09-25', to: '2026-09-25'});
});

it('while a new range is being read, the last one’s figures are not shown under its dates', async () => {
  const {result} = await renderHookInApp(() => useRangeReport());
  await waitFor(() => expect(result.current.ready).toBe(true));
  const real = expenseService.getAllExpensesByMonth;
  let release: () => void = () => undefined;
  jest.spyOn(expenseService, 'getAllExpensesByMonth').mockImplementation(async (userId, period) => {
    await new Promise<void>(resolve => (release = resolve));
    return real(userId, period);
  });
  await act(async () => result.current.pickFrom(day('2026-08-01')));
  expect(result.current.ready).toBe(false);
  expect(result.current.totals.spent).toBe(0);
  await act(async () => release());
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.totals.count).toBe(9);
});

it('a failed read is logged and said, never shown as an empty range', async () => {
  const logged = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
  jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValue(new Error('db'));
  const {result} = await renderHookInApp(() => useRangeReport());
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.ready).toBe(false);
  expect(logged).toHaveBeenCalled();
});
