import {migration_001} from './scripts/001_sanitize_icon_color';
import {migration_002} from './scripts/002_remap_category_colors';

export interface DataMigration {
  version: number;
  name: string;
  up: () => Promise<void>;
}

/**
 * Ordered list of all data migrations.
 * Each migration runs exactly once, tracked by version in MMKV.
 *
 * To add a new migration:
 * 1. Create src/data/dataMigrations/scripts/NNN_description.ts
 * 2. Export { version: N, name: '...', up: async () => { ... } }
 * 3. Import and add it to this array
 *
 * Scale rule (L8, v2.7.1): the existing scripts `await record.update()` per
 * row, which is fine for categories and debtors (≤ ~100 rows). Anything that
 * touches `expenses` or `debts` must instead collect `record.prepareUpdate()`
 * calls and commit them with ONE `database.batch([...])` inside the write:
 * a per-row await on a 10k-row table is thousands of round trips through
 * the adapter, and a failure half-way leaves the table half-migrated.
 */
export const DATA_MIGRATIONS: DataMigration[] = [migration_001, migration_002];
