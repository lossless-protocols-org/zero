# Release QA checklist

Run this before every release, against the **actual release artifact** (`.aab` /
`.ipa`), on **real hardware**. Debug builds and simulators hide production-only
failures: Hermes behaviour, `console.*` suppression, storage permissions,
low-memory kills, and R8/ProGuard differences.

Zero ships no crash reporter and no analytics by design — the only signals that
a build is sound are the automated gate below and this manual pass.

## 0. Read what users already told us (before writing a single line)

- [ ] Every new row in `references/zero bug sheet - Sheet1.tsv`, every new Play / App Store
      review, every new GitHub issue and every `#zero-bugs` post **since the last release**
      has been read and either fixed, scheduled in `references/FIX_PLAN.md`, or answered.
      The 2.6.6 crash (706 users) was described in the bug sheet weeks before Play Console
      showed it; nobody re-read the sheet. Never again.
- [ ] Play Console → Android vitals and Xcode → Organizer → Crashes checked for the
      current live version.

## 1. Automated gate (must be green before building)

```bash
bun run check          # everything below in one command; CI runs the same on every push and PR
bun run typecheck      # tsc --strict (+ noUncheckedIndexedAccess)
bun run lint           # eslint, --max-warnings 0: a new warning fails the gate
bun run format:check   # prettier
bun run test:coverage  # jest — every suite in __tests__/ (the app mounted, layers via
                       #   dependency-cruiser, unused code via knip, widget assets, native
                       #   contracts) with the coverage ratchet (jest.config.js)
bun run test:sqlite    # bun — the five SQLite suites (encoded SQL, migrations, query plans)
bun run check:no-read  # design §14: an ALLOW list; any permission, Info.plist usage key,
                       #   entitlement or dependency not on it fails the gate
node scripts/contrast-check.mjs
bun run test:android   # the widget's Kotlin (reader, rendering, store, alarm, quick-add intents;
                       #   Robolectric); CI runs it with Android Lint (./gradlew :app:lintDebug)
bun run test:ios       # the Swift shared by app and widget (snapshot reader, money format,
                       #   queue, Siri matching) on a simulator; CI runs it on macOS
cd android && ./gradlew assembleDebug
bun run test:e2e       # Maestro, on an emulator or the QA build only: it clears the app's data
                       #   (__tests__/e2e/README.md); CI runs it weekly
```

## 2. Build the real artifact

- [ ] `bun run version:set <x.y.z>` on a clean tree — versionName and versionCode both bumped
      once (it refuses a dirty tree or a version that is not higher; `--dry-run` to preview)
- [ ] `bun run android:release` (AAB for Play) and `bun run android:release:apk` (sideload APK,
      phone ABIs only)
- [ ] `bun run size:android` — record bundle / APK / AAB bytes and the APK's ABIs in the release notes
- [ ] iOS: `bundle exec pod install` then Archive from Xcode (the bundle phase writes the Hermes
      source map and drops `NSAllowsLocalNetworking` from Release)
- [ ] `scripts/archive-symbols.sh <x.y.z> <versionCode> <path/to/zero.xcarchive>` — AAB, APK,
      both Hermes maps, the R8 `mapping.txt` (2.8+), the dSYM and SHA256SUMS into
      `references/play-vitals/symbols/`; upload `mapping.txt` to Play Console with the AAB
      (App bundle explorer → the version → Downloads → ReTrace mapping file)
- [ ] Install the release build on device (not Metro, not debug)
- [ ] iOS privacy manifests: the app (`ios/zero/PrivacyInfo.xcprivacy`) and the widget extension
      (`ios/ZeroWidget/PrivacyInfo.xcprivacy`) each declare every required-reason API their own binary
      calls (App Group defaults are `1C8F.1`). Check in the archive: `plutil -p` both files inside
      `zero.app` and `PlugIns/ZeroWidget.appex`. A missing one comes back as ITMS-91053 after upload
- [ ] `ITSAppUsesNonExemptEncryption` is `false` in `ios/zero/Info.plist` (zero uses only the OS's
      own encryption; revisit if a crypto library or MMKV `encryptionKey` is ever added)
- [ ] Android: `zipalign -c -P 16 -v 4` on the APK passes (Play's 16 KB page-size rule)

## 3. Privacy verification (Lossless Protocol claims)

- [ ] `bun run check:no-read:apk` (reads the built APK with aapt2) → clean: **no
      `android.permission.INTERNET`**, nothing on the forbidden list; storage permissions capped
      at `maxSdkVersion="32"`
- [ ] Play Console pre-launch report shows no network access
- [ ] Settings → "What leaves this device" renders and reads correctly
- [ ] `grep -rn "fetch(\|XMLHttpRequest\|WebSocket" src/` returns nothing

## 4. Critical flows (both platforms)

- [ ] Fresh install → onboarding → name → categories → currency → first expense
- [ ] **Every action sheet opens on the release build** (month picker, budget, date, currency,
      theme, language, week start, name, icon, colour, sort, a row's long-press menu). The sheets
      load on first open; a release-only failure left one mounted and invisible, swallowing taps
      (audit 2026-11-08 §8.3, `src/navigation/sheets.tsx`)
- [ ] **Update over the store build with real data** (a schema change): "Updating your data…"
      shows instead of a blank screen, then Home with its rows; the next cold start goes straight in
- [ ] **Tap the header back arrow (not the hardware back key) on every screen
      that has one**: Add/Edit category, Add/Edit debt, Add/Edit person, a
      person's debts, Reports → category drill-down, Reports → day drill-down,
      Settings, Diagnostics. v2.6.6 crashed on six of these (`goBack` invoked
      with the press event); the hardware key does not exercise that path.
- [ ] Add / edit / delete an expense; confirm the daily-budget line is right
      **when editing** (it must not double-count the amount being edited)
- [ ] Delete a transaction and let the 3s undo window elapse → stays deleted
- [ ] Delete a transaction, then **scroll the row off-screen** within 3s →
      the delete still commits and the row does not come back
- [ ] Delete a transaction, then **background/kill the app** within 3s →
      no resurrection
- [ ] Category create / edit / soft-delete (with confirmation)
- [ ] Verify a soft-deleted category still resolves on old transactions
- [ ] Debtor + debts: create, edit, settle, delete debtor (deletes their debts)
- [ ] Reports: donut renders, centre total matches the legend sum, tapping a
      legend row opens that category
- [ ] Reports: empty month, single-category month, many-category month
- [ ] Month navigation across a year boundary; no flicker
- [ ] **‹ › month arrows** on Home and Reports step one month; › is disabled on
      the current month; the pill still opens the picker
- [ ] **Budgets (v2.7.0 rules):** set a recurring budget in an earlier month,
      then a different recurring amount from the current month → the earlier
      months keep their amount. Remove → "This month only" leaves the other
      months alone; "From this month on" leaves the past alone
- [ ] **Per-category budget:** set one from the budget sheet's category chips →
      a bar appears under that category in the Reports legend; it survives
      export → restore
- [ ] **Reports legend eye icon** hides a category from the donut and re-bases
      the percentages; the hidden state is per visit, not persisted
- [ ] **Settle up** on a person adds one balancing entry dated today, the
      balance reads zero, and every past entry is still there
- [ ] **Swipe off** (Settings → Swipe to edit or delete): rows ignore swipes,
      a long-press opens Edit/Delete, the swipe tutorial does not appear; turn
      it back on and swipes work again without restarting
- [ ] Amount limit follows the currency: a 0-decimal currency (JPY, COP, VND)
      drops the decimal key and accepts amounts in the millions; a 2-decimal
      currency truncates a third decimal as it is typed
- [ ] Category name of 40 characters saves and does not break chips or legend;
      a second category with the same name (any case) is refused inline
- [ ] Adding an expense: "Next" on the keyboard moves title → description →
      amount
- [ ] Future dates cannot be picked for an expense

### 2.8 additions

- [ ] **R8 build (2.8+ ships minified):** every flow below on the minified release, not a
      debug or unminified build; any `ClassNotFoundException` / `NoSuchMethodError` in logcat
      is a missing keep rule (`android/app/proguard-rules.pro`)
- [ ] **Money tab:** add money in (Received · Kept on Home and Reports update), edit it, delete
      it; debts still never change a month's totals
- [ ] **Refunds:** "Got money back" on an expense → badge on the row, the month's spending is
      net of it; delete the expense → its refund goes with it
- [ ] **Calculator** (Settings, off by default): `120+45×2` shows "= 210" and saves 210;
      divide by zero and a negative result are refused; Done on iOS closes the keypad
- [ ] **Landscape (Android):** the Add, money in, refund, debt, person and category forms scroll
      to their button; with the calculator on, the amount field and its keys stay above the
      keyboard
- [ ] **Sort** (Date / Category / Title / Amount) on Home and a day; kept after relaunch
- [ ] **Category from history:** a title used before preselects its category ("from your
      history"); a tap on a chip wins
- [ ] **Reorder categories** by drag and with TalkBack / VoiceOver Move up / Move down; the
      order survives export → restore and shows in the Add form's chips
- [ ] **Widgets:** every size on the launcher (Android) and every family (iOS); figures update
      after an add / edit / delete / refund; hide amounts shows ••••; chips are whole names,
      never "Transpor…"; "Add again" opens the sheet filled in
- [ ] **Quick add without the app:** widget "+", a category chip, the Quick Settings tile and
      the launcher shortcuts (incl. the "Chai ₹20" repeat-last one) on Android; Siri,
      Shortcuts, the Action Button and Control Center on iOS
- [ ] **Deep links:** `zero://add`, `zero://money/add`, `zero://quick?kind=expense` open the
      right screen warm and cold, never skip onboarding, and Back lands on Home

## 5. Backup / restore

- [ ] Export → wipe → restore: expenses, categories, debts, **budgets**
      (overall AND per-category), **refunds, money in, category order** and soft-delete
      statuses all return
- [ ] Export reflects a change made seconds earlier (set a budget, export at
      once, open the file: the budget is in it)
- [ ] A backup whose `version` is higher than the app's is refused with the
      "newer version" message, and nothing on the device changes
- [ ] Restore a backup with duplicate category names → merged, not duplicated
- [ ] Cancel the "replace all data" dialog → existing data untouched
- [ ] Restore on **Android 10, 11 or 12** specifically (storage permission path)
- [ ] After restore, the month/year picker shows the restored data's years

## 6. Locale, theme, accessibility

- [ ] Switch theme (light / dark / system) — including a system-level change
      while the app is open
- [ ] Switch language, then re-open the month picker: month names update and
      previously-saved months still resolve (no empty month)
- [ ] Non-Latin name in onboarding (e.g. `हिंदी`, `José`) is accepted
- [ ] Currency formatting: an INR device shows lakh grouping for INR but
      **not** for USD/RUB/HUF
- [ ] Screen reader: swipe actions announce Edit/Delete; the budget
      "every month" row announces as a switch with its state
- [ ] Large system font / display size does not clip the home header or sheets

## 7. Edge and adversarial

- [ ] Airplane mode throughout (the app must not care)
- [ ] Denied storage permission → clear message, offer to open settings
- [ ] Force-kill mid-write (add an expense and kill immediately) → no corruption
- [ ] Very long titles, very large amounts, rapid double-taps on Continue
      during onboarding (must not create duplicate categories/currencies)
- [ ] Low storage
- [ ] Cold start time and list scroll feel unchanged vs the previous release
- [ ] Settings → Diagnostics lists recorded errors and clears them

## 8. Sign-off

- [ ] Automated gate green
- [ ] Symbols archived for this version (step 2)
- [ ] Sections 3–7 walked on at least one recent iPhone and one mid/low-end Android
- [ ] Note the OS versions and devices used in the release notes
