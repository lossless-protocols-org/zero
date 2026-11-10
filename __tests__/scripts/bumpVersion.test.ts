/**
 * M25 (v2.7.1): the version bump refuses what used to corrupt release
 * numbers (a re-run incremented versionCode twice).
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';
import {getAppVersion} from '../../src/platform/getVersion';

interface Plan {
  error?: string;
  newCode?: number;
  newBuild?: number;
  gradle?: string;
  pbx?: string;
  appVersionSource?: string;
}
const {
  planBump,
}: {
  planBump: (input: {
    version: string;
    pkgVersion: string;
    gradle: string;
    pbx: string;
    appVersionSource: string;
  }) => Plan;
} = require('../../scripts/bump-version.js');

const gradle = 'versionCode 22\n        versionName "2.7.0"';
const appVersionSource = "const APP_VERSION = '2.7.0';\n";
const pbx =
  'CURRENT_PROJECT_VERSION = 22;\nMARKETING_VERSION = 2.7.0;\nCURRENT_PROJECT_VERSION = 22;\nMARKETING_VERSION = 2.7.0;';

it('bumps both platforms once', () => {
  const plan = planBump({version: '2.7.1', pkgVersion: '2.7.0', gradle, pbx, appVersionSource});
  expect(plan.error).toBeUndefined();
  expect(plan.gradle).toBe('versionCode 23\n        versionName "2.7.1"');
  expect(plan.pbx).toBe(
    'CURRENT_PROJECT_VERSION = 23;\nMARKETING_VERSION = 2.7.1;\nCURRENT_PROJECT_VERSION = 23;\nMARKETING_VERSION = 2.7.1;',
  );
  expect(plan.appVersionSource).toBe("const APP_VERSION = '2.7.1';\n");
});

it('the app reads the version package.json has (the bump writes both)', () => {
  expect(getAppVersion()).toBe(JSON.parse(fs.readFileSync(fromRoot('package.json'), 'utf8')).version);
});

it('refuses when getVersion.ts has no version constant to write', () => {
  expect(planBump({version: '2.8', pkgVersion: '2.7.0', gradle, pbx, appVersionSource: ''}).error).toMatch(
    /getVersion/,
  );
});

it('refuses a re-run with the same version, a lower one, and a non-version', () => {
  expect(planBump({version: '2.7.0', pkgVersion: '2.7.0', gradle, pbx, appVersionSource}).error).toMatch(/not higher/);
  expect(planBump({version: '2.6.9', pkgVersion: '2.7.0', gradle, pbx, appVersionSource}).error).toMatch(/not higher/);
  expect(planBump({version: 'v2.8', pkgVersion: '2.7.0', gradle, pbx, appVersionSource}).error).toMatch(
    /not a version/,
  );
  expect(planBump({version: '2.8', pkgVersion: '2.7.0', gradle, pbx, appVersionSource}).error).toBeUndefined();
});

it('refuses when a version field is missing or the iOS targets disagree', () => {
  expect(
    planBump({version: '2.8', pkgVersion: '2.7.0', gradle: 'versionCode 22', pbx, appVersionSource}).error,
  ).toMatch(/not found/);
  expect(
    planBump({
      version: '2.8',
      pkgVersion: '2.7.0',
      gradle,
      pbx: pbx.replace('CURRENT_PROJECT_VERSION = 22;', 'CURRENT_PROJECT_VERSION = 21;'),
      appVersionSource,
    }).error,
  ).toMatch(/disagree/);
});
