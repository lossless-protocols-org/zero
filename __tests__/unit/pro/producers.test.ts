/**
 * The P9 producers follow the entitlement (L4): with Pro, what is due is made
 * and what is coming is reminded; without it nothing is made and no reminder
 * is pending. Run as often as they like, they make each occurrence once.
 * Real LokiJS database; the native reminders module is a stand-in.
 */
import {database} from '../../../src/data/database/database';
import {createRule} from '../../../src/data/services/recurringService';
import {getRecurringState} from '../../../src/pro/recurringState';
import {reconcile} from '../../../src/pro/reconcile';
import {rerunProducers, startRecurringProducers} from '../../../src/pro/producers';
import {todayIsoDay} from '../../../src/domain/dates';
import type {Entitlement} from '../../../src/pro/schema';
import {seedAccounts, type AccountsSeed} from '../../harness/accountsSeed';

const mockReplaceAll = jest.fn<Promise<void>, [string]>(async () => undefined);
jest.mock('../../../src/native/specs/NativeReminders', () => ({
  __esModule: true,
  default: {replaceAll: (json: string) => mockReplaceAll(json), permission: jest.fn(), requestPermission: jest.fn()},
}));
jest.mock('../../../src/pro/entitlementStore', () => require('../../harness/mocks/entitlement').entitlementStoreMock());

const entitlement = (state: Entitlement['state']): Entitlement =>
  // Only the state is read by these producers; the rest is the store's shape.
  ({state, expiresAtMs: null, endedAtMs: null}) as unknown as Entitlement;

let seed: AccountsSeed;
beforeAll(() => startRecurringProducers(({title}) => ({title, body: 'Due'})));
beforeEach(async () => {
  seed = await seedAccounts();
  mockReplaceAll.mockClear();
  // Due today, with a reminder tomorrow's day: one row made, one reminder ahead.
  await createRule(
    seed.userId,
    {
      target: 'expense',
      title: 'Rent',
      categoryId: seed.snacks,
      accountId: seed.bank,
      toAccountId: null,
      amount: 100,
      cadence: 'everyNDays',
      interval: 1,
      startDate: todayIsoDay(),
      endDate: null,
      remindDaysBefore: 0,
    },
    todayIsoDay(),
  );
});

const madeRows = async () => database.get('expenses').query().fetchCount();

it('with Pro: makes what is due once, however often it runs, and sets the reminders', async () => {
  await reconcile(entitlement('lifetime'));
  await reconcile(entitlement('lifetime'));
  expect(await madeRows()).toBe(1);
  const scheduled = JSON.parse(mockReplaceAll.mock.calls.at(-1)?.[0] ?? '[]') as Array<{title: string}>;
  expect(scheduled.length).toBeGreaterThan(0);
  expect(scheduled[0]?.title).toBe('Rent');
});

it('without Pro: nothing is made and no reminder is pending', async () => {
  await reconcile(entitlement('expired'));
  expect(await madeRows()).toBe(0);
  expect(mockReplaceAll).toHaveBeenLastCalledWith('[]');
  expect(getRecurringState()).toEqual({behind: [], asks: []});
});

it('rerunProducers runs them again with the entitlement as it stands', async () => {
  await rerunProducers();
  // The stand-in store says no Pro: so nothing.
  expect(await madeRows()).toBe(0);
  expect(mockReplaceAll).toHaveBeenLastCalledWith('[]');
});

it('before onboarding (no user yet) nothing runs and nothing is pending', async () => {
  const {deleteAllData} =
    require('../../../src/data/services/deleteService') as typeof import('../../../src/data/services/deleteService');
  await deleteAllData();
  await reconcile(entitlement('lifetime'));
  expect(mockReplaceAll).toHaveBeenLastCalledWith('[]');
  expect(getRecurringState()).toEqual({behind: [], asks: []});
});

it('starting twice registers once', () => {
  startRecurringProducers(({title}) => ({title, body: 'again'}));
});
