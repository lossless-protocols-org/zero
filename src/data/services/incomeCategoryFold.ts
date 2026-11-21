import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Category} from '../database/models/Category';
import {Income} from '../database/models/Income';
import {primaryIncomeCategory} from '../../domain/incomeCategories';
import type {ProDataPart} from './proDataService';

/**
 * Income categories beyond the one Free shows (3.0): what a restored Pro
 * backup, or a lapsed subscription, leaves behind. Each user's ACTIVE income
 * categories other than their primary (domain/incomeCategories) are the ones
 * Free does not list. Archived ones are hidden in both tiers and are not
 * counted: they are the user's own archive, not Pro data.
 */
const extrasByUser = async (): Promise<Array<{primary: Category; extras: Category[]}>> => {
  const categories = await database.get<Category>('categories').query(Q.where('kind', 'income')).fetch();
  const byUser = new Map<string, Category[]>();
  for (const category of categories) {
    byUser.set(category.userId, [...(byUser.get(category.userId) ?? []), category]);
  }
  return [...byUser.values()].flatMap(own => {
    const primary = primaryIncomeCategory(own);
    const extras = own.filter(category => category !== primary && category.categoryStatus);
    return primary && extras.length > 0 ? [{primary, extras}] : [];
  });
};

/**
 * Pro data kept (law L9): the extra income categories, counted, and folded in
 * on the user's own request. Folding moves every money-in entry of an extra
 * onto the primary category and removes the extra; nothing else changes. An
 * entry with no note takes its old category's name as its note ("Freelance"),
 * so the row still says what it was. This is what 2.8 did on every restore,
 * now only when asked.
 */
export const extraIncomeCategoriesPart: ProDataPart = {
  key: 'incomeCategories',
  count: async () => (await extrasByUser()).reduce((sum, {extras}) => sum + extras.length, 0),
  planRemoval: async plan => {
    for (const {primary, extras} of await extrasByUser()) {
      const nameById = new Map(extras.map(category => [category.id, category.name]));
      const incomes = await database
        .get<Income>('incomes')
        .query(Q.where('category_id', Q.oneOf([...nameById.keys()])))
        .fetch();
      for (const income of incomes) {
        plan.update(income, i => {
          i.note = i.note || (nameById.get(i.categoryId) ?? '');
          i.categoryId = primary.id;
        });
      }
      extras.forEach(category => plan.destroy(category));
    }
  },
};
