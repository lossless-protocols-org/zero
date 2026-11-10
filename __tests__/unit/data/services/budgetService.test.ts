/**
 * M22 (v2.7.1): budget writes, tested on a real (LokiJS) database. These
 * replace assertions on the service's source text, which kept passing when
 * the code they described had moved.
 *
 * Tickets: B3.
 */
import type {Budget as BudgetModel} from '../../../../src/data/database/models/Budget';
import {database} from '../../../../src/data/database/database';
import {seedCategory} from '../../../harness/seedCategory';
import * as budgets from '../../../../src/data/services/budgetService';

const rows = async () =>
  (await database.get<BudgetModel>('budgets').query().fetch()).map(b => `${b.month}=${b.amount}`).sort();

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

describe('upsertBudget', () => {
  it('writes one row per month key, and updates that row on a second save', async () => {
    await budgets.upsertBudget('u1', 100, {kind: 'month', yearMonth: '2026-09'});
    await budgets.upsertBudget('u1', 200, {kind: 'month', yearMonth: '2026-10'});
    await budgets.upsertBudget('u1', 250, {kind: 'month', yearMonth: '2026-10'});
    expect(await rows()).toEqual(['2026-09=100', '2026-10=250']);
  });

  it('keeps an earlier recurring budget when a later one starts', async () => {
    await budgets.upsertBudget('u1', 10000, {kind: 'recurring', start: '2026-07'});
    await budgets.upsertBudget('u1', 15000, {kind: 'recurring', start: '2026-10'});
    expect(await rows()).toEqual(['recurring:2026-07=10000', 'recurring:2026-10=15000']);
    const september = await budgets.getBudgetsByMonth('u1', '2026-09');
    expect(september.map(b => b.amount)).toEqual([10000]);
  });

  it('keeps the overall and a category budget for the same month apart', async () => {
    await seedCategory(database, 'food');
    await budgets.upsertBudget('u1', 500, {kind: 'month', yearMonth: '2026-10'});
    await budgets.upsertBudget(
      'u1',
      50,
      {kind: 'month', yearMonth: '2026-10'},
      {budgetType: 'category', categoryId: 'food'},
    );
    await budgets.upsertBudget(
      'u1',
      60,
      {kind: 'month', yearMonth: '2026-10'},
      {budgetType: 'category', categoryId: 'food'},
    );
    expect(await rows()).toEqual(['2026-10=500', '2026-10=60']);
  });
});

describe('clearBudgetForMonth', () => {
  it('deletes a month-only budget outright', async () => {
    await budgets.upsertBudget('u1', 100, {kind: 'month', yearMonth: '2026-10'});
    await budgets.clearBudgetForMonth('u1', '2026-10');
    expect(await rows()).toEqual([]);
  });

  it('leaves a 0 tombstone for the month when a recurring budget still covers it', async () => {
    await budgets.upsertBudget('u1', 10000, {kind: 'recurring', start: '2026-07'});
    await budgets.clearBudgetForMonth('u1', '2026-10');
    expect(await rows()).toEqual(['2026-10=0', 'recurring:2026-07=10000']);
  });
});

describe('stopRecurringBudgetFrom', () => {
  it('ends the budget from that month on and keeps earlier months', async () => {
    await budgets.upsertBudget('u1', 10000, {kind: 'recurring', start: '2026-07'});
    await budgets.upsertBudget('u1', 300, {kind: 'month', yearMonth: '2026-11'});
    await budgets.stopRecurringBudgetFrom('u1', '2026-10');
    expect(await rows()).toEqual(['recurring:2026-07=10000', 'recurring:2026-10=0']);
  });
});
