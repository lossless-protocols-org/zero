# Native code: map, rules and upgrade checklist

This is everything outside `src/` that ships in the app or builds it: where it lives, who calls it, how it is tested, and what to check when React Native moves. The audit behind this layout is `references/audit/2026-11-08-principal-engineer-audit.md`, §6 and §12.3.

## Map

| Where                                            | What                                                                                                                                                                                                                                                                                      | Talks to                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `src/native/specs/`                              | Codegen specs, one per platform reach: `NativeWidgetBridge` (both platforms), `NativeQuickAddWindow` (Android), `NativePendingEntries` (iOS).                                                                                                                                             | —                       |
| `src/features/widgets/bridge.ts`                 | **The only JS module that imports the specs** (rule `native-gateway` in `.dependency-cruiser.cjs`). A module a platform lacks is `null`, so each call there is a no-op.                                                                                                                   | the three specs         |
| `src/features/widgets/`                          | The snapshot (`snapshot.ts`), the publisher (`publish.ts`), the iOS queue drain (`pendingEntries.ts`), "add again" (`again.ts`), and the quick-add sheet (`quickAdd/`).                                                                                                                   | `bridge.ts`             |
| `android/app/src/main/java/com/anotherwhy/zero/` | `MainActivity`, `MainApplication` (template shape).                                                                                                                                                                                                                                       | —                       |
| … `bridge/`                                      | The TurboModules: `WidgetBridgeModule`, `QuickAddWindowModule`, `ZeroBridgePackage`. Codegen's `javaPackageName` points here.                                                                                                                                                             | `widget/`, `quickadd/`  |
| … `widget/`                                      | The home-screen widget: `ZeroWidgetProvider`, `WidgetRenderer`, `WidgetSnapshot` (the reader), `WidgetStore`, `WidgetPreview`.                                                                                                                                                            | —                       |
| … `quickadd/`                                    | The quick-add sheet's window (`QuickAddActivity`), the Quick Settings tile, launcher shortcuts, and `QuickAdd` (every intent into the sheet).                                                                                                                                             | `widget/`               |
| `android/app/src/test/`                          | JVM tests. Pure readers, plus Robolectric for `RemoteViews` binding, the store, the provider's alarm and the quick-add intents. Robolectric runs Android 14 under a plain `Application` (`src/test/resources/robolectric.properties`).                                                    | `contracts/`            |
| `ios/zero/`                                      | `AppDelegate`, `SceneDelegate` (template shape), `Intents/ZeroShortcuts.swift` (App Shortcuts, app target only).                                                                                                                                                                          | —                       |
| `ios/zero/Widget/`                               | The TurboModules: `ZeroWidgetBridge.mm` and `ZeroPendingEntries.mm`. They call Swift only through `ZeroWidgetStoreObjC.h`, which declares `ZeroWidgetStore`'s `@objc` surface.                                                                                                            | `ZeroWidgetStore.swift` |
| `ios/ZeroShared/`                                | The Swift the app and the widget share: the snapshot reader, `SharedStore` (the App Group store and the outside-the-app queue), `MoneyFormat`, App Intents, cards, and the string catalog. It is a Swift package for its tests (`ZeroSharedTests`).                                       | `contracts/`            |
| `ios/ZeroWidget/`                                | The widget extension: bundle, timeline provider, views, keypad. No React Native.                                                                                                                                                                                                          | `ZeroShared` files      |
| `contracts/`                                     | Fixtures more than one language reads: `widget-snapshot-contract.json` (JS writes, Kotlin and Swift read), `money-format-cases.json` (JS emits, Swift checks), `widget-assets.json` (widget colours and preview figures).                                                                 | —                       |
| `scripts/widget-assets.mjs`                      | Generates the widget copy, colours and preview figures for both platforms (below).                                                                                                                                                                                                        | locales, `contracts/`   |
| `patches/`                                       | `@nozbe/watermelondb@0.28.0`, applied by bun at install. Upstream casts the bridge to `RCTCxxBridge`, which RN 0.88 deleted, and relies on the 0.86 Gradle plugin enabling `BuildConfig` for every library. The reason and the exit condition live in `package.json` `//dependencyNotes`. | —                       |
| `vendor/`, `Gemfile`                             | Bundler's path for CocoaPods.                                                                                                                                                                                                                                                             | —                       |

## Rules

- **One spec per platform reach.** A method only one platform has goes in that platform's spec, which is `null` on the other. Don't add a method that silently does nothing. `__tests__/contract/nativeModules.test.ts` fails when a spec method is missing on a platform that provides the module, or when a module appears where it should be absent.
- **Only `bridge.ts` imports `src/native`.**
- **The widget never opens the database.** It reads the snapshot the app writes (`writeSnapshot`). With amounts hidden, the snapshot holds no amount at all, and `WidgetRendererBindTest` asserts that no size of the widget shows a digit.
- **Anything parsed in two languages has one fixture both read** (`contracts/`). Version literals (`WIDGET_SNAPSHOT_VERSION`, `WidgetSnapshot.VERSION`, `WidgetSnapshot.version`) are pinned to the fixture on all three sides.
- **Generated means generated.** Run `node scripts/widget-assets.mjs` after changing a locale's `widget.*` / `intents.*` keys or `contracts/widget-assets.json`. `--check` fails CI when it is stale. Its outputs:
  - Android: `widget_strings.xml` per locale, `widget_colors.xml` (light, dark, Android 12+ dynamic) and `widget_preview_strings.xml`;
  - iOS: `ZeroShared/Localizable.xcstrings`, and the regions marked `// BEGIN Generated … // END generated` in `ZeroShared/ZeroCards.swift` (`ZeroColors`) and `ZeroWidget/ThisMonthProvider.swift` (the gallery sample).
- **Roles that mirror an app token equal it.** `__tests__/contract/widgetAssets.test.ts` pins them to `ThemeContext`.

## Decisions (and why)

- **The shared Swift is a member of both targets, and also a package for its tests.** Linking the package into the app would fail on three counts:
  - **Deployment target:** the app supports iOS 15.1 (RN 0.88's floor) while the package needs iOS 17.
  - **Siri metadata:** App Intents need target membership for it unless both sides adopt `AppIntentsPackage`.
  - **Strings:** the shared strings would move from the main bundle to the package bundle.

  Membership in two targets is the Apple template's way to share code between an app and an extension. The real risk of two compilations is drift, so `__tests__/arch/sharedSwiftSources.test.ts` keeps `Package.swift`'s `sources` and both targets' compile lists identical. Revisit this when the app's floor reaches iOS 17.

- **The TurboModules stay in the app, not in `modules/<unit>` libraries** (the audit's §12.3 sketch). A library cannot depend on the app, and the bridge calls the app's widget and quick-add code. Extracting them would mean injecting those as interfaces, which is a cost with no user. The `bridge/` package and the split specs give the separation without it.
- **A QA build on both platforms:**
  - Android `qa` build type: release settings, id `com.anotherwhy.zero.qa`, name "zero QA", debug-signed (`./gradlew assembleQa`). The quick-add task affinity follows the installed id (`${applicationId}`). The static shortcuts need a literal `targetPackage` (the launcher does not resolve a resource there), so the QA build has its own `src/qa/res/xml/shortcuts.xml`; `__tests__/scripts/shortcuts.test.ts` pins each copy to its build's id.
  - iOS "zero QA" (`com.anotherwhy.zeroqa`) through `ZERO_BUNDLE_ID` / `ZERO_DISPLAY_NAME`.
  - Never install a test build over the owner's store install.
- **Hermes only.** The template's JavaScriptCore fallback (a floating `jsc-android`) is gone. Turning Hermes off is a build error.
- **The midnight alarm is re-armed at every app start** (`ZeroWidgetProvider.rearmMidnight`), because alarms do not survive a reboot and not every launcher sends `APPWIDGET_UPDATE` at boot. No boot receiver is used: that would need `RECEIVE_BOOT_COMPLETED`, which the no-read allow list does not grant.
- **Things that stay as they are, and why:**
  - **Rendering on the provider's main thread.** It takes milliseconds. Move to `goAsync()` only if the layouts grow.
  - **The catch-up publish each time the quick-add sheet opens.** It comes from the second `ReactActivity` flipping `AppState`, and `WidgetStore.write`'s dedupe makes it cost nothing visible.
  - **iOS `enqueue`'s three `UserDefaults` writes under the lock.** They are not atomic across keys, but the next snapshot write repairs a partial one.

- **Long-press the icon: one menu on both platforms.** Android's launcher shortcuts (`quickadd/LauncherShortcuts.kt`) and iOS's Home Screen quick actions (`WidgetSnapshot.quickActions()`, shared and tested in `ZeroShared`; installed by `ZeroQuickActions` in the app target) come from the same snapshot fields (`quick`, `last`): Add expense, Money in, "Add again" (the sheet filled in) and the top category, or the two top categories with no last expense or with amounts hidden. iOS taps open `zero://quick?…&amount=…&title=…` (validated in `src/navigation/linking.ts`). In a scene app `RCTLinkingManager.application(_:open:options:)` forwards nothing, so a warm tap re-opens the app's own URL (into `scene(_:openURLContexts:)`), and a cold one hands the URL to React Native as its launch URL.
- **No Android voice entry in 2.8 (decided 2026-11-09).** App Actions (`shortcuts.xml` capabilities) no longer reach Gemini, which replaced Assistant on phones. The successor, AppFunctions (`androidx.appfunctions`, 1.0.0-rc01; Android 16+), is a new dependency in a release candidate with Gemini access just out of preview, and an AppFunction hands zero's data to an agent that runs in Google's cloud, against "nothing leaves this device". Revisit for 3.x as a product decision (the owner's), with on-device-only functions if the platform allows.

## Commands

|                                                          |                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `bun run test:android`                                   | Kotlin JVM tests, Robolectric included.                                                                                          |
| `cd android && ./gradlew :app:lintDebug`                 | Android Lint. New errors fail; the existing ones are in `lint-baseline.xml`.                                                     |
| `cd android && ./gradlew assembleRelease` / `assembleQa` | Release (signed when `keystore.properties` is present) and QA builds.                                                            |
| `bun run test:ios`                                       | The `ZeroShared` package tests on a simulator. In a fresh shell, set `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. |
| `node scripts/widget-assets.mjs [--check]`               | Regenerate (or check) the widget assets.                                                                                         |

## Upgrading React Native: checklist

The app touches template internals in five places. Diff each against the new template (react-native-community/rn-diff-purge):

1. `MainApplication.kt`: `getDefaultReactHost(packageList = …)` plus `add(ZeroBridgePackage())`, and `loadReactNative(this)`.
2. `MainActivity.kt` and `quickadd/QuickAddActivity.kt`: a second `ReactActivity` (component `zeroQuickAdd`, registered in `index.js` on Android only) on the same `ReactHost`. The template has no second root, so check that `ReactActivityDelegate`'s constructor and `getMainComponentName` still hold.
3. `SceneDelegate.swift`: it subclasses `RCTDefaultReactNativeFactoryDelegate` (template shape since RN 0.80). The bridges no longer import `zero-Swift.h`, so a move of that header no longer breaks them.
4. The codegen config in `package.json` (`codegenConfig`: `jsSrcsDir`, `javaPackageName`, `ios.modulesProvider`): after a spec change, run `pod install` (iOS regenerates `ZeroSpecs`); Gradle regenerates on build.
5. `patches/@nozbe%2Fwatermelondb@0.28.0.patch`: re-run `bun install`. A patch that no longer applies fails the install. Then run the SQLite suites and the device checklist.

Also:

- **`gradle.properties`:** `android.builtInKotlin=false` and `android.newDsl=false` are the RN 0.88 template's opt-outs from AGP 9 behaviour, and AGP 10 removes them. Drop them when the template does.
- **Then run everything:**
  - `bun run check`, `bun run test:android`, `bun run test:ios` and `node scripts/widget-assets.mjs --check`;
  - a release build on the Moto, using the device checklist in `docs/RELEASE_QA.md`.
