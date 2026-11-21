/**
 * The App Store code (ios/ZeroBilling) is compiled twice: by the zero app, and
 * by the small host app its tests run in (docs/NATIVE.md; StoreKit Test needs
 * a real app around it). Two lists of one set of files can drift: a file the
 * app compiles and the host does not is App Store code with no test at all.
 * This keeps the lists identical, as sharedSwiftSources.test.ts does for the
 * widget's shared Swift.
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';

const billingDir = fromRoot('ios', 'ZeroBilling');
const swiftFiles = fs
  .readdirSync(billingDir)
  .filter(file => file.endsWith('.swift'))
  .sort();
const testFiles = fs
  .readdirSync(fromRoot('ios', 'ZeroBilling', 'Tests'))
  .filter(file => file.endsWith('.swift'))
  .sort();

const app = fs.readFileSync(fromRoot('ios', 'zero.xcodeproj', 'project.pbxproj'), 'utf8');
const host = fs.readFileSync(fromRoot('ios', 'ZeroBilling', 'ZeroBillingHost.xcodeproj', 'project.pbxproj'), 'utf8');

/** How many targets of `project` compile `file`. */
const compiledBy = (project: string, file: string): number =>
  project.match(new RegExp(`/\\* ${file.replace('.', '\\.')} in Sources \\*/ = \\{isa = PBXBuildFile`, 'g'))?.length ??
  0;

it('finds the billing sources and their tests', () => {
  expect(swiftFiles.length).toBeGreaterThan(0);
  expect(testFiles.length).toBeGreaterThan(0);
});

it.each(swiftFiles)('%s is compiled by the zero app, once, and by the test host', file => {
  expect(compiledBy(app, file)).toBe(1);
  expect(compiledBy(host, file)).toBe(1);
});

it.each(testFiles)('%s runs in the test host and is not in the app', file => {
  expect(compiledBy(host, file)).toBe(1);
  expect(compiledBy(app, file)).toBe(0);
});

it('the app also compiles the module that calls them, and knows the local test catalogue', () => {
  expect(compiledBy(app, 'ZeroBilling.mm')).toBe(1);
  expect(app).toContain('zero.storekit');
  // A reference only: the test catalogue is never copied into the app.
  expect(app).not.toMatch(/zero\.storekit in Resources/);
});
