/**
 * Extra income categories are Pro data kept (law L9): counted, and folded in
 * only on the user's request, every entry kept. Real LokiJS database.
 */
import {Q} from '@nozbe/watermelondb';
import {database} from '../../../../src/data/database/database';
import type {Category} from '../../../../src/data/database/models/Category';
import {seedIncomeCategory} from '../../../harness/incomeCategories';
import type {Income} from '../../../../src/data/database/models/Income';
import {defaultIncomeCategoryId} from '../../../../src/data/database/defaultIncomeCategory';
import {extraIncomeCategoriesPart} from '../../../../src/data/services/incomeCategoryFold';
import {countKeptProData, removeProData} from '../../../../src/data/services/proDataService';
import * as services from '../../../harness/services';

let userId = '';
let primary = '';

const seed = (id: string, sortOrder: number, active = true) =>
  seedIncomeCategory(userId, id, {name: id[0]?.toUpperCase() + id.slice(1), sortOrder, active});

const incomes = async () =>
  (await database.get<Income>('incomes').query(Q.sortBy('amount', Q.asc)).fetch()).map(i => ({
    amount: i.amount,
    categoryId: i.categoryId,
    note: i.note,
  }));
const incomeCategoryIds = async () =>
  (await database.get<Category>('categories').query(Q.where('kind', 'income')).fetch()).map(c => c.id).sort();

beforeEach(async () => {
  await services.deleteAllData();
  userId = await services.createUser('Asha', '');
  primary = defaultIncomeCategoryId(userId);
});

it('an install with one income category has nothing kept', async () => {
  expect(await extraIncomeCategoriesPart.count()).toBe(0);
  const planned: unknown[] = [];
  await extraIncomeCategoriesPart.planRemoval({update: r => planned.push(r), destroy: r => planned.push(r)});
  expect(planned).toEqual([]);
});

it('counts the active ones beyond the primary; archived ones are the user’s archive, not Pro data', async () => {
  await seed('freelance', 20);
  await seed('rent', 30);
  await seed('old', 40, false);
  expect(await extraIncomeCategoriesPart.count()).toBe(2);
  expect(await countKeptProData()).toBe(2);
});

it('folds them in: every entry moves to the primary, a blank note takes the old name, the extras go', async () => {
  await seed('freelance', 20);
  await seed('old', 40, false);
  await services.createIncome(userId, {categoryId: primary, amount: 100, date: '2026-11-01', note: 'Salary'});
  await services.createIncome(userId, {categoryId: 'freelance', amount: 200, date: '2026-11-02', note: ''});
  await services.createIncome(userId, {categoryId: 'freelance', amount: 300, date: '2026-11-03', note: 'logo'});
  await services.createIncome(userId, {categoryId: 'old', amount: 400, date: '2026-11-04', note: ''});

  await removeProData();

  expect(await incomes()).toEqual([
    {amount: 100, categoryId: primary, note: 'Salary'},
    {amount: 200, categoryId: primary, note: 'Freelance'},
    {amount: 300, categoryId: primary, note: 'logo'},
    // The archived category and its entry are untouched.
    {amount: 400, categoryId: 'old', note: ''},
  ]);
  expect(await incomeCategoryIds()).toEqual([primary, 'old'].sort());
  expect(await countKeptProData()).toBe(0);
});

it('folds into the primary even when the primary is not the oldest row', async () => {
  // The default category reordered below a restored one: the first active in order is the one kept.
  await seed('salary', 5);
  await services.createIncome(userId, {categoryId: primary, amount: 100, date: '2026-11-01', note: ''});
  await removeProData();
  expect(await incomes()).toEqual([{amount: 100, categoryId: 'salary', note: 'Income'}]);
  expect(await incomeCategoryIds()).toEqual(['salary']);
});
