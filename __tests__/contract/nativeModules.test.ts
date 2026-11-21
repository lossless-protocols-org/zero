/**
 * The JS specs (src/native/specs) and the native code that implements them
 * agree (audit 2026-11-08 §6.2). Codegen makes Kotlin fail to compile on a
 * missing method, but an Objective-C class that misses a protocol method only
 * warns, and crashes when JS calls it. Checked here, for every spec:
 *
 * - each method exists on every platform that provides the module, and the
 *   module is absent (null in JS) on the platform that does not;
 * - each Objective-C call into Swift (ZeroWidgetStoreObjC.h) names an @objc
 *   method the Swift class really has.
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';

const read = (...parts: string[]) => fs.readFileSync(fromRoot(...parts), 'utf8');

/** Where each spec is implemented; null where the platform has none on purpose. */
const SPECS: Record<string, {android: string | string[] | null; ios: string | null}> = {
  NativeWidgetBridge: {
    android: 'android/app/src/main/java/com/anotherwhy/zero/bridge/WidgetBridgeModule.kt',
    ios: 'ios/zero/Widget/ZeroWidgetBridge.mm',
  },
  NativeQuickAddWindow: {
    android: 'android/app/src/main/java/com/anotherwhy/zero/bridge/QuickAddWindowModule.kt',
    ios: null,
  },
  NativePendingEntries: {
    android: null,
    ios: 'ios/zero/Widget/ZeroPendingEntries.mm',
  },
  // 3.0: the store. On Android one class per flavour, Google Play in `play` and "no store" in
  // `foss`; each must implement the whole spec, or that flavour does not compile.
  NativeBilling: {
    android: [
      'android/app/src/play/java/com/anotherwhy/zero/bridge/BillingModule.kt',
      'android/app/src/foss/java/com/anotherwhy/zero/bridge/BillingModule.kt',
    ],
    ios: 'ios/zero/Billing/ZeroBilling.mm',
  },
  // 3.0 (P9): reminders for recurring rules, the platforms' own notification APIs.
  NativeReminders: {
    android: 'android/app/src/main/java/com/anotherwhy/zero/bridge/RemindersModule.kt',
    ios: 'ios/zero/Reminders/ZeroReminders.mm',
  },
  // 3.0 (P10): the encrypted backup's folder, key and file format.
  NativeBackup: {
    android: 'android/app/src/main/java/com/anotherwhy/zero/bridge/BackupModule.kt',
    ios: 'ios/zero/Backup/ZeroBackup.mm',
  },
  // 3.0 (P12): PDF reports, drawn with the platforms' own PDF and text APIs.
  NativeReportPdf: {
    android: 'android/app/src/main/java/com/anotherwhy/zero/bridge/ReportPdfModule.kt',
    ios: 'ios/zero/Reports/ZeroReportPdf.mm',
  },
};

/** The method names a spec's `interface Spec` declares. */
const methodsOf = (spec: string): string[] => {
  const body = /export interface Spec extends TurboModule \{([\s\S]*?)\n\}/.exec(
    read('src', 'native', 'specs', `${spec}.ts`),
  )?.[1];
  return [...(body ?? '').matchAll(/^\s+(\w+)\(/gm)].map(([, name]) => name ?? '');
};

it('every spec file is accounted for here', () => {
  const specs = fs
    .readdirSync(fromRoot('src', 'native', 'specs'))
    .map(file => file.replace(/\.ts$/, ''))
    .sort();
  expect(specs).toEqual(Object.keys(SPECS).sort());
});

describe.each(Object.entries(SPECS))('%s', (spec, where) => {
  const methods = methodsOf(spec);
  const codegen = JSON.parse(read('package.json')).codegenConfig as {ios: {modulesProvider: Record<string, string>}};

  it('declares methods', () => {
    expect(methods.length).toBeGreaterThan(0);
  });

  it('Android implements every method, or has no module at all', () => {
    const packageSource = read('android/app/src/main/java/com/anotherwhy/zero/bridge/ZeroBridgePackage.kt');
    if (where.android === null) {
      expect(packageSource).not.toContain(`${spec}Spec.NAME`);
      return;
    }
    expect(packageSource).toContain(`${spec}Spec.NAME`);
    for (const file of [where.android].flat()) {
      const kotlin = read(file);
      expect(kotlin).toContain(`: ${spec}Spec(`);
      for (const method of methods) {
        expect({file, method, implemented: new RegExp(`override fun ${method}\\(`).test(kotlin)}).toEqual({
          file,
          method,
          implemented: true,
        });
      }
    }
  });

  it('iOS implements every method, or has no module at all', () => {
    if (where.ios === null) {
      expect(codegen.ios.modulesProvider[spec]).toBeUndefined();
      return;
    }
    const objc = read(where.ios);
    expect(objc).toContain(`<${spec}Spec>`);
    expect(objc).toContain(`RCT_EXPORT_MODULE(${spec})`);
    // A module with events extends the base class codegen generates for its emitter.
    expect(objc).toMatch(new RegExp(`@interface ${codegen.ios.modulesProvider[spec]} : (NSObject|${spec}SpecBase) <`));
    for (const method of methods) {
      expect(objc).toMatch(new RegExp(`^- \\(void\\)${method}\\b`, 'm'));
    }
  });
});

it('every Objective-C call into ZeroWidgetStore names an @objc Swift method', () => {
  const declared = [...read('ios/zero/Widget/ZeroWidgetStoreObjC.h').matchAll(/^\+ \(\w+\s*\*?\)(\w+)/gm)].map(
    ([, name]) => name ?? '',
  );
  const swift = read('ios/zero/Widget/ZeroWidgetStore.swift');
  expect(declared.sort()).toEqual(['readPendingEntries', 'removePendingEntries', 'writeSnapshot']);
  for (const selector of declared) {
    expect(swift).toMatch(new RegExp(`@objc public static func ${selector}\\(`));
  }
  expect(swift).toContain('@objc(ZeroWidgetStore)');
});

it('every Objective-C call into ZeroBillingStore names an @objc Swift method', () => {
  const declared = [...read('ios/zero/Billing/ZeroBillingStoreObjC.h').matchAll(/^\+ \(\w+\s*\*?\)(\w+)/gm)].map(
    ([, name]) => name ?? '',
  );
  const swift = read('ios/ZeroBilling/ZeroBillingStore.swift');
  expect(declared.sort()).toEqual([
    'getEntitlements',
    'getOriginalInstall',
    'getProducts',
    'isAvailable',
    'openManageSubscriptions',
    'purchase',
    'restore',
    'setChangeHandler',
    'start',
  ]);
  for (const selector of declared) {
    expect(swift).toMatch(new RegExp(`@objc public static func ${selector}\\(`));
  }
  expect(swift).toContain('@objc(ZeroBillingStore)');
  // And the module calls nothing the header does not declare.
  const called = [...read('ios/zero/Billing/ZeroBilling.mm').matchAll(/\[ZeroBillingStore (\w+)/g)].map(
    ([, name]) => name,
  );
  expect(called.filter(name => !declared.includes(name ?? ''))).toEqual([]);
});

it('every Objective-C call into ZeroBackupStore names an @objc Swift method', () => {
  const declared = [...read('ios/zero/Backup/ZeroBackupStoreObjC.h').matchAll(/^\+ \(\w+\s*\*?\)(\w+)/gm)].map(
    ([, name]) => name ?? '',
  );
  const swift = read('ios/ZeroBackup/ZeroBackupStore.swift');
  expect(declared.sort()).toEqual([
    'chooseFolder',
    'decrypt',
    'folder',
    'forget',
    'holdBackground',
    'releaseBackground',
    'setPassphrase',
    'write',
  ]);
  for (const selector of declared) {
    expect(swift).toMatch(new RegExp(`@objc public static func ${selector}\\(`));
  }
  expect(swift).toContain('@objc(ZeroBackupStore)');
  const called = [...read('ios/zero/Backup/ZeroBackup.mm').matchAll(/\[ZeroBackupStore (\w+)/g)].map(
    ([, name]) => name,
  );
  expect(called.filter(name => !declared.includes(name ?? ''))).toEqual([]);
});

it('every Objective-C call into ZeroReportPdfStore names an @objc Swift method', () => {
  const declared = [...read('ios/zero/Reports/ZeroReportPdfStoreObjC.h').matchAll(/^\+ \(\w+\s*\*?\)(\w+)/gm)].map(
    ([, name]) => name ?? '',
  );
  const swift = read('ios/ZeroReports/ZeroReportPdfStore.swift');
  expect(declared.sort()).toEqual(['render', 'share']);
  for (const selector of declared) {
    expect(swift).toMatch(new RegExp(`@objc public static func ${selector}\\(`));
  }
  expect(swift).toContain('@objc(ZeroReportPdfStore)');
  const called = [...read('ios/zero/Reports/ZeroReportPdf.mm').matchAll(/\[ZeroReportPdfStore (\w+)/g)].map(
    ([, name]) => name,
  );
  expect(called.filter(name => !declared.includes(name ?? ''))).toEqual([]);
});
