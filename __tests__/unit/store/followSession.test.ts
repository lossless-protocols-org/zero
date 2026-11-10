/**
 * The session's categories and currency follow the database, whoever writes
 * them (audit 2026-11-08, Appendix A): no form refetches them, and Settings
 * no longer patches the currency into the store by hand. Real store and
 * LokiJS database.
 */
import {configureStore} from '@reduxjs/toolkit';
import {rootReducer} from '../../../src/store/rootReducer';
import {followSession} from '../../../src/store/followSession';
import {fetchUserData} from '../../../src/store/slices/userIdSlice';
import {fetchCurrency, selectCurrencyCode} from '../../../src/store/slices/currencyDataSlice';
import {fetchCategories, selectActiveCategories} from '../../../src/store/slices/categoryDataSlice';
import {database} from '../../../src/data/database/database';
import * as services from '../../harness/services';

beforeEach(async () => {
  jest.useFakeTimers({advanceTimers: true});
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});
afterEach(() => jest.useRealTimers());

const settle = async () => {
  jest.advanceTimersByTime(1);
  await jest.runOnlyPendingTimersAsync();
};

const startSession = async () => {
  const userId = await services.createUser('Asha', '');
  const currencyId = await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const store = configureStore({reducer: rootReducer});
  store.dispatch(fetchUserData.fulfilled({userId, userName: 'Asha', userEmail: ''}, 'r'));
  await store.dispatch(fetchCurrency());
  await store.dispatch(fetchCategories());
  return {store, userId, currencyId};
};

it('a category written anywhere shows in the store', async () => {
  const {store, userId} = await startSession();
  const stop = followSession(store.dispatch);
  await services.createCategory('Fuel', userId, null, null, 'expense');
  await settle();
  expect(selectActiveCategories(store.getState()).map(c => c.name)).toContain('Fuel');
  stop();
});

it('a currency change shows in the store', async () => {
  const {store, currencyId} = await startSession();
  const stop = followSession(store.dispatch);
  await services.updateCurrencyById(currencyId, {code: 'USD', symbol: '$', name: 'US Dollar'});
  await settle();
  expect(selectCurrencyCode(store.getState())).toBe('USD');
  stop();
});

it('after stop, writes are not followed', async () => {
  const {store, userId} = await startSession();
  followSession(store.dispatch)();
  await services.createCategory('Fuel', userId, null, null, 'expense');
  await settle();
  expect(selectActiveCategories(store.getState()).map(c => c.name)).not.toContain('Fuel');
});
