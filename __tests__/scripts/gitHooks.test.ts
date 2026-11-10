/**
 * The pre-push hook runs the gate CI runs, and `bun install` installs it
 * (audit 2026-11-08 §10: "no hooks"). No hook manager: git's own
 * core.hooksPath, set by package.json "prepare".
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';

it('package.json installs the hooks folder on install', () => {
  const scripts = JSON.parse(fs.readFileSync(fromRoot('package.json'), 'utf8')).scripts as Record<string, string>;
  expect(scripts['prepare']).toContain('git config core.hooksPath .githooks');
});

it('pre-push runs the whole check and is executable', () => {
  const hook = fromRoot('.githooks', 'pre-push');
  expect(fs.readFileSync(hook, 'utf8')).toMatch(/^bun run check$/m);
  expect(() => fs.accessSync(hook, fs.constants.X_OK)).not.toThrow();
});
