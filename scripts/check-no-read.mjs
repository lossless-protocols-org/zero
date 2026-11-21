#!/usr/bin/env node
/**
 * The no-read gate (2.8, design §14). zero never reads SMS, call logs,
 * contacts, notifications, other apps or the clipboard, and has no network.
 * This proves it from the files the stores read, not from intentions:
 *
 *   source (default, CI): every Android manifest that ships (the app's, minus
 *     src/debug, plus every dependency's, since the build merges them), the
 *     iOS Info.plists and .entitlements, and the dependency list.
 *   --flavour <play|foss> --apk <file> (CI + release gate): the permissions of
 *     the BUILT apk, read with aapt2 / aapt from the Android SDK, i.e. the
 *     merged manifest Play shows, including what transitive Gradle libraries
 *     add. Each flavour is judged against its own allow list.
 *
 * Everything is an ALLOW list (audit 2026-11-08 §7.4): a permission, usage
 * description, entitlement or runtime dependency not named below fails, so
 * something new can never pass just because nobody thought to forbid it.
 * Adding to a list is a decision: write down why next to it.
 *
 * Node only, no dependencies. Exits 1 with every finding listed.
 *
 *   node scripts/check-no-read.mjs
 *   node scripts/check-no-read.mjs --flavour play --apk android/app/build/outputs/apk/play/release/app-play-release.apk
 *
 * ZERO_NO_READ_ROOT points the source check at another tree (its tests).
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = process.env.ZERO_NO_READ_ROOT
  ? path.resolve(process.env.ZERO_NO_READ_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The only Android permissions zero may hold, each with why and, where it
 * applies, the highest API level it may be requested on (maxSdkVersion).
 */
const ALLOWED_ANDROID = {
  // Export to Downloads and restore a backup on Android 12 and older; from 13
  // on the document picker and MediaStore need no permission at all.
  'android.permission.READ_EXTERNAL_STORAGE': {maxSdk: 32},
  'android.permission.WRITE_EXTERNAL_STORAGE': {maxSdk: 32},
  // 3.0 (plan P9): reminders for recurring entries are local notifications. Posting one needs
  // this on Android 13+, asked for only when a rule with a reminder is first saved. Reads nothing.
  'android.permission.POST_NOTIFICATIONS': {},
  // 3.0 (plan P9): alarms are cleared by a restart; this lets zero's own receiver arm its stored
  // reminders again (reminders/RearmReceiver.kt). Reads nothing; it only hears that the phone started.
  'android.permission.RECEIVE_BOOT_COMPLETED': {},
};

/**
 * What one flavour's built APK may hold on top of ALLOWED_ANDROID (3.0 plan, P2 and P5).
 * `play` holds Google Play Billing's own permission and nothing else: the billing library
 * talks to the Play Store app over IPC, and the two libraries that would add INTERNET and
 * ACCESS_NETWORK_STATE (Google's usage uploader) are left out of the build
 * (android/app/build.gradle). `foss` stays empty for good: it is the build that proves
 * zero needs no store code and no network.
 */
const ALLOWED_BY_FLAVOUR = {
  play: {'com.android.vending.BILLING': {}},
  foss: {},
};

/**
 * Code a flavour's APK must not contain, by the package of the classes it defines (a class
 * the manifest names keeps its name through R8, so the uploader's services and the billing
 * library's activities cannot hide), each with why.
 */
const FORBIDDEN_CODE_BY_FLAVOUR = {
  play: {
    'com/google/android/datatransport/runtime': "Google's usage uploader (transport-runtime) is back in the build",
    'com/google/android/datatransport/cct': "Google's usage uploader (transport-backend-cct) is back in the build",
  },
  foss: {
    'com/android/billingclient': 'the foss build links Google Play Billing',
    'com/google/android/gms': 'the foss build links Google Play services',
    'com/google/android/datatransport': "the foss build links Google's usage uploader",
  },
};

/** AndroidX declares this for the app's own non-exported receivers; it guards zero's own broadcasts. */
const OWN_RECEIVER_PERMISSION = '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION';

/** Entitlements zero may hold: the App Group the widget and Siri share with the app. Nothing else. */
const ALLOWED_ENTITLEMENTS = ['com.apple.security.application-groups'];

/**
 * Info.plist usage descriptions zero may declare: none. Any key ending in
 * UsageDescription (contacts, photos, location, Face ID, Bluetooth, motion,
 * health…) means asking to read something personal.
 */
const ALLOWED_USAGE_DESCRIPTIONS = [];

/**
 * Runtime dependencies, reviewed for what they can read. A new one fails here
 * until someone has looked at its permissions, native code and network use and
 * added it with a reason (the owner's rule: ask before adding a dependency).
 */
const ALLOWED_DEPENDENCIES = [
  '@babel/runtime',
  '@nozbe/simdjson',
  '@nozbe/watermelondb', // local SQLite
  '@react-native-community/datetimepicker',
  '@react-native-documents/picker', // the system picker: reads only the file the user picks
  '@react-navigation/bottom-tabs',
  '@react-navigation/native',
  '@react-navigation/native-stack',
  '@reduxjs/toolkit',
  '@shopify/flash-list',
  'dayjs',
  'i18next',
  'lucide-react-native',
  'nanoid',
  'react',
  'react-i18next',
  'react-native',
  'react-native-actions-sheet',
  'react-native-fs', // writes exports; its storage permission is capped at API 32 by the app manifest
  'react-native-gesture-handler',
  'react-native-get-random-values',
  'react-native-localize', // the device language and region, no personal data
  'react-native-mmkv', // local preferences
  'react-native-nitro-modules',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-svg',
  'react-native-worklets',
  'react-redux',
  'redux',
  'zod',
];

const findings = [];
const rel = file => path.relative(root, file);

/**
 * Checks requested permissions against ALLOWED_ANDROID. `declared` maps each
 * permission to the maxSdkVersion it is requested with (undefined = every
 * API level); `appPackage` is the app's id for its own receiver permission;
 * `allowList` is ALLOWED_ANDROID, or a flavour's own list for a built APK.
 */
const checkAndroidPermissions = (declared, where, appPackage, allowList = ALLOWED_ANDROID) => {
  for (const [permission, maxSdk] of declared) {
    if (appPackage && permission === `${appPackage}${OWN_RECEIVER_PERMISSION}`) {
      continue;
    }
    const allowed = allowList[permission];
    if (!allowed) {
      findings.push(`${where}: requests ${permission}, which is not on the allow list`);
    } else if (allowed.maxSdk !== undefined && (maxSdk === undefined || maxSdk > allowed.maxSdk)) {
      findings.push(
        `${where}: requests ${permission} up to ${maxSdk === undefined ? 'every API level' : `API ${maxSdk}`}; allowed only up to API ${allowed.maxSdk}`,
      );
    }
  }
};

/** uses-permission entries of a manifest as name → maxSdkVersion, skipping ones removed with tools:node="remove". */
const manifestPermissions = xml => {
  const out = new Map();
  for (const m of xml.matchAll(/<uses-permission(?:-sdk-23)?\b([^>]*)>/g)) {
    const attrs = m[1] ?? '';
    if (/tools:node\s*=\s*"remove"/.test(attrs)) {
      continue;
    }
    const name = /android:name\s*=\s*"([^"]+)"/.exec(attrs)?.[1];
    const max = /android:maxSdkVersion\s*=\s*"(\d+)"/.exec(attrs)?.[1];
    if (name !== undefined) {
      out.set(name, max === undefined ? undefined : Number(max));
    }
  }
  return out;
};

/** Every AndroidManifest.xml under a folder, skipping build output and test/debug source sets. */
const manifestsUnder = dir => {
  const out = [];
  const walk = d => {
    let entries;
    try {
      entries = fs.readdirSync(d, {withFileTypes: true});
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (['build', '.gradle', 'debug', 'test', 'androidTest', 'example', 'examples'].includes(e.name)) {
          continue;
        }
        walk(full);
      } else if (e.name === 'AndroidManifest.xml') {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
};

const checkSource = () => {
  // The app's manifests (main and any flavour; debug is Metro's and never ships).
  const appDeclared = new Map();
  for (const file of manifestsUnder(path.join(root, 'android/app/src'))) {
    const declared = manifestPermissions(fs.readFileSync(file, 'utf8'));
    declared.forEach((max, name) => appDeclared.set(name, max));
    checkAndroidPermissions(declared, rel(file), undefined);
  }

  // Dependencies: their manifests are merged into the release build. Where the
  // app declares the same permission, the app's declaration (and its cap) is
  // what the merged manifest keeps, so that is what is judged.
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!ALLOWED_DEPENDENCIES.includes(dep)) {
      findings.push(
        `package.json: depends on ${dep}, which is not on the allow list (review what it reads, then add it with a reason)`,
      );
    }
    const androidDir = path.join(root, 'node_modules', dep, 'android');
    for (const file of manifestsUnder(androidDir)) {
      const declared = manifestPermissions(fs.readFileSync(file, 'utf8'));
      const effective = new Map(
        [...declared].map(([name, max]) => [name, appDeclared.has(name) ? appDeclared.get(name) : max]),
      );
      checkAndroidPermissions(effective, rel(file), undefined);
    }
  }

  // iOS: usage descriptions and entitlements of every target.
  const iosDir = path.join(root, 'ios');
  let targets = [];
  try {
    targets = fs.readdirSync(iosDir, {withFileTypes: true});
  } catch {
    targets = [];
  }
  for (const target of targets) {
    if (!target.isDirectory() || target.name === 'Pods' || target.name === 'build') {
      continue;
    }
    const dir = path.join(iosDir, target.name);
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (name === 'Info.plist') {
        const xml = fs.readFileSync(file, 'utf8');
        for (const [, key] of xml.matchAll(/<key>(\w*UsageDescription)<\/key>/g)) {
          if (key !== undefined && !ALLOWED_USAGE_DESCRIPTIONS.includes(key)) {
            findings.push(`${rel(file)}: declares ${key}, which is not on the allow list`);
          }
        }
      } else if (name.endsWith('.entitlements')) {
        const xml = fs.readFileSync(file, 'utf8');
        // Top-level keys only: values of the allowed keys are <string>s, never <key>s.
        for (const [, key] of xml.matchAll(/<key>([^<]+)<\/key>/g)) {
          if (key !== undefined && !ALLOWED_ENTITLEMENTS.includes(key)) {
            findings.push(`${rel(file)}: has entitlement ${key}`);
          }
        }
      }
    }
  }
};

/** aapt2 (or aapt) from the newest build-tools of the SDK. */
const findAapt = () => {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!sdk) {
    return undefined;
  }
  const tools = path.join(sdk, 'build-tools');
  let versions = [];
  try {
    versions = fs.readdirSync(tools).sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));
  } catch {
    return undefined;
  }
  for (const version of versions.reverse()) {
    for (const tool of ['aapt2', 'aapt']) {
      const candidate = path.join(tools, version, tool);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
};

const checkApk = (apk, flavour) => {
  // Gradle names an APK app-<flavour>-<type>.apk: catch a play file judged as foss, or the reverse.
  const named = /^app-([a-z]+)-/.exec(path.basename(apk))?.[1];
  if (named !== undefined && named in ALLOWED_BY_FLAVOUR && named !== flavour) {
    console.error(`check-no-read: ${path.basename(apk)} is a ${named} build, but --flavour says ${flavour}`);
    process.exit(1);
  }
  if (!fs.existsSync(apk)) {
    console.error(`check-no-read: no such file ${apk}`);
    process.exit(1);
  }
  const aapt = findAapt();
  if (!aapt) {
    console.error('check-no-read: aapt2/aapt not found (set ANDROID_HOME); the artifact was NOT checked.');
    process.exit(1);
  }
  const out = execFileSync(aapt, ['dump', 'permissions', apk], {encoding: 'utf8'});
  const appPackage = /^package: (\S+)/m.exec(out)?.[1];
  const declared = new Map();
  for (const m of out.matchAll(/uses-permission(?:-sdk-23)?: name='([^']+)'([^\n]*)/g)) {
    const max = /maxSdkVersion='(\d+)'/.exec(m[2] ?? '')?.[1];
    if (m[1] !== undefined) {
      declared.set(m[1], max === undefined ? undefined : Number(max));
    }
  }
  checkAndroidPermissions(declared, path.basename(apk), appPackage, {
    ...ALLOWED_ANDROID,
    ...ALLOWED_BY_FLAVOUR[flavour],
  });
  console.log(
    `check-no-read: ${path.basename(apk)} (${flavour}, ${appPackage ?? 'unknown package'}) requests ${declared.size} permission(s):`,
  );
  for (const [permission, max] of declared) {
    console.log(`  ${permission}${max === undefined ? '' : ` (up to API ${max})`}`);
  }
};

/**
 * The names of the classes a run of dex files defines, as "com/example/Name". Defined, not
 * merely mentioned: the billing library still refers to the uploader classes that were left
 * out, and a reference is not code. Reads the dex format directly (header, string ids, type
 * ids, class defs), so it needs no SDK tool.
 */
const definedClasses = dex => {
  const names = [];
  let start = 0;
  while (start + 0x70 <= dex.length && dex.toString('latin1', start, start + 4) === 'dex\n') {
    const fileSize = dex.readUInt32LE(start + 0x20);
    const stringIdsOff = dex.readUInt32LE(start + 0x3c);
    const typeIdsOff = dex.readUInt32LE(start + 0x44);
    const classDefsSize = dex.readUInt32LE(start + 0x60);
    const classDefsOff = dex.readUInt32LE(start + 0x64);
    for (let i = 0; i < classDefsSize; i += 1) {
      const typeIndex = dex.readUInt32LE(start + classDefsOff + i * 32);
      const stringIndex = dex.readUInt32LE(start + typeIdsOff + typeIndex * 4);
      let at = start + dex.readUInt32LE(start + stringIdsOff + stringIndex * 4);
      // Skip the length (uleb128); the descriptor follows, ending in a zero byte. Class names are ASCII.
      while ((dex[at] ?? 0) >= 0x80) {
        at += 1;
      }
      at += 1;
      const descriptor = dex.toString('latin1', at, dex.indexOf(0, at));
      names.push(descriptor.replace(/^L|;$/g, ''));
    }
    if (fileSize === 0) {
      break;
    }
    start += fileSize;
  }
  if (start !== dex.length) {
    // Bytes that are not a dex file: part of the code went unread, so nothing may be concluded.
    console.error(`check-no-read: the dex data could not be read to its end (${start} of ${dex.length} bytes).`);
    process.exit(1);
  }
  return names;
};

/** Fails for code the flavour must not contain: classes its dex files define, and components its manifest names. */
const checkApkCode = (apk, flavour) => {
  const aapt = findAapt();
  // Every dex file, one after another. A release APK holds a few megabytes of them.
  const dex = execFileSync('unzip', ['-p', apk, 'classes*.dex'], {maxBuffer: 1024 * 1024 * 1024});
  const classes = definedClasses(dex);
  if (classes.length === 0) {
    console.error(`check-no-read: no class found in ${path.basename(apk)}; its code was NOT checked.`);
    process.exit(1);
  }
  const manifest = execFileSync(aapt, ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml'], {encoding: 'utf8'});
  for (const [prefix, why] of Object.entries(FORBIDDEN_CODE_BY_FLAVOUR[flavour])) {
    const dotted = prefix.replaceAll('/', '.');
    if (classes.some(name => name.startsWith(`${prefix}/`)) || manifest.includes(dotted)) {
      findings.push(`${path.basename(apk)}: contains ${dotted}: ${why}`);
    }
  }
  console.log(`check-no-read: ${path.basename(apk)} (${flavour}) code checked (${classes.length} classes)`);
};

const apkFlag = process.argv.indexOf('--apk');
if (apkFlag >= 0) {
  const apk = process.argv[apkFlag + 1];
  if (!apk) {
    console.error('check-no-read: --apk needs a path');
    process.exit(1);
  }
  const flavourFlag = process.argv.indexOf('--flavour');
  const flavour = flavourFlag >= 0 ? process.argv[flavourFlag + 1] : undefined;
  if (flavour === undefined || !Object.hasOwn(ALLOWED_BY_FLAVOUR, flavour)) {
    console.error(
      `check-no-read: --apk needs --flavour <${Object.keys(ALLOWED_BY_FLAVOUR).join('|')}>, so the build is judged against its own allow list`,
    );
    process.exit(1);
  }
  checkApk(path.resolve(apk), flavour);
  checkApkCode(path.resolve(apk), flavour);
} else {
  checkSource();
}

if (findings.length > 0) {
  console.error('check-no-read: zero must not read what it promises not to read:');
  for (const finding of findings) {
    console.error(`  ${finding}`);
  }
  process.exit(1);
}
console.log('check-no-read: clean');
