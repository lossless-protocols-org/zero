import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fromRoot} from './paths';

/**
 * The day every test seed ends on. Fixed, so a suite sees the same rows on
 * every day and machine; scripts/seed-backup.mjs without `--anchor` ends on
 * today, which made six suites run on a different dataset each day (audit
 * 2026-11-08 §7.5).
 */
export const SEED_ANCHOR = '2026-11-01';

const SCRIPT = fromRoot('scripts', 'seed-backup.mjs');

/**
 * Path of the seed backup with `count` expenses (compact JSON), generated once
 * per script version and reused across suites and runs: the file name carries
 * a hash of the generator, so editing it regenerates. Written to a temporary
 * name first, so parallel workers never read a half-written file.
 */
const seedBackupPath = (count: number): string => {
  const version = createHash('sha1').update(readFileSync(SCRIPT)).digest('hex').slice(0, 12);
  const file = path.join(tmpdir(), `zero-seed-${count}-${SEED_ANCHOR}-${version}.json`);
  if (!existsSync(file)) {
    const partial = `${file}.${process.pid}.tmp`;
    execFileSync('node', [SCRIPT, String(count), '--compact', '--anchor', SEED_ANCHOR, '--out', partial], {
      stdio: 'pipe',
    });
    renameSync(partial, file);
  }
  return file;
};

/** The seed backup with `count` expenses, parsed. Callers validate it with the app's own reader. */
export const seedBackup = (count: number): unknown => JSON.parse(readFileSync(seedBackupPath(count), 'utf8'));
