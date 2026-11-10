import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Category} from '../database/models/Category';
import type {CategoryKind} from '../../domain/types';

/** A stored kind as the app reads it: anything but 'income' is an expense category (rows before v5 have ''). */
export const toCategoryKind = (value: string | undefined): CategoryKind => (value === 'income' ? 'income' : 'expense');

/**
 * True when `categoryId` is one of `userId`'s categories of `kind` (active or
 * archived). Every write that points an entry at a category checks this: the
 * forms only offer the right ones, the services make it a rule (audit
 * 2026-11-08 §4.3). Its own module so the entry services can use it without
 * importing categoryService (which reads expenses: a cycle).
 */
export const isUsersCategoryOfKind = async (
  userId: string,
  categoryId: string,
  kind: CategoryKind,
): Promise<boolean> => {
  if (!categoryId) {
    return false;
  }
  const [category] = await database.get<Category>('categories').query(Q.where('id', categoryId)).fetch();
  return !!category && category.userId === userId && toCategoryKind(category.kind) === kind;
};
