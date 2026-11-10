/**
 * The static launcher shortcuts (long-press zero's icon) open the build they
 * belong to. Their targetPackage must be a literal — the launcher does not
 * resolve a resource reference there (found on the Moto, 2026-11-09: the
 * shortcut started "@2131755039" and failed) — so each build has its own copy
 * and this pins each copy to that build's application id (build.gradle).
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';

const gradle = fs.readFileSync(fromRoot('android', 'app', 'build.gradle'), 'utf8');
const applicationId = /applicationId "([^"]+)"/.exec(gradle)?.[1];
const qaSuffix = /def qaIdSuffix = "([^"]+)"/.exec(gradle)?.[1];

const targetsOf = (sourceSet: string): string[] => {
  const xml = fs.readFileSync(fromRoot('android', 'app', 'src', sourceSet, 'res', 'xml', 'shortcuts.xml'), 'utf8');
  return [...xml.matchAll(/android:targetPackage="([^"]+)"/g)].map(([, value]) => value ?? '');
};

it('reads the ids from build.gradle', () => {
  expect(applicationId).toBe('com.anotherwhy.zero');
  expect(qaSuffix).toBe('.qa');
});

it.each([
  ['main', () => applicationId],
  ['qa', () => `${applicationId}${qaSuffix}`],
])('the %s build opens itself, by a literal package', (sourceSet, id) => {
  const targets = targetsOf(sourceSet);
  expect(targets.length).toBeGreaterThan(0);
  expect(new Set(targets)).toEqual(new Set([id()]));
});
