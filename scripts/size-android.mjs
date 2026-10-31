#!/usr/bin/env node
/**
 * Prints the sizes RELEASE_QA.md step 1 records (M26, v2.7.1): the Hermes
 * bundle inside the APK, the APK, and the AAB — whichever have been built.
 * Run after `bun run android:release:apk` and/or `bun run android:release`.
 *
 * For what is inside the bundle, use source-map-explorer on the map Gradle
 * writes next to it (android/app/build/generated/sourcemaps/react/release/).
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputs = path.join(root, 'android/app/build/outputs');
const apk = path.join(outputs, 'apk/release/app-release.apk');
const aab = path.join(outputs, 'bundle/release/app-release.aab');

const sizeOf = file => (fs.existsSync(file) ? fs.statSync(file).size : null);

/** The APK's zip index; exits with the reason when unzip cannot read it (not "not built"). */
const zipIndex = file => {
  const listing = spawnSync('unzip', ['-l', file], {encoding: 'utf8'});
  if (listing.error || listing.status !== 0) {
    console.error(`size-android: unzip could not read ${file}: ${listing.error?.message ?? listing.stderr}`);
    process.exit(1);
  }
  return listing.stdout;
};

/** Uncompressed size of the Hermes bundle inside the APK, read from the zip index. */
const bundleInApk = file => {
  if (!fs.existsSync(file)) {
    return null;
  }
  const line = zipIndex(file)
    .split('\n')
    .find(l => l.trim().endsWith('assets/index.android.bundle'));
  return line ? Number(line.trim().split(/\s+/)[0]) : null;
};

/** ABIs the APK carries native libraries for. */
const abisInApk = file => {
  if (!fs.existsSync(file)) {
    return [];
  }
  const listing = {stdout: zipIndex(file)};
  return [...new Set([...listing.stdout.matchAll(/\blib\/([^/]+)\//g)].map(m => m[1]))].sort();
};

const rows = [
  ['Hermes bundle (in APK)', bundleInApk(apk)],
  ['APK', sizeOf(apk)],
  ['AAB', sizeOf(aab)],
];
for (const [label, bytes] of rows) {
  console.log(`${label.padEnd(24)} ${bytes === null ? 'not built' : `${bytes.toLocaleString('en-US')} B`}`);
}
const abis = abisInApk(apk);
if (abis.length > 0) {
  console.log(`${'APK ABIs'.padEnd(24)} ${abis.join(', ')}`);
}
