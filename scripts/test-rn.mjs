#!/usr/bin/env node
/**
 * Runs, under jest, exactly the suites `bun test` cannot (M23, v2.7.1): the
 * ones bunfig.toml's `pathIgnorePatterns` exclude. Reading the list from
 * bunfig means `test:unit` (bun) and `test:rn` (this) always cover every
 * suite between them; `test` (all of jest) stays the gate.
 *
 * Usage: node scripts/test-rn.mjs [extra jest args]
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bunfig = fs.readFileSync(path.join(root, 'bunfig.toml'), 'utf8');

const block = /pathIgnorePatterns\s*=\s*\[([\s\S]*?)\]/.exec(bunfig);
if (!block) {
  console.error('test-rn: no pathIgnorePatterns in bunfig.toml');
  process.exit(1);
}
const globs = [...block[1].matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(glob => !glob.startsWith('references/'));

// bunfig globs are relative to the repo root; jest matches absolute paths.
const toRegex = glob =>
  `^${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${glob
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .split('**')
    .map(part => part.replace(/\*/g, '[^/]*'))
    .join('.*')}`;

const pattern = globs.map(toRegex).join('|');
const result = spawnSync('bunx', ['jest', '--testPathPatterns', pattern, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) {
  console.error(`test-rn: could not start jest: ${result.error.message}`);
}
process.exit(result.status ?? 1);
