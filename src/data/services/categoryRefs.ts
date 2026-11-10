import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {DEFAULTS} from '../../domain/sanitize';
import type {CategoryRef} from '../../domain/types';

/** A category row as SQLite holds it (column names; keep in step with schema.ts). */
interface RawCategoryRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

/**
 * Every category of a user (archived ones included, so old expenses still
 * show their name, icon and colour), as the lists join them onto rows.
 *
 * A month read used to load all the user's categories as Models twice, once
 * for its expenses and once for its refunds, on every Home focus (audit
 * 2026-11-08 §8.4). Categories change rarely and only through writes, so the
 * map is built once from raw rows and dropped on any write to the table.
 * The drop is synchronous with the write's commit: a read that starts after a
 * category write has returned always sees it. A database reset sends no
 * change events, so the key also carries WatermelonDB's reset count (the
 * counter it bumps for that purpose, typed on Database).
 */
const cache = new Map<string, Promise<ReadonlyMap<string, CategoryRef>>>();
let watching = false;

const watchWrites = (): void => {
  if (watching) {
    return;
  }
  watching = true;
  // For the life of the JS runtime: the cache lives as long, and one subscription costs nothing.
  database.withChangesForTables(['categories']).subscribe(() => cache.clear());
};

const load = async (userId: string): Promise<ReadonlyMap<string, CategoryRef>> => {
  // unsafeFetchRaw is typed any[]; the rows are schema.ts's categories table.
  const rows: RawCategoryRow[] = await database.get('categories').query(Q.where('user_id', userId)).unsafeFetchRaw();
  return new Map(
    rows.map(row => [row.id, {id: row.id, name: row.name, icon: row.icon ?? '', color: row.color ?? DEFAULTS.color}]),
  );
};

/** The user's categories by id. Read-only: the map is shared by every caller until a category write. */
export const categoryRefsOf = (userId: string): Promise<ReadonlyMap<string, CategoryRef>> => {
  watchWrites();
  const key = `${database._resetCount}:${userId}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const loading = load(userId);
  cache.set(key, loading);
  // A failed read is not kept: the next caller tries again.
  loading.catch(() => {
    if (cache.get(key) === loading) {
      cache.delete(key);
    }
  });
  return loading;
};
