/**
 * Read budgets: how many SQLite statements a screen action costs (audit
 * 2026-11-08 §8). With JSI every one runs synchronously on the JS thread, so
 * the count is the cost a timing on a CI machine cannot show. A budget here
 * fails when a change adds a read; lower it when a change removes one.
 */
import {configureStore} from '@reduxjs/toolkit';
import {database} from '../../src/data/database/database';
import {rootReducer} from '../../src/store/rootReducer';
import {fetchUserData} from '../../src/store/slices/userIdSlice';
import {fetchExpensesByMonth, selectExpenseData} from '../../src/store/slices/expenseDataSlice';
import {createRefund} from '../../src/data/services/refundService';
import * as services from '../harness/services';
import {countReads} from '../harness/readCount';

const makeStore = () => configureStore({reducer: rootReducer});

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

const seedMonth = async () => {
  const userId = await services.createUser('Asha', '');
  const food = await services.createCategory('Food', userId, null, null, 'expense');
  const lunch = await services.createExpense(userId, 'Lunch', 120, '', food, '2026-11-03T13:00:00');
  await services.createExpense(userId, 'Tea', 20, '', food, '2026-11-04T09:00:00');
  await createRefund(lunch, {amount: 20, date: '2026-11-05T10:00:00', note: ''});
  const store = makeStore();
  store.dispatch(fetchUserData.fulfilled({userId, userName: 'Asha', userEmail: ''}, 'r'));
  return store;
};

describe("Home's month read", () => {
  it('is four reads the first time: expenses, refunds, the refund badges and the categories', async () => {
    const store = await seedMonth();
    const log = await countReads(() => store.dispatch(fetchExpensesByMonth('2026-11')));
    expect(log.reads.sort()).toEqual([
      'unsafeQueryRaw categories(user_id)',
      'unsafeQueryRaw expenses(id)', // the refunds' parent expenses (a refund may be on an older expense)
      'unsafeQueryRaw expenses(user_id,date)', // the month's expenses: one index range
      'unsafeQueryRaw refunds(user_id,date)', // refunds dated in the month
      'unsafeQueryRaw refunds(user_id,on(expenses))', // the badges: refunds joined onto the month's expenses
    ]);
    expect(
      selectExpenseData(store.getState(), '2026-11')
        .map(e => e.title)
        .sort(),
    ).toEqual(['Lunch', 'Tea']);
  });

  it('is one fewer on every later focus: the categories are kept until one changes', async () => {
    const store = await seedMonth();
    await store.dispatch(fetchExpensesByMonth('2026-11'));
    const log = await countReads(() => store.dispatch(fetchExpensesByMonth('2026-11')));
    expect(log.count).toBe(4);
    expect(log.reads).not.toContain('unsafeQueryRaw categories(user_id)');
  });

  it('a month with no refunds skips the parents read', async () => {
    const userId = await services.createUser('Asha', '');
    const food = await services.createCategory('Food', userId, null, null, 'expense');
    await services.createExpense(userId, 'Tea', 20, '', food, '2026-11-04T09:00:00');
    const store = makeStore();
    store.dispatch(fetchUserData.fulfilled({userId, userName: 'Asha', userEmail: ''}, 'r'));
    await store.dispatch(fetchExpensesByMonth('2026-11'));
    expect((await countReads(() => store.dispatch(fetchExpensesByMonth('2026-11')))).count).toBe(3);
  });
});
