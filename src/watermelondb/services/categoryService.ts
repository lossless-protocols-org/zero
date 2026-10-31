import {Q} from '@nozbe/watermelondb';
import {nanoid} from 'nanoid';
import {database} from '../database';
import Category from '../models/Category';
import {sanitizeString, DEFAULTS} from '../../utils/sanitize';
import {assertUserId} from './assertUserId';
import type {CategoryData} from '../../domain/types';
export type {CategoryData};

const toCategoryData = (c: Category): CategoryData => ({
  id: c.id,
  name: c.name,
  categoryStatus: c.categoryStatus,
  userId: c.userId,
  icon: sanitizeString(c.icon, DEFAULTS.icon),
  color: sanitizeString(c.color, DEFAULTS.color),
});

/**
 * Creates a new category
 */
export const createCategory = async (
  name: string,
  userId: string,
  icon: string | null,
  color: string | null,
): Promise<string> => {
  assertUserId(userId, 'category');
  const id = nanoid(24);
  await database.write(async () => {
    await database.get<Category>('categories').create(cat => {
      cat._raw.id = id;
      cat.name = name;
      cat.categoryStatus = true;
      cat.userId = userId;
      // Always assign string values for consistent Hidden Class shape
      cat.icon = sanitizeString(icon, DEFAULTS.icon);
      cat.color = sanitizeString(color, DEFAULTS.color);
    });
  });
  return id;
};

/**
 * Soft deletes a category by ID (sets categoryStatus to false)
 */
export const softDeleteCategoryById = async (categoryId: string): Promise<void> => {
  await database.write(async () => {
    const category = await database.get<Category>('categories').find(categoryId);
    await category.update(cat => {
      cat.categoryStatus = false;
    });
  });
};

/**
 * Updates a category by ID
 */
export const updateCategoryById = async (
  categoryId: string,
  newName?: string,
  newIcon?: string,
  newColor?: string,
): Promise<void> => {
  await database.write(async () => {
    const category = await database.get<Category>('categories').find(categoryId);
    await category.update(cat => {
      if (newName !== undefined) {
        cat.name = newName;
      }
      if (newIcon !== undefined) {
        cat.icon = sanitizeString(newIcon, DEFAULTS.icon);
      }
      if (newColor !== undefined) {
        cat.color = sanitizeString(newColor, DEFAULTS.color);
      }
    });
  });
};

/**
 * Gets all categories by user ID
 */
export const getAllCategoriesByUserId = async (userId: string): Promise<CategoryData[]> => {
  const categories = await database.get<Category>('categories').query(Q.where('user_id', userId)).fetch();
  return categories.map(toCategoryData);
};

/** One category (active or not), or null when the id no longer exists (M19). */
export const getCategoryById = async (categoryId: string): Promise<CategoryData | null> => {
  const [category] = await database.get<Category>('categories').query(Q.where('id', categoryId)).fetch();
  return category ? toCategoryData(category) : null;
};
