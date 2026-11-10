import {database} from '../../database/database';
import {Category} from '../../database/models/Category';
import {Debtor} from '../../database/models/Debtor';
import {isPoisonedValue, sanitizeString, DEFAULTS} from '../../../domain/sanitize';

interface DataMigration {
  version: number;
  name: string;
  up: () => Promise<void>;
}

/**
 * Migration 001: Sanitize icon and color fields
 *
 * Fixes legacy data where icon/color were stored as literal string "null",
 * empty string "", or "undefined" instead of proper values.
 * Affects: categories, debtors
 */
const up = async (): Promise<void> => {
  await database.write(async () => {
    const categories = await database.get<Category>('categories').query().fetch();
    for (const cat of categories) {
      const iconBad = isPoisonedValue(cat.icon);
      const colorBad = isPoisonedValue(cat.color);
      if (iconBad || colorBad) {
        await cat.update(c => {
          if (iconBad) {
            c.icon = sanitizeString(cat.icon, DEFAULTS.icon);
          }
          if (colorBad) {
            c.color = sanitizeString(cat.color, DEFAULTS.color);
          }
        });
      }
    }

    const debtors = await database.get<Debtor>('debtors').query().fetch();
    for (const debtor of debtors) {
      const iconBad = isPoisonedValue(debtor.icon);
      const colorBad = isPoisonedValue(debtor.color);
      if (iconBad || colorBad) {
        await debtor.update(d => {
          if (iconBad) {
            d.icon = sanitizeString(debtor.icon, DEFAULTS.icon);
          }
          if (colorBad) {
            d.color = sanitizeString(debtor.color, DEFAULTS.color);
          }
        });
      }
    }
  });
};

export const migration_001: DataMigration = {
  version: 1,
  name: 'sanitize_icon_color',
  up,
};
