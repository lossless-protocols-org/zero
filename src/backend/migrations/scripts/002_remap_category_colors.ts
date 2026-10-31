import {database} from '../../../watermelondb/database';
import Category from '../../../watermelondb/models/Category';
import Debtor from '../../../watermelondb/models/Debtor';
import {COLOR_REMAP} from '../colorRemap';

interface DataMigration {
  version: number;
  name: string;
  up: () => Promise<void>;
}

// Re-export for any existing consumers; the canonical map lives in colorRemap.ts
export {COLOR_REMAP};

const up = async (): Promise<void> => {
  const caseInsensitiveMap = new Map<string, string>();
  for (const [old, replacement] of Object.entries(COLOR_REMAP)) {
    caseInsensitiveMap.set(old.toUpperCase(), replacement);
  }

  await database.write(async () => {
    const categories = await database.get<Category>('categories').query().fetch();
    for (const cat of categories) {
      const mapped = caseInsensitiveMap.get(cat.color.toUpperCase());
      if (mapped) {
        await cat.update(c => {
          c.color = mapped;
        });
      }
    }

    const debtors = await database.get<Debtor>('debtors').query().fetch();
    for (const debtor of debtors) {
      const mapped = caseInsensitiveMap.get(debtor.color.toUpperCase());
      if (mapped) {
        await debtor.update(d => {
          d.color = mapped;
        });
      }
    }
  });
};

export const migration_002: DataMigration = {
  version: 2,
  name: 'remap_category_colors_wcag',
  up,
};
