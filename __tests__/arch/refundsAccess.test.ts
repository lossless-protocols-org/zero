/**
 * R2: spending is netted against refunds in ONE place, periodSummaryService.
 * A screen, hook or slice that read the refunds table and subtracted it
 * itself would drift from every other figure (the budget card, Reports, the
 * widget). This guard lists the only database-touching modules allowed to
 * name the table; the file-format modules (data/backup/export, data/backup/import)
 * use `refunds` as a JSON key and never open the database.
 */
import fs from 'node:fs';
import path from 'node:path';
import {REPO_ROOT} from '../harness/paths';

const ALLOWED = new Set([
  'src/data/database/v5Tables.ts', // defines it
  'src/data/database/indexes.ts', // indexes it
  'src/data/database/models/Refund.ts', // models it
  'src/data/database/models/Expense.ts', // has_many association
  'src/data/services/refundService.ts', // writes it
  'src/data/services/periodSummaryService.ts', // the one netting read
  'src/data/services/getService.ts', // export
  'src/data/services/importService.ts', // restore
  'src/data/services/deleteService.ts', // counts
  'src/data/services/tableChanges.ts', // watches it for writes; reads nothing
]);

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true}) as Array<{name: string; isDirectory: () => boolean}>) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'testing') {
        walk(full, out);
      }
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

it('only the permitted modules name the refunds table', () => {
  const root = REPO_ROOT;
  const offenders = walk(path.join(root, 'src'))
    .map(file => path.relative(root, file).split(path.sep).join('/'))
    .filter(file => !ALLOWED.has(file))
    .filter(file => {
      const text: string = fs.readFileSync(path.join(root, file), 'utf8');
      // Imports the database module (data/database/database, or ./database inside it).
      return /from ['"][^'"]*\/database['"]/.test(text) && /['"`]refunds['"`]/.test(text);
    });
  expect(offenders).toEqual([]);
});
