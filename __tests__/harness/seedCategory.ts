import type {Database} from '@nozbe/watermelondb';
import type {Category} from '../../src/data/database/models/Category';
import type {CategoryKind} from '../../src/domain/types';

/**
 * A category with a chosen id, for tests that refer to it by a readable id
 * ('food'). The services refuse entries and budgets that point at a category
 * the user does not have (audit 2026-11-08 §4.3), so tests seed one first.
 */
export const seedCategory = async (
  database: Database,
  id: string,
  {userId = 'u1', kind = 'expense', name = id}: {userId?: string; kind?: CategoryKind; name?: string} = {},
): Promise<void> => {
  await database.write(async () => {
    await database.get<Category>('categories').create(category => {
      category._raw.id = id;
      category.name = name;
      category.kind = kind;
      category.userId = userId;
      category.categoryStatus = true;
      category.sortOrder = 10;
      category.icon = 'circle';
      category.color = '#888888';
    });
  });
};
