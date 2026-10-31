/**
 * M25 (v2.7.1): the version bump refuses what used to corrupt release
 * numbers (a re-run incremented versionCode twice).
 */
export {};

interface Plan {
  error?: string;
  newCode?: number;
  newBuild?: number;
  gradle?: string;
  pbx?: string;
}
const {
  planBump,
}: {
  planBump: (input: {version: string; pkgVersion: string; gradle: string; pbx: string}) => Plan;
} = require('../scripts/bump-version.js');

const gradle = 'versionCode 22\n        versionName "2.7.0"';
const pbx =
  'CURRENT_PROJECT_VERSION = 22;\nMARKETING_VERSION = 2.7.0;\nCURRENT_PROJECT_VERSION = 22;\nMARKETING_VERSION = 2.7.0;';

it('bumps both platforms once', () => {
  const plan = planBump({version: '2.7.1', pkgVersion: '2.7.0', gradle, pbx});
  expect(plan.error).toBeUndefined();
  expect(plan.gradle).toBe('versionCode 23\n        versionName "2.7.1"');
  expect(plan.pbx).toBe(
    'CURRENT_PROJECT_VERSION = 23;\nMARKETING_VERSION = 2.7.1;\nCURRENT_PROJECT_VERSION = 23;\nMARKETING_VERSION = 2.7.1;',
  );
});

it('refuses a re-run with the same version, a lower one, and a non-version', () => {
  expect(planBump({version: '2.7.0', pkgVersion: '2.7.0', gradle, pbx}).error).toMatch(/not higher/);
  expect(planBump({version: '2.6.9', pkgVersion: '2.7.0', gradle, pbx}).error).toMatch(/not higher/);
  expect(planBump({version: 'v2.8', pkgVersion: '2.7.0', gradle, pbx}).error).toMatch(/not a version/);
  expect(planBump({version: '2.8', pkgVersion: '2.7.0', gradle, pbx}).error).toBeUndefined();
});

it('refuses when a version field is missing or the iOS targets disagree', () => {
  expect(planBump({version: '2.8', pkgVersion: '2.7.0', gradle: 'versionCode 22', pbx}).error).toMatch(/not found/);
  expect(
    planBump({
      version: '2.8',
      pkgVersion: '2.7.0',
      gradle,
      pbx: pbx.replace('CURRENT_PROJECT_VERSION = 22;', 'CURRENT_PROJECT_VERSION = 21;'),
    }).error,
  ).toMatch(/disagree/);
});
