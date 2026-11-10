/**
 * The one test tree stays a mirror of src/ (audit 2026-11-08 §7.2, §12.2 rule
 * 2; __tests__/README.md). A separate tree is safe against the drift that
 * colocation prevents only if this holds:
 *
 * - every file under __tests__/unit/ and __tests__/component/ names a module
 *   that exists at the mirrored src/ path (`<module>.test.ts`, or
 *   `<module>.<aspect>.test.ts`): moving or deleting a module without its
 *   test fails here;
 * - the number of src/ modules with exported logic and no mirrored test only
 *   goes down (a ratchet, like coverage): a new module comes with its test.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fromRoot} from '../harness/paths';

const MIRRORED_KINDS = ['unit', 'component'];
const EXTENSIONS = ['.ts', '.tsx'];

/**
 * Modules with exported logic and no test at their mirrored path, counted on
 * 2026-11-09. Lower it when you add one of their tests; never raise it.
 */
const UNTESTED_CEILING = 115;

const walk = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      })
    : [];

/** The src/ module a mirrored test names, or undefined when there is none. */
const moduleOf = (kind: string, testFile: string): string | undefined => {
  const rel = path.relative(fromRoot('__tests__', kind), testFile);
  const dir = path.dirname(rel);
  const [moduleName] = path.basename(rel).split('.'); // <module>[.<aspect>].test.ts(x)
  const base = fromRoot('src', dir, moduleName ?? '');
  return [...EXTENSIONS.map(ext => base + ext), ...EXTENSIONS.map(ext => path.join(base, `index${ext}`))].find(
    candidate => fs.existsSync(candidate),
  );
};

const testsByKind = MIRRORED_KINDS.map(kind => ({
  kind,
  files: walk(fromRoot('__tests__', kind)).filter(file => /\.test\.tsx?$/.test(file)),
}));

it('every unit and component test mirrors a module that exists', () => {
  const orphans = testsByKind.flatMap(({kind, files}) =>
    files.filter(file => moduleOf(kind, file) === undefined).map(file => path.relative(fromRoot(), file)),
  );
  expect(orphans).toEqual([]);
});

it('the modules with logic and no test of their own only get fewer', () => {
  const tested = new Set(testsByKind.flatMap(({kind, files}) => files.map(file => moduleOf(kind, file))));
  const withLogic = walk(fromRoot('src')).filter(
    file =>
      /\.tsx?$/.test(file) &&
      !file.endsWith('.d.ts') &&
      /^export (const \w+ = (async )?\(|function |class )/m.test(fs.readFileSync(file, 'utf8')),
  );
  const untested = withLogic.filter(file => !tested.has(file));
  expect(untested.length).toBeLessThanOrEqual(UNTESTED_CEILING);
});
