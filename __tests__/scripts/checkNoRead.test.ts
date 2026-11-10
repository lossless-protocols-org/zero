/**
 * The no-read gate is an allow list (audit 2026-11-08 §7.4): a clean tree
 * passes, and anything new (a permission, an uncapped storage permission, a
 * usage description, an entitlement, a dependency) fails until it is reviewed.
 * Each case builds a tiny project tree and runs the real script against it.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fromRoot} from '../harness/paths';

const SCRIPT = fromRoot('scripts', 'check-no-read.mjs');

interface Tree {
  dependencies?: Record<string, string>;
  appManifest?: string;
  depManifests?: Record<string, string>;
  infoPlistKeys?: string[];
  entitlements?: string[];
}

const manifest = (...permissions: string[]): string =>
  `<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n${permissions.join('\n')}\n</manifest>`;
const permission = (name: string, maxSdk?: number): string =>
  `<uses-permission android:name="android.permission.${name}"${maxSdk === undefined ? '' : ` android:maxSdkVersion="${maxSdk}"`} />`;

const CLEAN_APP = manifest(permission('READ_EXTERNAL_STORAGE', 32), permission('WRITE_EXTERNAL_STORAGE', 32));

const run = (tree: Tree): {status: number | null; output: string} => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-read-'));
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
    fs.writeFileSync(path.join(dir, file), text);
  };
  write(
    'package.json',
    JSON.stringify({dependencies: tree.dependencies ?? {react: '19.0.0', 'react-native-fs': '2.0.0'}}),
  );
  write('android/app/src/main/AndroidManifest.xml', tree.appManifest ?? CLEAN_APP);
  write('android/app/src/debug/AndroidManifest.xml', manifest(permission('INTERNET'))); // Metro; never ships
  for (const [dep, xml] of Object.entries(tree.depManifests ?? {})) {
    write(`node_modules/${dep}/android/src/main/AndroidManifest.xml`, xml);
  }
  const keys = (tree.infoPlistKeys ?? []).map(key => `<key>${key}</key><string>x</string>`).join('');
  write('ios/zero/Info.plist', `<plist><dict><key>CFBundleName</key><string>zero</string>${keys}</dict></plist>`);
  const entitlements = (tree.entitlements ?? ['com.apple.security.application-groups'])
    .map(key => `<key>${key}</key><array/>`)
    .join('');
  write('ios/zero/zero.entitlements', `<plist><dict>${entitlements}</dict></plist>`);
  const result = spawnSync('node', [SCRIPT], {encoding: 'utf8', env: {...process.env, ZERO_NO_READ_ROOT: dir}});
  fs.rmSync(dir, {recursive: true, force: true});
  return {status: result.status, output: `${result.stdout}${result.stderr}`};
};

it('passes a clean tree (the debug manifest’s INTERNET never ships)', () => {
  const result = run({depManifests: {'react-native-fs': manifest(permission('WRITE_EXTERNAL_STORAGE'))}});
  expect(result.output).toContain('check-no-read: clean');
  expect(result.status).toBe(0);
});

it.each([
  ['a permission nobody listed', {appManifest: manifest(permission('POST_NOTIFICATIONS'))}, 'POST_NOTIFICATIONS'],
  ['the network', {appManifest: manifest(permission('INTERNET'))}, 'INTERNET'],
  [
    'a dependency asking for calendars',
    {depManifests: {react: manifest(permission('READ_CALENDAR'))}},
    'READ_CALENDAR',
  ],
  ['storage on every API level', {appManifest: manifest(permission('WRITE_EXTERNAL_STORAGE'))}, 'every API level'],
  ['storage past API 32', {appManifest: manifest(permission('READ_EXTERNAL_STORAGE', 33))}, 'API 33'],
  ['a usage description', {infoPlistKeys: ['NSBluetoothAlwaysUsageDescription']}, 'NSBluetoothAlwaysUsageDescription'],
  ['an entitlement', {entitlements: ['com.apple.developer.healthkit']}, 'com.apple.developer.healthkit'],
  ['an unreviewed dependency', {dependencies: {react: '19.0.0', 'left-pad': '1.0.0'}}, 'left-pad'],
])('fails on %s', (_name, tree, mention) => {
  const result = run(tree as Tree); // each row is a partial Tree literal
  expect(result.status).toBe(1);
  expect(result.output).toContain(mention);
});

it('judges a dependency’s uncapped storage permission by the app’s cap, as the manifest merger does', () => {
  const uncapped = {depManifests: {'react-native-fs': manifest(permission('WRITE_EXTERNAL_STORAGE'))}};
  expect(run(uncapped).status).toBe(0);
  const appWithout = run({...uncapped, appManifest: manifest()});
  expect(appWithout.status).toBe(1);
  expect(appWithout.output).toContain('every API level');
});
