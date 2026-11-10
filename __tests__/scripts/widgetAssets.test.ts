/**
 * The widgets' generated copy, colours and preview figures (2.8; colours since
 * audit 2026-11-08 §6.3) match their sources: src/i18n/locales and
 * contracts/widget-assets.json. A hand edit to a generated file, or a source
 * change without regenerating, fails here.
 */
import {execFileSync} from 'node:child_process';
import {fromRoot} from '../harness/paths';

it('the Android resources and the iOS catalog and Swift regions are up to date', () => {
  const out: string = execFileSync('node', [fromRoot('scripts', 'widget-assets.mjs'), '--check'], {
    encoding: 'utf8',
  });
  expect(out.trim()).toBe('widget-assets: 0 stale');
});
