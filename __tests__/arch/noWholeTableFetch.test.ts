/**
 * No screen, hook or service reads a whole table that grows with use (L1,
 * v2.7.1: the Home list used to fetch every expense the user ever entered,
 * then filter to the month in JS). Reads are bounded by a clause — a month,
 * a day, an id — and the whole-table reads that must exist are named here.
 *
 * Structural, not by name: it replaced two tests that asserted the old
 * thunk and services were gone by name, which could never fail again once
 * those names were forgotten (audit 2026-11-08 §7.5).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fromRoot, REPO_ROOT} from '../harness/paths';

/** Tables whose rows the user adds every day. */
const GROWING = ['expenses', 'refunds', 'incomes', 'debts'];

/** Where reading all of one is the job. */
const WHOLE_TABLE_READERS: Record<string, string> = {
  'src/data/services/getService.ts': 'the export copies every row',
};
/** Where every table is read (a table chosen at runtime). */
const EVERY_TABLE_READERS: Record<string, string> = {
  'src/data/services/deleteService.ts': 'delete-all counts and removes every row',
  'src/data/services/importService.ts': 'a restore replaces every row',
};

const sources = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });

/** `database.get<…>(<table>)` then `.query()` with no clause, across line breaks. */
const CLAUSELESS = /\.get(?:<[^>]*>)?\(\s*([^)]*?)\s*\)\s*\.query\(\s*\)/g;

const offenders = () =>
  sources(fromRoot('src')).flatMap(file => {
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    return [...fs.readFileSync(file, 'utf8').matchAll(CLAUSELESS)].flatMap(([, table = '']) => {
      const literal = /^['"](\w+)['"]$/.exec(table)?.[1];
      if (literal !== undefined) {
        return GROWING.includes(literal) && !(rel in WHOLE_TABLE_READERS) ? [`${rel}: all of ${literal}`] : [];
      }
      return rel in EVERY_TABLE_READERS ? [] : [`${rel}: all of a table chosen at runtime (${table})`];
    });
  });

it('reads a growing table whole only where that is the job', () => {
  expect(offenders()).toEqual([]);
});

it('the rule sees a clause-less read across line breaks (it would catch the old Home fetch)', () => {
  const sample = "database\n  .get<Expense>('expenses')\n  .query()\n  .fetch()";
  expect([...sample.matchAll(CLAUSELESS)].map(m => m[1])).toEqual(["'expenses'"]);
  expect([..."database.get('expenses').query(Q.where('date', x))".matchAll(CLAUSELESS)]).toEqual([]);
});
