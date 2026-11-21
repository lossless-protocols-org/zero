/**
 * Store code lives in the `play` flavour only (3.0 plan P2, docs/NATIVE.md).
 * The `foss` build is the proof that zero needs no store library and no
 * network; that proof ends the day a Google Play import lands in a source set
 * every build compiles, a billing dependency is declared for every flavour, or
 * an npm package brings its own (autolinking adds a package to every variant,
 * so a store SDK from npm can never be play-only). Checked on the real tree and
 * on a fixture that breaks each rule once.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {REPO_ROOT} from '../harness/paths';

/** Google Play's client libraries: billing, Play services, the Play Core family, the store's own package. */
const STORE_CODE = /\bcom\.android\.billingclient\b|\bcom\.google\.android\.(gms|play)\b|\bcom\.android\.vending\b/;

/** A dependency line may name a store library only when it is scoped to the play flavour. */
const STORE_DEPENDENCY = /com\.android\.billingclient|com\.google\.android\.(gms|play)/;

const sourcesUnder = (dir: string): string[] => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, {withFileTypes: true});
  } catch {
    return [];
  }
  return entries.flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Build output is not source: Lint caches there list every Google artefact by name.
      return ['build', '.gradle', '.cxx'].includes(entry.name) ? [] : sourcesUnder(full);
    }
    return /\.(kt|java|xml|gradle|kts|toml)$/.test(entry.name) ? [full] : [];
  });
};

/** Lines of a build file with comments removed, numbered from 1. */
const codeLines = (file: string): Array<{code: string; line: number}> =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((text, i) => ({code: text.replace(/\/\/.*$/, '').trim(), line: i + 1}));

/** Every place store code appears outside `play`, as `file: reason`. */
const findings = (root: string): string[] => {
  const app = path.join(root, 'android', 'app');
  const found: string[] = [];
  const sourceSets = fs
    .readdirSync(path.join(app, 'src'), {withFileTypes: true})
    // play, playRelease, testPlay, androidTestPlayDebug: Gradle's names for the play flavour's own source sets.
    .filter(entry => entry.isDirectory() && !/^play|Play/.test(entry.name))
    .map(entry => entry.name);
  for (const sourceSet of sourceSets) {
    for (const file of sourcesUnder(path.join(app, 'src', sourceSet))) {
      if (STORE_CODE.test(fs.readFileSync(file, 'utf8'))) {
        found.push(`${path.relative(root, file)}: names a Google Play library outside src/play`);
      }
    }
  }
  for (const {code, line} of codeLines(path.join(app, 'build.gradle'))) {
    if (STORE_DEPENDENCY.test(code) && !/^play[A-Z]\w*\s*[("']/.test(code)) {
      found.push(`android/app/build.gradle:${line}: a Google Play dependency not scoped to the play flavour`);
    }
  }
  // The build files every module shares cannot scope anything to one flavour.
  const shared = [
    ...['build.gradle', 'settings.gradle', 'gradle.properties'].map(name => path.join(root, 'android', name)),
    ...sourcesUnder(path.join(root, 'android', 'gradle')),
  ].filter(file => fs.existsSync(file));
  for (const file of shared) {
    for (const {code, line} of codeLines(file)) {
      if (STORE_DEPENDENCY.test(code)) {
        found.push(`${path.relative(root, file)}:${line}: a Google Play library in a build file every flavour shares`);
      }
    }
  }
  // Runtime npm packages are autolinked into every variant.
  // package.json is this repository's own manifest; `dependencies` is a string map when present.
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  for (const dep of Object.keys(manifest.dependencies ?? {})) {
    for (const file of sourcesUnder(path.join(root, 'node_modules', dep, 'android'))) {
      if (STORE_CODE.test(fs.readFileSync(file, 'utf8'))) {
        found.push(`${path.relative(root, file)}: an npm package that links a Google Play library into every flavour`);
      }
    }
  }
  return found.sort();
};

it('no source set but play, and no dependency but a play one, names a Google Play library', () => {
  expect(findings(REPO_ROOT)).toEqual([]);
});

it('the build has exactly the two store flavours this rule is about', () => {
  const gradle = fs.readFileSync(path.join(REPO_ROOT, 'android', 'app', 'build.gradle'), 'utf8');
  const block = /productFlavors \{([\s\S]*?)\n {4}\}/.exec(gradle)?.[1] ?? '';
  expect([...block.matchAll(/^ {8}(\w+) \{/gm)].map(match => match[1]).sort()).toEqual(['foss', 'play']);
});

it('reports each way store code can leak, and leaves the play flavour alone', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-code-'));
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
    fs.writeFileSync(path.join(dir, file), text);
  };
  try {
    write('android/app/src/play/java/Billing.kt', 'import com.android.billingclient.api.BillingClient');
    write('android/app/src/testPlay/java/CodesTest.kt', 'import com.android.billingclient.api.BillingClient');
    write('android/app/src/testFoss/java/Leak.kt', 'import com.android.billingclient.api.BillingClient');
    write('android/app/src/main/java/Leak.kt', 'import com.android.billingclient.api.Purchase');
    write('android/app/src/foss/java/Stub.kt', 'import com.google.android.gms.common.GoogleApiAvailability');
    write('android/app/src/main/java/Fine.kt', 'import com.anotherwhy.zero.widget.WidgetStore');
    write('package.json', JSON.stringify({dependencies: {'some-iap': '1.0.0', react: '19.0.0'}}));
    write('node_modules/some-iap/android/src/main/java/Iap.kt', 'import com.android.billingclient.api.BillingClient');
    write('node_modules/some-iap/android/build/lint-cache/index.xml', '<a>com.google.android.gms</a>');
    write('node_modules/react/android/src/main/java/Plain.kt', 'class Plain');
    write(
      'android/build.gradle',
      'buildscript { dependencies { classpath("com.google.android.gms:oss-licenses-plugin:0.10.6") } }',
    );
    write(
      'android/gradle/libs.versions.toml',
      'billing = { module = "com.android.billingclient:billing", version = "9.1.0" }',
    );
    write(
      'android/app/build.gradle',
      [
        'dependencies {',
        '    playImplementation("com.android.billingclient:billing:9.1.0")',
        '    implementation("com.android.billingclient:billing:9.1.0")',
        '    // implementation("com.google.android.play:review:2.0.2")',
        '}',
      ].join('\n'),
    );
    expect(findings(dir)).toEqual([
      'android/app/build.gradle:3: a Google Play dependency not scoped to the play flavour',
      'android/app/src/foss/java/Stub.kt: names a Google Play library outside src/play',
      'android/app/src/main/java/Leak.kt: names a Google Play library outside src/play',
      'android/app/src/testFoss/java/Leak.kt: names a Google Play library outside src/play',
      'android/build.gradle:1: a Google Play library in a build file every flavour shares',
      'android/gradle/libs.versions.toml:1: a Google Play library in a build file every flavour shares',
      'node_modules/some-iap/android/src/main/java/Iap.kt: an npm package that links a Google Play library into every flavour',
    ]);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
