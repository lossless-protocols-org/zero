/**
 * Categorise from history (2.8 §5.3) against the real schema in SQLite: the
 * exact query finds the newest expense of a title, compares titles the way
 * the key does, and is answered by the title index alone (the Moto measured
 * 18.5 ms avg / 27.6 ms max for a title with no history before the index;
 * gate 16 ms). Runs under `bun test` only (bun:sqlite).
 */
import {Database} from 'bun:sqlite';
import {encodeSchema} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import {schema} from '../../src/data/database/schema';
import {migrations} from '../../src/data/database/migrations';
import {EXPENSES_TITLE_KEY_INDEX_SQL} from '../../src/data/database/indexes';
import {TITLE_HISTORY_SQL} from '../../src/data/services/titleHistory';
import {titleKey} from '../../src/domain/titleKey';

interface CategoryRow {
  category_id: string;
}
interface PlanRow {
  detail: string;
}
interface KeyRow {
  key: string;
}

const fresh = (): Database => {
  const db = new Database(':memory:');
  db.exec(encodeSchema(schema));
  const insert = db.prepare(
    "insert into expenses (id, _status, title, amount, description, category_id, user_id, date) values (?, 'synced', ?, 1, '', ?, ?, ?)",
  );
  const rows: Array<[string, string, string, string, string]> = [
    ['a', 'Chai', 'food', 'u1', '2026-10-01T08:00:00'],
    ['b', 'chai ', 'drinks', 'u1', '2026-11-02T08:00:00'], // newest "chai" for u1
    ['c', 'CHAI', 'other', 'u2', '2026-11-05T08:00:00'], // another user
    ['d', 'Café', 'food', 'u1', '2026-11-03T08:00:00'],
  ];
  for (const row of rows) insert.run(...row);
  db.exec(
    "insert into expenses (id, _status, title, amount, description, category_id, user_id, date) values ('e', 'deleted', 'Chai', 1, '', 'gone', 'u1', '2026-11-09')",
  );
  return db;
};

const find = (db: Database, title: string, user = 'u1'): string | null =>
  db.query<CategoryRow>(TITLE_HISTORY_SQL).get(titleKey(title), user)?.category_id ?? null;

describe('categorise from history: the query', () => {
  it('finds the newest expense of a title for this user, ignoring case, outer spaces and deleted rows', () => {
    const db = fresh();
    expect(find(db, 'Chai')).toBe('drinks');
    expect(find(db, '  CHAI')).toBe('drinks');
    expect(find(db, 'café')).toBe('food');
    expect(find(db, 'Chai', 'u2')).toBe('other');
    expect(find(db, 'Samosa')).toBeNull();
  });

  it('computes the key exactly as SQLite does', () => {
    const db = fresh();
    for (const title of ['Chai', '  CHAI  ', 'Café', 'ÉCOLE', 'Bus 42', 'ünïcode Ä']) {
      const sqlite = db.query<KeyRow>('select lower(trim(?)) as key').get(title)?.key;
      expect(titleKey(title)).toBe(sqlite ?? '');
    }
  });

  it('is answered by the title index alone, for a title with or without history', () => {
    const db = fresh();
    for (const title of ['chai', 'never typed']) {
      const plan = db
        .query<PlanRow>(`explain query plan ${TITLE_HISTORY_SQL}`)
        .all(titleKey(title), 'u1')
        .map(r => r.detail)
        .join(' | ');
      expect(plan).toContain('USING INDEX expenses_title_key_date');
      expect(plan).not.toContain('TEMP B-TREE');
    }
  });

  it('the v5 migration creates the same index (upgrades end like fresh installs)', () => {
    const v5 = migrations.sortedMigrations.find(m => m.toVersion === 5);
    const sqls = (v5?.steps ?? []).flatMap(step => ('sql' in step && typeof step.sql === 'string' ? [step.sql] : []));
    expect(sqls).toContain(EXPENSES_TITLE_KEY_INDEX_SQL);
  });
});
