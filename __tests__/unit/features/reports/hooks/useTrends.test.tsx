/**
 * Trends for the screen (plan P12): thirteen months read once, the last 3, 6
 * or 12 shown; what stood out is said about the last FINISHED month against
 * the months before it; with a month start day the months are the user's.
 * Real LokiJS database.
 */
import {act, waitFor} from '@testing-library/react-native';
import {useTrends, type TrendLength} from '../../../../../src/features/reports/hooks/useTrends';
import * as trendsService from '../../../../../src/data/services/trendsService';
import * as errorLog from '../../../../../src/platform/errorLog';
import {setStoredMonthStartDay} from '../../../../../src/pro/monthStart';
import * as services from '../../../../harness/services';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import {REPORTS_NOW, seedReports, type ReportsSeed} from '../../../../harness/reportsSeed';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let seed: ReportsSeed;
beforeAll(async () => {
  jest.useFakeTimers({now: REPORTS_NOW, advanceTimers: true});
  setEntitlement({state: 'lifetime'});
  seed = await seedReports();
});
afterAll(() => {
  jest.useRealTimers();
  setStoredMonthStartDay(1);
  setEntitlement();
});
afterEach(() => jest.restoreAllMocks());

const show = async (length: TrendLength) => {
  const view = await renderHookInApp(() => useTrends(length));
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  const trends = view.result.current;
  if (!trends.ready) {
    throw new Error('not ready');
  }
  return trends;
};

it('reads thirteen months in one call and shows the last 3, 6 or 12', async () => {
  const read = jest.spyOn(trendsService, 'getTrends');
  const three = await show(3);
  expect(read).toHaveBeenCalledTimes(1);
  expect(read.mock.calls[0]?.[1]).toHaveLength(13);
  expect(three.shown.map(point => point.key)).toEqual(['2026-09', '2026-10', '2026-11']);
  expect(three.beforeShown?.key).toBe('2026-08');
  expect((await show(12)).shown).toHaveLength(12);
  expect((await show(6)).shown.at(0)?.key).toBe('2026-06');
});

it('the month in progress is shown, and what stood out is about the last finished month', async () => {
  const trends = await show(6);
  // November so far: petrol and chai, less the feast's refund.
  expect(trends.shown.at(-1)).toMatchObject({key: '2026-11', spent: 170, count: 2});
  expect(trends.finished?.key).toBe('2026-10');
  // October: 1900 against an average of 1000 over August and September.
  expect(trends.insights).toEqual([
    {kind: 'spentAboveAverage', percent: 90, spent: 1900, average: 1000, months: 2},
    {kind: 'categoryAboveAverage', categoryId: seed.food, percent: 150, spent: 1500, average: 600, months: 2},
    {kind: 'highestOfMonths', months: 3, spent: 1900},
    {kind: 'biggestCategory', categoryId: seed.food, percent: 79, spent: 1500},
    {kind: 'keptShare', percent: 62, kept: 3100, received: 5000},
  ]);
  // The same facts as tiles, shares first: 62% kept against a usual 80% (August and September).
  expect(trends.tiles.map(tile => [tile.kind, tile.value])).toEqual([
    ['keptShare', 62],
    ['keptShareChange', 18],
    ['biggestCategory', 79],
    ['spendingAgainstUsual', 90],
    ['highestSpending', 3],
    ['categoryAgainstUsual', 150],
  ]);
  // August, September and October have entries.
  expect(trends.finishedMonths).toBe(3);
  expect(trends.empty).toBe(false);
});

it('with a month start day the months are the user’s months', async () => {
  await act(async () => setStoredMonthStartDay(20));
  const trends = await show(3);
  // 15 November is in the month that began on 20 October.
  expect(trends.shown.map(point => [point.key, point.period.start])).toEqual([
    ['2026-08', '2026-08-20'],
    ['2026-09', '2026-09-20'],
    ['2026-10', '2026-10-20'],
  ]);
  // 20 Oct to 19 Nov: petrol 400, feast 900, petrol 450, chai 20, less the 300 that came back.
  expect(trends.shown.at(-1)).toMatchObject({spent: 1470, count: 4, received: 0});
  await act(async () => setStoredMonthStartDay(1));
});

it('a failed read is logged and said', async () => {
  const logged = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
  jest.spyOn(trendsService, 'getTrends').mockRejectedValue(new Error('db'));
  const view = await renderHookInApp(() => useTrends(6));
  await waitFor(() => expect(view.result.current.failed).toBe(true));
  expect(view.result.current.ready).toBe(false);
  expect(logged).toHaveBeenCalled();
});

it('with no entries at all there is nothing to show', async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  await services.createUser('New', '');
  await store.dispatch(fetchUserData());
  const trends = await show(6);
  expect(trends.empty).toBe(true);
  expect(trends.insights).toEqual([]);
  expect(trends.tiles).toEqual([]);
  expect(trends.finishedMonths).toBe(0);
});
