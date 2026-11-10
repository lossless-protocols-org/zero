/**
 * The Swift the app and its widget share (ios/ZeroShared) is compiled three
 * ways: as the ZeroShared package (its tests), and as a member of the app
 * target and of the widget target (deliberately; docs/NATIVE.md, audit
 * 2026-11-08 §6.1). Three lists of one set of files can drift: a file added
 * to one and not the others builds fine until a target misses a type. This
 * keeps the lists identical.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fromRoot} from '../harness/paths';

const sharedDir = fromRoot('ios', 'ZeroShared');
const swiftFiles = fs
  .readdirSync(sharedDir)
  .filter(file => file.endsWith('.swift') && file !== 'Package.swift')
  .sort();

const packageSources = (): string[] => {
  const manifest = fs.readFileSync(path.join(sharedDir, 'Package.swift'), 'utf8');
  const list = /sources:\s*\[([^\]]*)\]/.exec(manifest)?.[1] ?? '';
  return [...list.matchAll(/"([^"]+)"/g)].map(([, file]) => file ?? '').sort();
};

/** How many targets compile `file` (its "in Sources" build files in the Xcode project). */
const targetsCompiling = (file: string): number => {
  const project = fs.readFileSync(fromRoot('ios', 'zero.xcodeproj', 'project.pbxproj'), 'utf8');
  return (
    project.match(new RegExp(`/\\* ${file.replace('.', '\\.')} in Sources \\*/ = \\{isa = PBXBuildFile`, 'g'))
      ?.length ?? 0
  );
};

it('the package builds every shared Swift file', () => {
  expect(packageSources()).toEqual(swiftFiles);
});

it.each(swiftFiles)('%s is compiled by both the app and the widget', file => {
  expect(targetsCompiling(file)).toBe(2);
});
