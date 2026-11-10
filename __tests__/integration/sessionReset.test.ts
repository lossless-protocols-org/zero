/**
 * "Delete all data" and a restore leave nothing of the previous user in the
 * store (audit 2026-11-08 §3.10): every slice goes back to its initial state,
 * and a read that started before the reset cannot write the old user back
 * when it lands, logged or not.
 */
import {configureStore} from '@reduxjs/toolkit';
import {rootReducer, resetSession} from '../../src/store/rootReducer';
import {createSessionGuard} from '../../src/store/sessionGuard';
import {thunkRejectionMiddleware} from '../../src/store/thunkRejectionMiddleware';
import {fetchUserData} from '../../src/store/slices/userIdSlice';
import {setCurrencyData} from '../../src/store/slices/currencyDataSlice';
import {fetchExpensesByMonth} from '../../src/store/slices/expenseDataSlice';
import {getErrorLog} from '../../src/platform/errorLog';

const makeStore = () =>
  configureStore({
    reducer: rootReducer,
    middleware: getDefault => getDefault().concat(createSessionGuard(), thunkRejectionMiddleware),
  });

const user = (userId: string) => ({userId, userName: 'Seed', userEmail: ''});
const EMPTY_PERIOD = {expenses: [], refunds: [], refundedByExpense: {}};

describe('resetSession', () => {
  it('puts every slice back to its initial state', () => {
    const store = makeStore();
    store.dispatch(fetchUserData.fulfilled(user('old'), 'r1'));
    store.dispatch(
      setCurrencyData({currencyId: 'c1', currencyCode: 'INR', currencyName: 'Rupee', currencySymbol: '₹'}),
    );
    store.dispatch(fetchExpensesByMonth.pending('m1', '2026-11'));
    store.dispatch(fetchExpensesByMonth.fulfilled(EMPTY_PERIOD, 'm1', '2026-11'));
    expect(store.getState().userId.userId).toBe('old');

    store.dispatch(resetSession());
    expect(store.getState()).toEqual(rootReducer(undefined, {type: '@@INIT'}));
  });

  it('drops a read that started before the reset, and keeps one that started after', () => {
    const store = makeStore();
    store.dispatch(fetchUserData.pending('before'));
    store.dispatch(resetSession());
    store.dispatch(fetchUserData.pending('after'));

    store.dispatch(fetchUserData.fulfilled(user('deleted-user'), 'before'));
    expect(store.getState().userId.userId).toBe('');

    store.dispatch(fetchUserData.fulfilled(user('restored-user'), 'after'));
    expect(store.getState().userId.userId).toBe('restored-user');
  });

  it('a dropped failure is not logged or shown: it belongs to data that is gone', () => {
    const store = makeStore();
    const logged = getErrorLog().length;
    store.dispatch(fetchExpensesByMonth.pending('m1', '2026-11'));
    store.dispatch(resetSession());
    store.dispatch(fetchExpensesByMonth.rejected(null, 'm1', '2026-11', 'database is locked'));
    expect(store.getState().dataError).toEqual(rootReducer(undefined, {type: '@@INIT'}).dataError);
    expect(getErrorLog()).toHaveLength(logged);
  });

  it('a failure after the reset still reaches the banner', () => {
    const store = makeStore();
    store.dispatch(resetSession());
    store.dispatch(fetchExpensesByMonth.pending('m2', '2026-11'));
    store.dispatch(fetchExpensesByMonth.rejected(null, 'm2', '2026-11', 'database is locked'));
    expect(Object.keys(store.getState().dataError.byThunk)).toEqual(['expense/fetchByMonth']);
  });
});
