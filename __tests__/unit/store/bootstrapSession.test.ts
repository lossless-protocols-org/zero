/**
 * The one session start (audit 2026-11-08 §4.2): the user, then their
 * currency and categories, with the income-category invariant checked once.
 * Real store, real services, LokiJS database.
 */
import type {Category} from '../../../src/data/database/models';
import {database} from '../../../src/data/database/database';
import * as services from '../../harness/services';
import {configureStore} from '@reduxjs/toolkit';
import {rootReducer} from '../../../src/store/rootReducer';
import {bootstrapSession} from '../../../src/store/bootstrapSession';
import {getErrorLog} from '../../../src/platform/errorLog';

const makeStore = () => configureStore({reducer: rootReducer});

beforeEach(async () => {
  await services.deleteAllData();
});

it('loads the user, their currency and both kinds of category', async () => {
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  await services.createCategory('Food', userId, null, null, 'expense');
  const store = makeStore();
  await store.dispatch(bootstrapSession());
  const state = store.getState();
  expect(state.userId.userId).toBe(userId);
  expect(state.currencyData.currencyCode).toBe('INR');
  expect(Object.values(state.category.entities).map(c => c?.name)).toEqual(['Food']);
  expect(state.category.incomeCategories.map(c => c.name)).toEqual(['Income']);
});

it('repairs an archived-only income category, loads the repaired one, and says so in Diagnostics', async () => {
  const userId = await services.createUser('Ravi', '');
  await database.write(async () => {
    await (
      await database.get<Category>('categories').find(`inc_${userId}`)
    ).update(c => {
      c.categoryStatus = false;
    });
  });
  const logged = getErrorLog().length;
  const store = makeStore();
  await store.dispatch(bootstrapSession());
  expect(store.getState().category.incomeCategories.map(c => c.categoryStatus)).toEqual([true]);
  expect(
    getErrorLog()
      .slice(logged)
      .map(e => e.message),
  ).toEqual(['bootstrapSession: the income category was missing or archived and was restored']);
});

it('with no user (before onboarding) loads nothing else and does not throw', async () => {
  const store = makeStore();
  await expect(store.dispatch(bootstrapSession())).resolves.toBeDefined();
  expect(store.getState().userId.userId).toBe('');
  expect(store.getState().currencyData.currencyCode).toBe('');
});
