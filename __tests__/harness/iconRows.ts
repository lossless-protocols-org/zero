import type {Category as CategoryModel} from '../../src/data/database/models/Category';
import type {Debtor as DebtorModel} from '../../src/data/database/models/Debtor';
import {database} from '../../src/data/database/database';

/**
 * Category and debtor rows as an old build stored them (any icon and colour
 * text, valid or not), written straight to the database, and read back: the
 * data migrations' before and after.
 */
export const seedIconRows = async (
  rows: Array<{kind: 'category' | 'debtor'; name: string; icon: string; color: string}>,
) => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  await database.write(async () => {
    for (const row of rows) {
      if (row.kind === 'category') {
        await database.get<CategoryModel>('categories').create(c => {
          c.name = row.name;
          c.icon = row.icon;
          c.color = row.color;
          c.userId = 'u1';
          c.categoryStatus = true;
        });
      } else {
        await database.get<DebtorModel>('debtors').create(d => {
          d.title = row.name;
          d.icon = row.icon;
          d.color = row.color;
          d.userId = 'u1';
          d.type = 'Friend';
          d.debtorStatus = true;
        });
      }
    }
  });
};

export const readIconRows = async () => ({
  categories: (await database.get<CategoryModel>('categories').query().fetch())
    .map(c => [c.name, c.icon, c.color])
    .sort(),
  debtors: (await database.get<DebtorModel>('debtors').query().fetch()).map(d => [d.title, d.icon, d.color]).sort(),
});
