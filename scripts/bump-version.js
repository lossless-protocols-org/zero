#!/usr/bin/env node

/**
 * Bumps the app version across package.json, Android, and iOS.
 *
 * Usage: bun run version:set 2.7.1 [--dry-run]
 *
 * - Sets the version string in package.json, src/platform/getVersion.ts
 *   (what the app reads; importing package.json bundled the whole file),
 *   build.gradle, and project.pbxproj
 * - Increments the build number (versionCode / CURRENT_PROJECT_VERSION) once
 *
 * Refuses (M25, v2.7.1): a version that is not `x.y` / `x.y.z`, one that is
 * not higher than the current one (re-running used to increment versionCode
 * twice), and a dirty working tree (release numbers must come from a known
 * state). `--dry-run` prints the plan and writes nothing.
 */

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const VERSION_RE = /^\d+\.\d+(\.\d+)?$/;

/** -1, 0 or 1; missing parts count as 0, so 2.7 === 2.7.0. */
const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) {
      return d < 0 ? -1 : 1;
    }
  }
  return 0;
};

/** The edits for one bump, or an `error`. Pure: reads and writes nothing. */
const APP_VERSION_RE = /const APP_VERSION = '[^']*';/;

const planBump = ({version, pkgVersion, gradle, pbx, appVersionSource}) => {
  if (!VERSION_RE.test(version || '')) {
    return {error: `"${version}" is not a version (expected x.y or x.y.z)`};
  }
  if (compareVersions(version, pkgVersion) <= 0) {
    return {error: `${version} is not higher than the current ${pkgVersion}`};
  }
  const codeMatch = gradle.match(/versionCode\s+(\d+)/);
  const buildMatch = pbx.match(/CURRENT_PROJECT_VERSION\s*=\s*(\d+)/);
  if (!codeMatch || !buildMatch || !/versionName\s+"[^"]*"/.test(gradle) || !/MARKETING_VERSION\s*=/.test(pbx)) {
    return {error: 'versionCode, versionName, CURRENT_PROJECT_VERSION or MARKETING_VERSION not found'};
  }
  if (!APP_VERSION_RE.test(appVersionSource)) {
    return {error: "src/platform/getVersion.ts has no `const APP_VERSION = '…';`"};
  }
  // Every iOS target gets the same new build number; refuse if they disagree now.
  const builds = new Set([...pbx.matchAll(/CURRENT_PROJECT_VERSION\s*=\s*(\d+);/g)].map(m => m[1]));
  if (builds.size > 1) {
    return {error: `the iOS targets disagree on CURRENT_PROJECT_VERSION (${[...builds].join(', ')})`};
  }
  const oldCode = Number(codeMatch[1]);
  const oldBuild = Number(buildMatch[1]);
  return {
    oldCode,
    newCode: oldCode + 1,
    oldBuild,
    newBuild: oldBuild + 1,
    gradle: gradle
      .replace(/versionCode\s+\d+/, `versionCode ${oldCode + 1}`)
      .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`),
    pbx: pbx
      .replace(/MARKETING_VERSION\s*=\s*[^;]+;/g, `MARKETING_VERSION = ${version};`)
      .replace(/CURRENT_PROJECT_VERSION\s*=\s*\d+;/g, `CURRENT_PROJECT_VERSION = ${oldBuild + 1};`),
    appVersionSource: appVersionSource.replace(APP_VERSION_RE, `const APP_VERSION = '${version}';`),
  };
};

const main = () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const version = args.find(a => !a.startsWith('--'));
  const root = path.resolve(__dirname, '..');

  if (!dryRun) {
    const dirty = execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim();
    if (dirty) {
      console.error('Refusing: the working tree has uncommitted changes. Commit or stash first, or use --dry-run.');
      process.exit(1);
    }
  }

  const pkgPath = path.join(root, 'package.json');
  const gradlePath = path.join(root, 'android/app/build.gradle');
  const pbxPath = path.join(root, 'ios/zero.xcodeproj/project.pbxproj');
  const appVersionPath = path.join(root, 'src/platform/getVersion.ts');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const plan = planBump({
    version,
    pkgVersion: pkg.version,
    gradle: fs.readFileSync(gradlePath, 'utf8'),
    pbx: fs.readFileSync(pbxPath, 'utf8'),
    appVersionSource: fs.readFileSync(appVersionPath, 'utf8'),
  });
  if (plan.error) {
    console.error(`Refusing: ${plan.error}. Usage: bun run version:set <x.y.z> [--dry-run]`);
    process.exit(1);
  }

  console.log(`package.json and getVersion.ts: ${pkg.version} → ${version}`);
  console.log(`Android: versionName "${version}", versionCode ${plan.oldCode} → ${plan.newCode}`);
  console.log(`iOS: MARKETING_VERSION ${version}, CURRENT_PROJECT_VERSION ${plan.oldBuild} → ${plan.newBuild}`);
  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  fs.writeFileSync(gradlePath, plan.gradle, 'utf8');
  fs.writeFileSync(pbxPath, plan.pbx, 'utf8');
  fs.writeFileSync(appVersionPath, plan.appVersionSource, 'utf8');
  console.log('\nDone!');
};

if (require.main === module) {
  main();
}

module.exports = {planBump, compareVersions};
