/**
 * Test-only: a small history for the Pro report suites (range, trends, PDF):
 * four months around a fixed "now" of 15 Nov 2026, with a refund, money in
 * and two categories, through the real services.
 */
import {store} from '../../src/store/store';
import {resetSession} from '../../src/store/rootReducer';
import {fetchUserData} from '../../src/store/slices/userIdSlice';
import {fetchCategories} from '../../src/store/slices/categoryDataSlice';
import {createRefund} from '../../src/data/services/refundService';
import {createIncome} from '../../src/data/services/incomeService';
import * as services from './services';
import type {IsoDay} from '../../src/domain/types';

export const REPORTS_NOW = new Date(2026, 10, 15, 12, 0, 0);

export interface ReportsSeed {
  userId: string;
  food: string;
  fuel: string;
}

export const seedReports = async (): Promise<ReportsSeed> => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  const fuel = await services.createCategory('Fuel', userId, 'car', '#222222', 'expense');
  const income = `inc_${userId}`; // createUser seeds it
  // August to October: 1000 a month, 600 food and 400 fuel; money in 5000.
  // The months are written as two digits: each date below is a real YYYY-MM-DD.
  for (const month of ['08', '09', '10']) {
    await services.createExpense(userId, 'Groceries', 600, '', food, `2026-${month}-05T10:00:00`);
    await services.createExpense(userId, 'Petrol', 400, '', fuel, `2026-${month}-20T10:00:00`);
    await createIncome(userId, {categoryId: income, amount: 5000, date: `2026-${month}-01` as IsoDay, note: 'Salary'});
  }
  // October also has a big food bill, partly refunded in November.
  const feast = await services.createExpense(userId, 'Feast', 900, '', food, '2026-10-25T20:00:00');
  await createRefund(feast, {amount: 300, date: '2026-11-03T09:00:00', note: ''});
  // November so far.
  await services.createExpense(userId, 'Chai', 20, '', food, '2026-11-15T08:00:00');
  await services.createExpense(userId, 'Petrol', 450, '', fuel, '2026-11-10T08:00:00');
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCategories());
  return {userId, food, fuel};
};
