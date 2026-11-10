/**
 * No unused file, export, type or dependency (M14, v2.7.1; knip since audit
 * 2026-11-08 §7.7, configured in knip.jsonc). Two passes:
 *   - default: tests count as users, so this finds what nothing uses at all;
 *   - --production: only the app counts, so an export kept alive by a test
 *     alone must say so with `@internal` (and a stale `@internal` is a hint).
 */
import {spawnSync} from 'node:child_process';
import {fromRoot, REPO_ROOT} from '../harness/paths';

const knip = (...args: string[]) => {
  const run = spawnSync(fromRoot('node_modules', '.bin', 'knip'), ['--no-progress', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return {status: run.status, report: `${run.stdout}${run.stderr}`.trim()};
};

it('nothing in the repository is unused (tests count)', () => {
  expect(knip()).toEqual({status: 0, report: ''});
});

it('nothing in the app is kept alive only by a test, unless it says @internal', () => {
  expect(knip('--production')).toEqual({status: 0, report: ''});
});
