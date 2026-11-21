import {database} from '../../src/data/database/database';
import type {Category} from '../../src/data/database/models/Category';

/**
 * An income category as a restored Pro backup leaves it: written directly,
 * because Free's create service refuses a second one (until plan P9).
 */
export const seedIncomeCategory = async (
  userId: string,
  id: string,
  {name = id, sortOrder = 20, active = true}: {name?: string; sortOrder?: number; active?: boolean} = {},
): Promise<void> => {
  await database.write(async () => {
    await database.get<Category>('categories').create(category => {
      category._raw.id = id;
      category.name = name;
      category.kind = 'income';
      category.userId = userId;
      category.categoryStatus = active;
      category.sortOrder = sortOrder;
      category.icon = 'briefcase';
      category.color = '#AA5500';
    });
  });
};
