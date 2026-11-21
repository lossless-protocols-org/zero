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
                       #   Robolectric); CI runs it with Android Lint (./gradlew :app:lintPlayDebug :app:lintFossDebug)
bun run test:ios       # the Swift shared by app and widget (snapshot reader, money format,
                       #   queue, Siri matching) and the App Store code against Xcode's local
                       #   test store, on a simulator; CI runs it on macOS
cd android && ./gradlew assemblePlayDebug
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

From 3.0 (schema v6, backup v6), on both platforms:

- [ ] **Upgrade over the live store build with data**: install the current store release, restore the
      10k seed (`node scripts/seed-backup.mjs 10000`) and add an entry, then install the 3.0 build over
      it. It opens on Home with every row; then add, export, and restore that export
- [ ] A 3.0 backup restored on the current 2.8 store build says "newer version" and changes nothing
- [ ] A backup with several money-in categories restored **without Pro**: every one is kept; the Money
      tab, the money-in form and quick add show one; Settings → zero Pro shows "Pro data kept"; Remove
      Pro data folds them into the one shown, every entry kept. **With Pro**: all of them are listed
- [ ] `bun run test:sqlite` green: every shipped schema, 2.8.0's included, upgrades to v6 with every
      value unchanged
- [ ] **Accounts restored without Pro** (`node scripts/seed-backup.mjs 10000 --accounts`): no account row on
      add expense, money in or refund; no net-worth card on Money; Home and Money show the same totals as
      with Pro; editing an entry that is on another account keeps it there (export and look); Settings
      counts the accounts, transfers and checkpoints as Pro data kept, and Remove Pro data leaves one
      account with every entry on it and the same month totals
- [ ] A refund recorded to another account than its expense (Pro) comes back on that account after export
      and restore
- [ ] Recurring rules and the link from each made entry to its rule come back after export and restore;
      a backup of the restore is the same file

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

### zero Pro on screen (from 3.0)

Before the first 3.0 build goes to a store:

- [ ] `SHIPPED_PRO_FEATURES` (`src/pro/features.ts`) lists every Pro feature in the build, and nothing else: the
      upgrade sheet lists exactly these. **3.0 does not ship while it is empty.**
- [ ] `THANKS_ENDS_ON_MS` (`src/pro/eligibility.ts`) is set to the fixed end date, 90 days after launch, and the
      test that pins it unset is updated with it
- [ ] The words on the sheet, the what's-new screen and the ended notice are true of this build (no feature
      named that is not in it)

Each release, on both platforms:

- [ ] Settings → zero Pro: the row's second line matches the entitlement (Diagnostics shows the state); the
      sheet opens and closes; Restore says how it went
- [ ] Without Pro: no Pro screen can be reached, by tap or by link; nothing about Pro appears outside Settings
- [ ] With a trial offered: the sheet prints the date of the first charge, and it is fourteen days from today
- [ ] Pro ending shows "zero Pro has ended" once, and not again on the next launch
- [ ] VoiceOver and TalkBack: every control on the sheet, the notice and the what's-new screen is read with
      its name and role; the price and its terms are read before the button

Accounts and net worth (P8), with Pro, each release:

- [ ] Money → net worth card → Net worth: the total equals the four lines; "Since 1 …" reads kept, then only
      what moved (investments, unexplained, opening balances, debts outside accounts)
- [ ] Add an account (a card with a balance below zero), transfer to it, reconcile it: the gap shown is
      what the entries do not explain; on an investment it reads as gained or lost
- [ ] Add expense with two or more active accounts: the account row is filled in with the default and adding
      takes the same taps as without it; picking another account puts the expense there
- [ ] Archive an account: it leaves the pickers, stays in net worth; the default cannot be archived
- [ ] Reconcile a bank account below what the entries give: "Record the missing expense" opens Add expense
      with the gap, the day and that account; after saving it, the gap reads "explain it exactly"
- [ ] Reports in a month with a balance set on cash or bank shows "Unexplained"; a fund's value change does not
- [ ] A debt: "No account" by default; picking an account moves that account's balance and not net worth
- [ ] Export CSV with two or more accounts has an Account column; with one account it has none

Income categories and recurring entries (P9), each release:

- [ ] Without Pro the Income tab of Categories offers no add (and says why); with Pro it adds an income
      category, and Money groups money in by category with each total
- [ ] With Pro, a rule due today makes its entry on opening the app, once (open, close, open again: one row)
- [ ] A rule left behind (the app not opened for two occurrences) is not filled by itself: the app says
      entries were missed and Recurring offers "Add them" or "Start from today"
- [ ] A rule whose amount varies waits under "To confirm"; Enter amount makes the entry, Skip makes none
- [ ] The first rule saved with a reminder asks for notifications (Android 13+, iOS), never earlier; the
      reminder arrives at 09:00 on its day, says the name and when, and shows no amount
- [ ] **Reboot the phone with a reminder pending: it still arrives, without opening zero** (Android: the
      boot receiver; iOS: the system keeps it); one due while the phone was off shows at boot. Do this on
      a Motorola (its BatteryCare suspends apps at boot) and on one other maker
- [ ] Pro ends: no entry is made by any rule and no reminder stays pending; Settings counts the rules as
      Pro data kept; the entries rules already made are ordinary rows
- [ ] Editing an entry a rule made asks "just this one, or the recurring entry?"; backing out of the
      question edits just the entry
- [ ] Diagnostics → Accounts: "Net worth check … holds", and the slowest single account is 20 ms or less on
      the low-end Android device with the 10k seed with accounts

Automatic encrypted backup (P10), each release, on the low-end Android device and on an iPhone:

- [ ] Without Pro, Settings → Data shows no "Automatic backup" row; with Pro it shows "Off"
- [ ] Setup: Choose folder opens the system picker (Android: in Documents; a Google Drive or other cloud folder is
      refused with "not on this phone"; iOS: On My iPhone and iCloud Drive both work); a passphrase shorter than 8
      or typed differently twice is refused; Turn on writes `zero-backup-<today>.zbak` into the folder at once
- [ ] Add an entry and leave zero: today's file is replaced within a few seconds. Leave again without a change:
      the file is not touched
- [ ] Keep 7 days with more than 7 older `zero-backup-…zbak` files in the folder: only the newest 7 stay; any other
      file in the folder is untouched
- [ ] Delete the folder in Files, then Back up now: "zero can't reach the backup folder"; Change folder fixes it and
      writes at once. (iOS: also take access back in Settings → Privacy → Files and Folders)
- [ ] Restore on another phone, or after Delete all data: "I have a backup" → the `.zbak` → a wrong passphrase is
      refused and nothing changes; the right one restores everything. Restoring works without Pro
- [ ] **Cross-platform:** a file written on Android restores on iOS, and the reverse
- [ ] Delete all data does not replace today's backup file (automatic backup is off afterwards)
- [ ] Pro ends with automatic backup on: the notice says it stopped and when the last backup was made; leaving
      zero writes nothing more

Month start day and custom range (P11), each release, both platforms:

- [ ] Without Pro, Settings shows no "Month starts on" row and every month is the calendar month
- [ ] With Pro, pick a day (say 7): the sheet shows "This month: 7 Nov – 6 Dec" before Apply; after it Home, Reports,
      Money and Settings' budget row all name the same days, and Home's count changes to the entries in those days
- [ ] On a day before the start day, "this month" is still the month that began last month, and › is disabled
- [ ] Reports' calendar starts under the right weekday and runs across the month end (7 … 30, 1 … 6)
- [ ] A budget set for the month applies to the month as now cut; the daily allowance counts days from the start day
- [ ] Widget: its label reads the month's days; left on the home screen over midnight into the start day, the
      month figure resets and the label moves on, without opening zero
- [ ] Export, Delete all data, restore: the day comes back. Restored without Pro: calendar months, and Settings
      counts the day as Pro data kept
- [ ] Pro ends: the notice says months are calendar months again; the screens redraw on calendar months at once
- [ ] Reports → Custom range: From and To pick any days up to today; an end before the start moves the other end;
      the figures are the entries dated in those days; no budget is shown

Trends and PDF reports (P12), each release, both platforms:

- [ ] Reports shows Trends, Custom range and Share as PDF only with Pro
- [ ] Trends: 3, 6 and 12 months; Spent, Money in, Kept; a category chip; tapping a bar shows that month against the
      one before; "What stood out" is about the last finished month and each sentence shows its figures
- [ ] Each month in Trends equals what Reports shows for that month
- [ ] Diagnostics → Accounts: "Trends, 12 months" is 50 ms or less on the low-end Android device with the 10k seed
- [ ] Share as PDF (month, range, trends): the share sheet opens with the file; opened elsewhere it shows the same
      figures as the screen, text can be selected, a long list continues on the next page with its header, and
      every page has its foot and number. In a right-to-left language the page is mirrored
- [ ] The PDF is light in dark mode too; nothing is sent anywhere until the user picks an app in the share sheet

### The store on iOS (from 3.0; until the Pro screens exist, read the result in Settings → Diagnostics → "zero Pro and the store")

Local test store, no Apple account (Xcode: Product → Scheme → Edit Scheme → Run → Options → StoreKit
Configuration → `zero.storekit`; purchases are made from Debug → StoreKit → Manage Transactions):

- [ ] A fresh run reads `pro: none` and `store: did not say (noTransactions)`: a store that holds no
      transaction of zero's cannot say, by design (docs/NATIVE.md)
- [ ] Buy the lifetime product in the transaction manager → on the next foreground `pro: lifetime`
- [ ] Refund it there → `pro: revoked`, with an `ended` time
- [ ] Buy the monthly product → `pro: trial`, `renews: yes`; turn renewal off → `renews: no`; let it
      expire (Editor → Subscription Renewal Rate) → `pro: expired` after the next foreground
- [ ] Aeroplane mode at launch → the last state stands and `store:` never reads as an error

Sandbox, with a sandbox Apple account on a real iPhone (needs the paid-apps agreement and the
products in App Store Connect; never on the owner's everyday iPhone build):

- [ ] The three products load with the store's own price text; an unknown id is simply absent
- [ ] Buy, cancel at the sheet, and Ask to Buy: approve → Pro arrives without a tap; **decline → no Pro**
      (Xcode's test store cannot show a decline)
- [ ] Restore on a second device signs in once and brings Pro back
- [ ] Billing retry and grace period read `onHold` and `grace`; a refund from reportaproblem.apple.com
      reads `revoked`
- [ ] Manage subscription opens Apple's sheet
- [ ] `first seen` and the signed original install agree for a TestFlight build installed over 2.8

### The store on Android (from 3.0; `play` flavour)

Every build, on a real phone with the Play Store, using the **minified** QA or release build:

- [ ] `node scripts/check-no-read.mjs --flavour play --apk …` and `--flavour foss --apk …` are clean: play
      adds only `com.android.vending.BILLING`; neither holds `INTERNET` or Google's uploader
- [ ] Cold start, then `adb logcat` for the app's process. Expected: one `BillingLogger` line saying it is
      skipping logging. Not expected: `FATAL EXCEPTION`, `NoClassDefFoundError`, or any line from
      `TransportRuntime` or `CctTransportBackend`
- [ ] Settings → Diagnostics reads `store: answered, …` with the licence key in place, and
      `did not say (noLicenceKey)` without it
- [ ] **After any bump of the billing library:** read the new POM for added dependencies, repeat the three
      lines above, and leave the phone two days with the app opened now and then: no crash, no ANR, and
      `adb shell dumpsys jobscheduler | grep datatransport` prints nothing

With products in Play Console and a licence tester account (plan P5 spike part 2):

- [ ] The three products load with Play's own price text; the trial offer shows 14 days once, the base
      plan after that
- [ ] Buy, cancel at the sheet, slow test card approve → Pro arrives without a tap; slow card decline → no Pro
- [ ] Kill the app right after paying, relaunch → Pro on, and the order shows as acknowledged in Play Console
      (an unacknowledged order is refunded after three days)
- [ ] Refund with revoke in Play Console → Pro off at the next foreground once Play's cache has it
- [ ] Payment declined (Play Billing Lab) → still Pro in grace, `onHold` after it; paused → `onHold`
- [ ] Aeroplane mode at each step, and the Play Store disabled → the last state stands (`did not say`)
- [ ] A second phone on the same Google account shows Pro with no Restore tap

## 8. Sign-off

- [ ] Automated gate green
- [ ] Symbols archived for this version (step 2)
- [ ] Sections 3–7 walked on at least one recent iPhone and one mid/low-end Android
- [ ] Note the OS versions and devices used in the release notes
